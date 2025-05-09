use std::env;
use std::time::Duration;
use anyhow::Result;
use sqlx::postgres::{PgPool, PgPoolOptions};
use log::{info, error};

/// Creates and returns a connection pool for PostgreSQL using SQLx
pub async fn create_pg_pool() -> Result<PgPool> {
    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL environment variable must be set");
    
    info!("Connecting to PostgreSQL database...");
    
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .acquire_timeout(Duration::from_secs(30))
        .connect(&database_url)
        .await?;
    
    info!("Successfully connected to PostgreSQL database");
    
    // Test the connection
    let result = sqlx::query!("SELECT 1 as one")
        .fetch_one(&pool)
        .await;
        
    match result {
        Ok(_) => info!("Database connection test successful"),
        Err(e) => error!("Database connection test failed: {}", e),
    }
    
    Ok(pool)
}

/// Repository trait for database operations
#[async_trait::async_trait]
pub trait Repository {
    /// Gets a market by ID
    async fn get_market(&self, market_id: &str) -> Result<crate::models::Market>;
    
    /// Gets all markets
    async fn get_all_markets(&self) -> Result<Vec<crate::models::Market>>;
    
    /// Saves a market
    async fn save_market(&self, market: &crate::models::Market) -> Result<()>;
    
    /// Gets an order by ID
    async fn get_order(&self, order_id: uuid::Uuid) -> Result<crate::models::order::Order>;
    
    /// Gets all orders for a user in a market
    async fn get_orders_for_user(&self, market_id: &str, user_id: uuid::Uuid) -> Result<Vec<crate::models::order::Order>>;
    
    /// Saves an order
    async fn save_order(&self, order: &crate::models::order::Order) -> Result<()>;
    
    /// Gets all trades for a market
    async fn get_trades_for_market(&self, market_id: &str) -> Result<Vec<crate::models::trade::Trade>>;
    
    /// Gets a user balance
    async fn get_user_balance(&self, user_id: uuid::Uuid) -> Result<crate::models::balance::UserBalance>;
    
    /// Saves a user balance
    async fn save_user_balance(&self, balance: &crate::models::balance::UserBalance) -> Result<()>;
    
    /// Saves a balance transaction
    async fn save_balance_transaction(&self, transaction: &crate::models::balance::BalanceTransaction) -> Result<()>;
    
    /// Gets all balance transactions for a user
    async fn get_balance_transactions_for_user(&self, user_id: uuid::Uuid) -> Result<Vec<crate::models::balance::BalanceTransaction>>;
} 