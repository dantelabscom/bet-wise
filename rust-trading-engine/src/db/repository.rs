use anyhow::{Result, anyhow};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use uuid::Uuid;
use sqlx::postgres::PgPool;
use log::{debug, info, error};

use crate::models::market::{Market, MarketStatus};
use crate::models::order::{Order, OrderSide, OrderStatus, OutcomeSide};
use crate::models::trade::Trade;
use crate::models::balance::{UserBalance, BalanceTransaction, TransactionType};
use crate::db::connection::Repository;

/// Repository for database operations using SQLx
pub struct SqlxRepository {
    pool: PgPool,
}

#[async_trait::async_trait]
impl Repository for SqlxRepository {
    /// Gets a market by ID
    async fn get_market(&self, market_id: &str) -> Result<Market> {
        // Get the market
        let market_row = sqlx::query!(
            r#"
            SELECT 
                id, question, description, status, 
                created_at, updated_at, close_time, 
                resolved_at, resolution
            FROM markets 
            WHERE id = $1
            "#,
            market_id
        )
        .fetch_one(&self.pool)
        .await?;
        
        // Get all active orders for this market
        let orders = self.get_active_orders_for_market(market_id).await?;
        
        // Create market from database row
        let market = Market::from_db(
            market_row.id,
            market_row.question,
            market_row.description,
            MarketStatus::from(market_row.status),
            market_row.created_at,
            market_row.updated_at,
            market_row.close_time,
            market_row.resolved_at,
            market_row.resolution.map(|r| OutcomeSide::from(r)),
            orders,
        );
        
        Ok(market)
    }
    
    /// Gets all markets
    async fn get_all_markets(&self) -> Result<Vec<Market>> {
        // Get all markets
        let market_rows = sqlx::query!(
            r#"
            SELECT 
                id, question, description, status, 
                created_at, updated_at, close_time, 
                resolved_at, resolution
            FROM markets
            "#
        )
        .fetch_all(&self.pool)
        .await?;
        
        // For each market, get its active orders
        let mut results = Vec::new();
        
        for market_row in market_rows {
            let market_id = &market_row.id;
            
            // Get active orders for this market
            let orders = self.get_active_orders_for_market(market_id).await?;
            
            // Create market from database row
            let market = Market::from_db(
                market_row.id,
                market_row.question,
                market_row.description,
                MarketStatus::from(market_row.status),
                market_row.created_at,
                market_row.updated_at,
                market_row.close_time,
                market_row.resolved_at,
                market_row.resolution.map(|r| OutcomeSide::from(r)),
                orders,
            );
            
            results.push(market);
        }
        
        Ok(results)
    }
    
