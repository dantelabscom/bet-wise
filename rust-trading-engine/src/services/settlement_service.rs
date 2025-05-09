use std::collections::HashMap;
use rust_decimal::Decimal;
use uuid::Uuid;
use tokio::sync::mpsc;
use log::{info, debug, error};
use std::sync::Arc;

use crate::models::{Market, MarketStatus, OutcomeSide, Trade, Order, OrderStatus};
use crate::db::connection::Repository;
use crate::services::balance_service::BalanceService;

/// Service that handles market resolution and payouts
pub struct SettlementService<R: Repository> {
    /// Sender for payout notifications
    payout_sender: mpsc::Sender<(Uuid, Decimal)>,
    
    /// Database repository
    repository: Arc<R>,
    balance_service: Arc<BalanceService<R>>,
}

impl<R: Repository> SettlementService<R> {
    /// Creates a new settlement service
    pub fn new(payout_sender: mpsc::Sender<(Uuid, Decimal)>, repository: Arc<R>, balance_service: Arc<BalanceService<R>>) -> Self {
        Self { payout_sender, repository, balance_service }
    }
    
    /// Resolves a market to a specific outcome
    pub async fn resolve_market(&self, market_id: &str, outcome: OutcomeSide) -> Result<Market, String> {
        // Get the market
        let mut market = self.repository.get_market(market_id).await
            .map_err(|e| format!("Failed to get market: {}", e))?;
        
        // Check if the market is already resolved
        if market.is_resolved() {
            return Err(format!("Market {} is already resolved", market_id));
        }
        
        // Check if the market is closed for trading
        if market.status != MarketStatus::Closed {
            return Err(format!("Market {} must be closed before resolving", market_id));
        }
        
        // Set market status to resolved
        market.resolve(outcome);
        
        // Save the updated market
        self.repository.save_market(&market).await
            .map_err(|e| format!("Failed to save resolved market: {}", e))?;
        
        // Process payouts to users with winning positions
        self.process_payouts(market_id, outcome).await?;
        
        info!("Resolved market {} to outcome {:?}", market_id, outcome);
        Ok(market)
    }
    
    /// Process all payouts for a resolved market
    async fn process_payouts(&self, market_id: &str, winning_outcome: OutcomeSide) -> Result<(), String> {
        // Get all trades for this market
        let trades = self.repository.get_trades_for_market(market_id).await
            .map_err(|e| format!("Failed to get trades for market: {}", e))?;
        
        // Process payouts for each trade
        let mut processed_users = std::collections::HashSet::new();
        
        for trade in trades {
            // Check if trade outcome matches winning outcome
            if trade.outcome != winning_outcome {
                continue;
            }
            
            // Process buyer payout if they haven't been processed yet
            if !processed_users.contains(&trade.buyer_id) {
                // For winning buyers, they get their invested amount plus profit
                let payout_amount = Decimal::from(trade.quantity) * 
                    (Decimal::ONE + (Decimal::ONE - trade.price));
                
                self.balance_service.process_payout(
                    trade.buyer_id, 
                    payout_amount, 
                    market_id
                ).await.map_err(|e| format!("Failed to process buyer payout: {}", e))?;
                
                processed_users.insert(trade.buyer_id);
                info!("Processed payout of {} to buyer {} for market {}", payout_amount, trade.buyer_id, market_id);
            }
            
            // Process seller payout if they haven't been processed yet
            if !processed_users.contains(&trade.seller_id) {
                // For winning sellers, they get back the quantity they sold
                let payout_amount = Decimal::from(trade.quantity);
                
                self.balance_service.process_payout(
                    trade.seller_id, 
                    payout_amount, 
                    market_id
                ).await.map_err(|e| format!("Failed to process seller payout: {}", e))?;
                
                processed_users.insert(trade.seller_id);
                info!("Processed payout of {} to seller {} for market {}", payout_amount, trade.seller_id, market_id);
            }
        }
        
        info!("Completed all payouts for market {}", market_id);
        Ok(())
    }
    
    /// Closes trading for a market
    pub async fn close_market(&self, market_id: &str) -> Result<Market, String> {
        // Get the market
        let mut market = self.repository.get_market(market_id).await
            .map_err(|e| format!("Failed to get market: {}", e))?;
        
        // Check if the market is already closed or resolved
        if market.status != MarketStatus::Open {
            return Err(format!("Market {} is not open", market_id));
        }
        
        // Set market status to closed
        market.close();
        
        // Save the updated market
        self.repository.save_market(&market).await
            .map_err(|e| format!("Failed to save closed market: {}", e))?;
        
        info!("Closed market {}", market_id);
        Ok(market)
    }
    
