use std::collections::HashMap;
use std::sync::Arc;
use log::{debug, info, error};
use tokio::sync::{mpsc, Mutex, RwLock};
use uuid::Uuid;
use rust_decimal::Decimal;
use anyhow::{Result, anyhow};
use serde::{Serialize, Deserialize};

use crate::models::{Market, Order, OrderStatus, OrderSide};
use crate::services::matching_engine::MatchingEngine;
use crate::services::balance_service::BalanceService;
use crate::db::connection::Repository;

/// Result of matching an order
#[derive(Debug, Serialize, Deserialize)]
pub struct OrderMatchResult {
    /// The order after matching
    pub order: Order,
    
    /// Whether the order was matched
    pub was_matched: bool,
    
    /// Any error that occurred
    pub error: Option<String>,
}

/// Service for managing orders and markets
pub struct OrderService<R: Repository> {
    /// Markets by ID with concurrency control
    markets: Arc<RwLock<HashMap<String, Arc<Mutex<Market>>>>>,
    
    /// Matching engine for processing orders
    matching_engine: Arc<Mutex<MatchingEngine>>,
    
    /// Database repository
    repository: Arc<R>,
    
    /// Balance service for handling user funds
    balance_service: Arc<BalanceService<R>>,
    
    /// Cache of markets
    markets_cache: Arc<RwLock<Vec<Market>>>,
}

impl<R: Repository> OrderService<R> {
    /// Creates a new order service
    pub fn new(
        repository: Arc<R>,
        matching_engine: Arc<Mutex<MatchingEngine>>,
        balance_service: Arc<BalanceService<R>>
    ) -> Self {
        Self {
            markets: Arc::new(RwLock::new(HashMap::new())),
            matching_engine,
            repository,
            balance_service,
            markets_cache: Arc::new(RwLock::new(Vec::new())),
        }
    }
    
    /// Creates a new market
    pub async fn create_market(&self, market: Market) -> Result<Market> {
        let market_id = market.market_id.clone();
        
        // Save market to database
        self.repository.save_market(&market).await?;
        
        // Add to in-memory cache
        let mut markets = self.markets.write().await;
        
        if markets.contains_key(&market_id) {
            return Err(anyhow!("Market with ID {} already exists", market_id));
        }
        
        markets.insert(market_id.clone(), Arc::new(Mutex::new(market.clone())));
        info!("Created market: {}", market_id);
        Ok(market)
    }
    
    /// Gets a market by ID
    pub async fn get_market(&self, market_id: &str) -> Result<Market> {
        // Try to get from cache first
        {
            let markets = self.markets_cache.read().await;
            if let Some(market) = markets.iter().find(|m| m.market_id == market_id) {
                return Ok(market.clone());
            }
        }
        
        // If not in cache, get from repository
        match self.repository.get_market(market_id).await {
            Ok(market) => {
                // Add to cache
                let mut markets = self.markets_cache.write().await;
                markets.push(market.clone());
                Ok(market)
            }
            Err(e) => Err(anyhow!("Failed to get market: {}", e)),
        }
    }
    
    /// Gets all markets
    pub async fn get_all_markets(&self) -> Result<Vec<Market>> {
        match self.repository.get_all_markets().await {
            Ok(markets) => {
                // Update cache
                let mut cache = self.markets_cache.write().await;
                *cache = markets.clone();
                Ok(markets)
            }
            Err(e) => Err(anyhow!("Failed to get markets: {}", e)),
        }
    }
    
    /// Calculates amount to reserve for an order
    fn calculate_reserve_amount(&self, order: &Order) -> Decimal {
        match order.side {
            // For buy orders, reserve price * quantity
            OrderSide::Buy => order.price * Decimal::from(order.quantity),
            
            // For sell orders, reserve quantity
            OrderSide::Sell => Decimal::from(order.quantity),
        }
    }
    