    /// Saves a market to the database
    async fn save_market(&self, market: &Market) -> Result<()> {
        // Save a market to the database
        let result: Result<sqlx::postgres::PgQueryResult, sqlx::Error> = sqlx::query!(
            r#"
            INSERT INTO markets (
                id, question, description, status, 
                created_at, updated_at, close_time, 
                resolved_at, resolution
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO UPDATE SET
                question = $2,
                description = $3,
                status = $4,
                updated_at = $6,
                close_time = $7,
                resolved_at = $8,
                resolution = $9
            "#,
            market.market_id,
            market.question,
            market.description,
            i32::from(market.status),
            market.created_at,
            market.updated_at,
            market.close_time,
            market.resolved_at,
            market.resolution.map(|r| i32::from(r))
        )
        .execute(&self.pool)
        .await;
            
        match result {
            Ok(_) => {
                debug!("Saved market {}", market.market_id);
                Ok(())
            }
            Err(e) => {
                error!("Failed to save market {}: {}", market.market_id, e);
                Err(anyhow!(e))
            }
        }
    }
    
    /// Gets an order by ID
    async fn get_order(&self, order_id: Uuid) -> Result<Order> {
        let order_row = sqlx::query!(
            r#"
            SELECT 
                id, user_id, market_id, side, outcome, 
                price, quantity, remaining_quantity, status,
                created_at, updated_at
            FROM orders
            WHERE id = $1
            "#,
            order_id.to_string()
        )
        .fetch_one(&self.pool)
        .await?;
        
        let order = Order {
            order_id: Uuid::parse_str(&order_row.id)?,
            user_id: Uuid::parse_str(&order_row.user_id)?,
            market_id: order_row.market_id,
            side: OrderSide::from(order_row.side),
            outcome: OutcomeSide::from(order_row.outcome),
            price: order_row.price,
            quantity: order_row.quantity as u32,
            remaining_quantity: order_row.remaining_quantity as u32,
            status: OrderStatus::from(order_row.status),
            created_at: order_row.created_at,
            updated_at: order_row.updated_at,
        };
        
        Ok(order)
    }
    
    /// Gets all orders for a user in a market
    async fn get_orders_for_user(&self, market_id: &str, user_id: Uuid) -> Result<Vec<Order>> {
        let order_rows = sqlx::query!(
            r#"
            SELECT 
                id, user_id, market_id, side, outcome, 
                price, quantity, remaining_quantity, status,
                created_at, updated_at
            FROM orders
            WHERE market_id = $1 AND user_id = $2
            "#,
            market_id,
            user_id.to_string()
        )
        .fetch_all(&self.pool)
        .await?;
        
        let orders = order_rows.into_iter().map(|row| {
            Order {
                order_id: Uuid::parse_str(&row.id).unwrap_or_else(|_| Uuid::nil()),
                user_id: Uuid::parse_str(&row.user_id).unwrap_or_else(|_| Uuid::nil()),
                market_id: row.market_id,
                side: OrderSide::from(row.side),
                outcome: OutcomeSide::from(row.outcome),
                price: row.price,
                quantity: row.quantity as u32,
                remaining_quantity: row.remaining_quantity as u32,
                status: OrderStatus::from(row.status),
                created_at: row.created_at,
                updated_at: row.updated_at,
            }
        }).collect();
        
        Ok(orders)
    }
    
    /// Saves an order to the database
    async fn save_order(&self, order: &Order) -> Result<()> {
        // Save an order to the database
        let result: Result<sqlx::postgres::PgQueryResult, sqlx::Error> = sqlx::query!(
            r#"
            INSERT INTO orders (
                id, user_id, market_id, side, outcome, 
                price, quantity, remaining_quantity, status,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (id) DO UPDATE SET
                side = $4,
                outcome = $5,
                price = $6,
                quantity = $7,
                remaining_quantity = $8,
                status = $9,
                updated_at = $11
            "#,
            order.order_id.to_string(),
            order.user_id.to_string(),
            order.market_id,
            i32::from(order.side),
            i32::from(order.outcome),
            order.price,
            order.quantity as i32,
            order.remaining_quantity as i32,
            i32::from(order.status),
            order.created_at,
            order.updated_at
        )
        .execute(&self.pool)
        .await;
            
        match result {
            Ok(_) => {
                debug!("Saved order {}", order.order_id);
                Ok(())
            }
            Err(e) => {
                error!("Failed to save order {}: {}", order.order_id, e);
                Err(anyhow!(e))
            }
        }
    }
    
    /// Gets all trades for a market
    async fn get_trades_for_market(&self, market_id: &str) -> Result<Vec<Trade>> {
        let trade_rows = sqlx::query!(
            r#"
            SELECT 
                id, market_id, buy_order_id, buyer_id, 
                sell_order_id, seller_id, outcome, 
                price, quantity, executed_at
            FROM trades
            WHERE market_id = $1
            "#,
            market_id
        )
        .fetch_all(&self.pool)
        .await?;
        
        let trades = trade_rows.into_iter().map(|row| {
            Trade {
                trade_id: Uuid::parse_str(&row.id).unwrap_or_else(|_| Uuid::nil()),
                market_id: row.market_id,
                buy_order_id: Uuid::parse_str(&row.buy_order_id).unwrap_or_else(|_| Uuid::nil()),
                buyer_id: Uuid::parse_str(&row.buyer_id).unwrap_or_else(|_| Uuid::nil()),
                sell_order_id: Uuid::parse_str(&row.sell_order_id).unwrap_or_else(|_| Uuid::nil()),
                seller_id: Uuid::parse_str(&row.seller_id).unwrap_or_else(|_| Uuid::nil()),
                outcome: OutcomeSide::from(row.outcome),
                price: row.price,
                quantity: row.quantity as u32,
                executed_at: row.executed_at,
            }
        }).collect();
        
        Ok(trades)
    }
    
    /// Gets a user balance
    async fn get_user_balance(&self, user_id: Uuid) -> Result<UserBalance> {
        let balance_row = sqlx::query!(
            r#"
            SELECT 
                user_id, available_balance, 
                reserved_balance, updated_at
            FROM user_balances
            WHERE user_id = $1
            "#,
            user_id.to_string()
        )
        .fetch_one(&self.pool)
        .await?;
        
        let balance = UserBalance {
            user_id: Uuid::parse_str(&balance_row.user_id)?,
            available_balance: balance_row.available_balance,
            reserved_balance: balance_row.reserved_balance,
            updated_at: balance_row.updated_at,
        };
        
        Ok(balance)
    }
    
    /// Saves a user balance to the database
    async fn save_user_balance(&self, balance: &UserBalance) -> Result<()> {
        // Save a user balance to the database
        let result: Result<sqlx::postgres::PgQueryResult, sqlx::Error> = sqlx::query!(
            r#"
            INSERT INTO user_balances (
                user_id, available_balance, reserved_balance, updated_at
            )
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id) DO UPDATE SET
                available_balance = $2,
                reserved_balance = $3,
                updated_at = $4
            "#,
            balance.user_id.to_string(),
            balance.available_balance,
            balance.reserved_balance,
            balance.updated_at
        )
        .execute(&self.pool)
        .await;
            
        match result {
            Ok(_) => {
                debug!("Saved user balance for user {}", balance.user_id);
                Ok(())
            }
            Err(e) => {
                error!("Failed to save user balance for user {}: {}", balance.user_id, e);
                Err(anyhow!(e))
            }
        }
    }
    
    /// Saves a balance transaction to the database
    async fn save_balance_transaction(&self, transaction: &BalanceTransaction) -> Result<()> {
        // Save a balance transaction to the database
        let result: Result<sqlx::postgres::PgQueryResult, sqlx::Error> = sqlx::query!(
            r#"
            INSERT INTO balance_transactions (
                id, user_id, amount, transaction_type, 
                reference_id, description, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#,
            transaction.transaction_id.to_string(),
            transaction.user_id.to_string(),
            transaction.amount,
            i32::from(transaction.transaction_type),
            transaction.reference_id,
            transaction.description,
            transaction.created_at
        )
        .execute(&self.pool)
        .await;
            
        match result {
            Ok(_) => {
                debug!("Saved balance transaction {}", transaction.transaction_id);
                Ok(())
            }
            Err(e) => {
                error!("Failed to save balance transaction {}: {}", transaction.transaction_id, e);
                Err(anyhow!(e))
            }
        }
    }
    
    /// Gets all balance transactions for a user
    async fn get_balance_transactions_for_user(&self, user_id: Uuid) -> Result<Vec<BalanceTransaction>> {
        let transaction_rows = sqlx::query!(
            r#"
            SELECT 
                id, user_id, amount, transaction_type, 
                reference_id, description, created_at
            FROM balance_transactions
            WHERE user_id = $1
            ORDER BY created_at DESC
            "#,
            user_id.to_string()
        )
        .fetch_all(&self.pool)
        .await?;
        
        let transactions = transaction_rows.into_iter().map(|row| {
            BalanceTransaction {
                transaction_id: Uuid::parse_str(&row.id).unwrap_or_else(|_| Uuid::nil()),
                user_id: Uuid::parse_str(&row.user_id).unwrap_or_else(|_| Uuid::nil()),
                amount: row.amount,
                transaction_type: TransactionType::from(row.transaction_type),
                reference_id: row.reference_id,
                description: row.description,
                created_at: row.created_at,
            }
        }).collect();
        
        Ok(transactions)
    }
}

impl SqlxRepository {
    /// Creates a new repository
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
    
    /// Helper method to get active orders for a market
    async fn get_active_orders_for_market(&self, market_id: &str) -> Result<Vec<Order>> {
        let order_rows = sqlx::query!(
            r#"
            SELECT 
                id, user_id, market_id, side, outcome, 
                price, quantity, remaining_quantity, status,
                created_at, updated_at
            FROM orders
            WHERE market_id = $1 AND status < 3
            "#,
            market_id
        )
        .fetch_all(&self.pool)
        .await?;
        
        let orders = order_rows.into_iter().map(|row| {
            Order {
                order_id: Uuid::parse_str(&row.id).unwrap_or_else(|_| Uuid::nil()),
                user_id: Uuid::parse_str(&row.user_id).unwrap_or_else(|_| Uuid::nil()),
                market_id: row.market_id,
                side: OrderSide::from(row.side),
                outcome: OutcomeSide::from(row.outcome),
                price: row.price,
                quantity: row.quantity as u32,
                remaining_quantity: row.remaining_quantity as u32,
                status: OrderStatus::from(row.status),
                created_at: row.created_at,
                updated_at: row.updated_at,
            }
        }).collect();
        
        Ok(orders)
    }
} 