    /// Cancels a market and refunds all participants
    pub async fn cancel_market(&self, market_id: &str) -> Result<Market, String> {
        // Get the market
        let mut market = self.repository.get_market(market_id).await
            .map_err(|e| format!("Failed to get market: {}", e))?;
        
        // Check if the market is already resolved
        if market.is_resolved() {
            return Err(format!("Market {} is already resolved and cannot be cancelled", market_id));
        }
        
        // Mark the market as cancelled
        market.cancel();
        
        // Save market state to database
        self.repository.save_market(&market).await
            .map_err(|e| format!("Database error saving cancelled market: {}", e))?;
        
        // Process refunds to all participants
        self.process_market_cancellation_refunds(market_id).await?;
        
        info!("Market {} cancelled and refunds processed", market_id);
        Ok(market)
    }
    
    /// Process refunds for a cancelled market
    async fn process_market_cancellation_refunds(&self, market_id: &str) -> Result<(), String> {
        // Get all active orders for this market
        let market = self.repository.get_market(market_id).await
            .map_err(|e| format!("Failed to get market: {}", e))?;
        
        // Get orders from the order book (only active ones)
        let orders: Vec<Order> = market.order_book.yes_bids.values()
            .flat_map(|orders| orders.iter().cloned())
            .chain(market.order_book.yes_asks.values().flat_map(|orders| orders.iter().cloned()))
            .chain(market.order_book.no_bids.values().flat_map(|orders| orders.iter().cloned()))
            .chain(market.order_book.no_asks.values().flat_map(|orders| orders.iter().cloned()))
            .collect();
        
        info!("Processing refunds for {} orders in cancelled market {}", orders.len(), market_id);
        
        for order in orders {
            // Only process orders that still have remaining quantities
            if order.status == OrderStatus::Open || order.status == OrderStatus::PartiallyFilled {
                let _remaining_ratio = Decimal::from(order.remaining_quantity) / Decimal::from(order.quantity);
                
                // Different refund logic based on order side
                match order.side {
                    // For buy orders, refund price * remaining quantity
                    crate::models::OrderSide::Buy => {
                        let refund_amount = order.price * Decimal::from(order.remaining_quantity);
                        
                        if refund_amount > Decimal::ZERO {
                            self.balance_service.process_payout(
                                order.user_id,
                                refund_amount,
                                market_id
                            ).await.map_err(|e| format!("Failed to process buy refund: {}", e))?;
                            
                            info!("Refunded {} to buyer {} for cancelled order {} in market {}", 
                                refund_amount, order.user_id, order.order_id, market_id);
                        }
                    },
                    
                    // For sell orders, refund the remaining quantity
                    crate::models::OrderSide::Sell => {
                        let refund_amount = Decimal::from(order.remaining_quantity);
                        
                        if refund_amount > Decimal::ZERO {
                            self.balance_service.process_payout(
                                order.user_id,
                                refund_amount,
                                market_id
                            ).await.map_err(|e| format!("Failed to process sell refund: {}", e))?;
                            
                            info!("Refunded {} to seller {} for cancelled order {} in market {}", 
                                refund_amount, order.user_id, order.order_id, market_id);
                        }
                    }
                }
                
                // Update order status to Cancelled in database
                let mut cancelled_order = order.clone();
                cancelled_order.status = OrderStatus::Cancelled;
                self.repository.save_order(&cancelled_order).await
                    .map_err(|e| format!("Failed to update order status: {}", e))?;
            }
        }
        
        info!("Completed all refunds for cancelled market {}", market_id);
        Ok(())
    }
    
    /// Calculates payouts for all users in a market
    async fn calculate_payouts(&self, market: &Market, outcome: OutcomeSide) -> Result<HashMap<Uuid, Decimal>, String> {
        let mut payouts: HashMap<Uuid, Decimal> = HashMap::new();
        
        // Get all trades for this market from the database
        let trades = match self.repository.get_trades_for_market(&market.market_id).await {
            Ok(trades) => trades,
            Err(e) => {
                error!("Database error getting trades: {}", e);
                return Err(format!("Database error: {}", e));
            }
        };
        
        for trade in trades {
            let (yes_user_id, yes_payout, no_user_id, no_payout) = trade.calculate_payout(outcome);
            
            // Add payouts to the respective users
            if yes_payout > Decimal::ZERO {
                *payouts.entry(yes_user_id).or_insert(Decimal::ZERO) += yes_payout;
            }
            
            if no_payout > Decimal::ZERO {
                *payouts.entry(no_user_id).or_insert(Decimal::ZERO) += no_payout;
            }
        }
        
        Ok(payouts)
    }
} 