    /// Submits an order to a market
    pub async fn submit_order(&self, order: Order) -> Result<OrderMatchResult> {
        let market_id = order.market_id.clone();
        let user_id = order.user_id;
        let order_id = order.order_id;
        
        // Calculate amount to reserve
        let reserve_amount = self.calculate_reserve_amount(&order);
        
        // Reserve funds for the order
        self.balance_service.reserve_funds(
            user_id,
            reserve_amount,
            order_id
        ).await?;
        
        // Save the initial order to database
        if let Err(e) = self.repository.save_order(&order).await {
            // If saving fails, release the reserved funds
            let _ = self.balance_service.release_funds(
                user_id,
                reserve_amount,
                order_id
            ).await;
            return Err(anyhow!("Failed to save order: {}", e));
        }
        
        // Get the market from database
        let mut market = match self.get_market(&market_id).await {
            Ok(market) => market,
            Err(e) => {
                // If market not found, release the reserved funds
                let _ = self.balance_service.release_funds(
                    user_id,
                    reserve_amount,
                    order_id
                ).await;
                return Ok(OrderMatchResult {
                    order,
                    was_matched: false,
                    error: Some(format!("Market not found: {}", e)),
                });
            }
        };
        
        // Check if market is open
        if !market.is_open() {
            // Release funds if market is not open
            let _ = self.balance_service.release_funds(
                user_id,
                reserve_amount,
                order_id
            ).await;
            return Ok(OrderMatchResult {
                order,
                was_matched: false,
                error: Some("Market is not open for trading".to_string()),
            });
        }
        
        // Get matching engine but don't use it yet (matching logic to be implemented later)
        // This is a placeholder for future matching logic implementation
        let _engine = self.matching_engine.lock().await;
        
        // For now, just add to order book
        market.order_book.add_order(order.clone());
        
        // Save the updated market
        if let Err(e) = self.repository.save_market(&market).await {
            // Log error but continue
            return Err(anyhow!("Failed to save market: {}", e));
        }
        
        // Update the cache
        {
            let mut markets = self.markets_cache.write().await;
            if let Some(idx) = markets.iter().position(|m| m.market_id == market.market_id) {
                markets[idx] = market.clone();
            }
        }
        
        Ok(OrderMatchResult {
            order,
            was_matched: false,
            error: None,
        })
    }
    
    /// Cancels an order
    pub async fn cancel_order(&self, order_id: Uuid) -> Result<Order> {
        // Get the order
        let mut order = self.repository.get_order(order_id).await?;
        
        // Get the market
        let market_id = order.market_id.clone();
        let mut market = self.get_market(&market_id).await?;
        
        // Remove order from order book
        if let Some(removed_order) = market.order_book.remove_order(order_id) {
            // Mark as cancelled
            order.status = crate::models::order::OrderStatus::Cancelled;
            order.updated_at = chrono::Utc::now();
            
            // Save the updated order
            self.repository.save_order(&order).await?;
            
            // Save the updated market
            self.repository.save_market(&market).await?;
            
            // Calculate reserved amount to release
            let reserved_amount = self.calculate_reserve_amount(&removed_order);
            
            // Release the reserved funds
            self.balance_service.release_funds(
                order.user_id,
                reserved_amount,
                order_id
            ).await?;
            
            // Update the cache
            {
                let mut markets = self.markets_cache.write().await;
                if let Some(idx) = markets.iter().position(|m| m.market_id == market_id) {
                    markets[idx] = market;
                }
            }
            
            Ok(order)
        } else {
            Err(anyhow!("Order with ID {} not found in market {}", order_id, market_id))
        }
    }
    
    /// Gets all orders for a user in a market
    pub async fn get_orders_for_user(&self, market_id: &str, user_id: Uuid) -> Result<Vec<Order>> {
        self.repository.get_orders_for_user(market_id, user_id).await
            .map_err(|e| anyhow!("Failed to get orders: {}", e))
    }
} 