use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use log::{info, debug, error};
use rand::Rng;
use rust_decimal::Decimal;
use tokio::sync::Mutex;
use tokio::time;
use uuid::Uuid;

use crate::models::{Market, Order, OrderSide, OutcomeSide};
use crate::services::order_service::OrderService;
use crate::db::connection::Repository;

/// Configuration for a trading bot
pub struct BotConfig {
    /// ID of the bot user
    pub bot_user_id: Uuid,
    
    /// How often the bot should place orders (in milliseconds)
    pub interval_ms: u64,
    
    /// Maximum spread the bot will maintain
    pub max_spread: Decimal,
    
    /// Size of orders the bot will place
    pub order_size: u32,
    
    /// Random jitter to add to prices (0.0 - 1.0)
    pub price_jitter: Decimal,
}

impl Default for BotConfig {
    fn default() -> Self {
        Self {
            bot_user_id: Uuid::new_v4(),
            interval_ms: 5000,
            max_spread: Decimal::new(1, 1), // 0.1
            order_size: 10,
            price_jitter: Decimal::new(2, 2), // 0.02
        }
    }
}

/// Trading strategy implemented by a bot
#[derive(Debug)]
pub enum BotStrategy {
    /// Simple market maker strategy that maintains a spread around mid price
    MarketMaker,
    
    /// Random noise trader strategy
    NoiseTrader,
}

/// Service for running trading bots to provide market liquidity
pub struct BotService<R: Repository> {
    /// Order service for placing orders
    order_service: Arc<OrderService<R>>,
    
    /// Bot configuration
    config: BotConfig,
    
    /// Active bots per market
    active_bots: Arc<Mutex<HashMap<String, BotStrategy>>>,
}

impl<R: Repository + Send + Sync + 'static> BotService<R> {
    /// Creates a new bot service
    pub fn new(order_service: Arc<OrderService<R>>, config: BotConfig) -> Self {
        Self {
            order_service,
            config,
            active_bots: Arc::new(Mutex::new(HashMap::new())),
        }
    }
    
    /// Starts a bot for a specific market
    pub async fn start_bot(&self, market_id: String, strategy: BotStrategy) -> Result<(), String> {
        let mut bots = self.active_bots.lock().await;
        
        if bots.contains_key(&market_id) {
            return Err(format!("Bot already running for market {}", market_id));
        }
        
        bots.insert(market_id.clone(), strategy.clone());
        
        // Clone necessary data for the bot task
        let market_id_clone = market_id.clone();
        let order_service = Arc::clone(&self.order_service);
        let active_bots = Arc::clone(&self.active_bots);
        let config = self.config.clone();
        let strategy_clone = strategy.clone(); // Clone strategy for use in log message
        
        // Spawn a task for this bot
        tokio::spawn(async move {
            Self::run_bot_loop(
                market_id_clone,
                strategy,
                order_service,
                active_bots,
                config,
            ).await;
        });
        
        info!("Started {:?} bot for market {}", strategy_clone, market_id);
        Ok(())
    }
    
    /// Stops a bot for a specific market
    pub async fn stop_bot(&self, market_id: &str) -> Result<(), String> {
        let mut bots = self.active_bots.lock().await;
        
        if bots.remove(market_id).is_some() {
            info!("Stopped bot for market {}", market_id);
            Ok(())
        } else {
            Err(format!("No bot running for market {}", market_id))
        }
    }
    
    /// The main bot execution loop
    async fn run_bot_loop(
        market_id: String,
        strategy: BotStrategy,
        order_service: Arc<OrderService<R>>,
        active_bots: Arc<Mutex<HashMap<String, BotStrategy>>>,
        config: BotConfig,
    ) {
        let mut interval = time::interval(Duration::from_millis(config.interval_ms));
        
        loop {
            interval.tick().await;
            
            // Check if bot should still be running
            {
                let bots = active_bots.lock().await;
                if !bots.contains_key(&market_id) {
                    break;
                }
            }
            
            // Get market data
            let market_result = order_service.get_market(&market_id).await;
            
            match market_result {
                Ok(market) => {
                    // Execute bot strategy
                    if let Err(e) = Self::execute_strategy(
                        &strategy,
                        &market,
                        &order_service,
                        &config,
                    ).await {
                        error!("Bot strategy execution error: {}", e);
                    }
                }
                Err(e) => {
                    error!("Bot couldn't access market {}: {}", market_id, e);
                    
                    // If market doesn't exist, stop the bot
                    if let Err(e) = {
                        let mut bots = active_bots.lock().await;
                        bots.remove(&market_id);
                        Ok::<(), String>(())
                    } {
                        error!("Error stopping bot: {}", e);
                    }
                    
                    break;
                }
            }
        }
        
        debug!("Bot loop for market {} terminated", market_id);
    }
    
    /// Executes a specific bot strategy
    async fn execute_strategy(
        strategy: &BotStrategy,
        market: &Market,
        order_service: &OrderService<R>,
        config: &BotConfig,
    ) -> Result<(), String> {
        match strategy {
            BotStrategy::MarketMaker => {
                Self::execute_market_maker_strategy(market, order_service, config).await
            }
            BotStrategy::NoiseTrader => {
                Self::execute_noise_trader_strategy(market, order_service, config).await
            }
        }
    }
    
    /// Executes the market maker strategy
    async fn execute_market_maker_strategy(
        market: &Market,
        order_service: &OrderService<R>,
        config: &BotConfig,
    ) -> Result<(), String> {
        // Get current midpoint price for Yes outcome
        let mid_price = market.get_implied_probability()
            .unwrap_or(Decimal::new(5, 1)); // Default to 0.5
            
        // Calculate bid and ask prices with spread
        let half_spread = config.max_spread / Decimal::new(2, 0);
        
        // Add small random jitter to prices - create a local RNG that doesn't cross await points
        let jitter = {
            let mut rng = rand::thread_rng();
            Decimal::new(rng.gen_range(0..100) as i64, 4) // Random 0.0000 to 0.0100
        };
        
        // Make sure prices stay in valid range (0.01 to 0.99)
        let bid_price = (mid_price - half_spread + jitter)
            .max(Decimal::new(1, 2))
            .min(Decimal::new(99, 2));
            
        let ask_price = (mid_price + half_spread + jitter)
            .max(Decimal::new(1, 2))
            .min(Decimal::new(99, 2));
            
        // Place bid order for Yes
        let bid_order = Order::new(
            config.bot_user_id,
            market.market_id.clone(),
            OrderSide::Buy,
            OutcomeSide::Yes,
            bid_price,
            config.order_size,
        );
        
        // Place ask order for Yes
        let ask_order = Order::new(
            config.bot_user_id,
            market.market_id.clone(),
            OrderSide::Sell,
            OutcomeSide::Yes,
            ask_price,
            config.order_size,
        );
        
        // Submit orders
        let bid_result = order_service.submit_order(bid_order).await;
        let ask_result = order_service.submit_order(ask_order).await;
        
        if let Err(e) = bid_result {
            return Err(format!("Failed to place bid order: {}", e));
        }
        
        if let Err(e) = ask_result {
            return Err(format!("Failed to place ask order: {}", e));
        }
        
        Ok(())
    }
    
    /// Executes the noise trader strategy
    async fn execute_noise_trader_strategy(
        market: &Market,
        order_service: &OrderService<R>,
        config: &BotConfig,
    ) -> Result<(), String> {
        // Do all random operations before any await points
        let random_ops = {
            let mut rng = rand::thread_rng();
            
            // Get current midpoint price for Yes outcome
            let mid_price = market.get_implied_probability()
                .unwrap_or(Decimal::new(5, 1)); // Default to 0.5
                
            // Random decision to buy or sell
            let side = if rng.gen_bool(0.5) {
                OrderSide::Buy
            } else {
                OrderSide::Sell
            };
            
            // Random price with jitter around mid
            let jitter_pct = config.price_jitter * Decimal::from(rng.gen_range(-100..100)) / Decimal::new(100, 0);
            let price = (mid_price * (Decimal::new(1, 0) + jitter_pct))
                .max(Decimal::new(1, 2))
                .min(Decimal::new(99, 2));
                
            // Random size within 50-150% of configured order size
            let size_factor = rng.gen_range(50..150) as u32;
            let size = (config.order_size * size_factor) / 100;
            
            // Random outcome
            let outcome = if rng.gen_bool(0.5) {
                OutcomeSide::Yes
            } else {
                OutcomeSide::No
            };
            
            (side, outcome, price, size)
        };
        
        let (side, outcome, price, size) = random_ops;
        
        // Create the order
        let order = Order::new(
            config.bot_user_id,
            market.market_id.clone(),
            side,
            outcome,
            price,
            size,
        );
        
        // Submit the order
        let result = order_service.submit_order(order).await;
        
        if let Err(e) = result {
            return Err(format!("Failed to place noise trader order: {}", e));
        }
        
        Ok(())
    }
}

impl Clone for BotConfig {
    fn clone(&self) -> Self {
        Self {
            bot_user_id: self.bot_user_id,
            interval_ms: self.interval_ms,
            max_spread: self.max_spread,
            order_size: self.order_size,
            price_jitter: self.price_jitter,
        }
    }
}

impl Clone for BotStrategy {
    fn clone(&self) -> Self {
        match self {
            BotStrategy::MarketMaker => BotStrategy::MarketMaker,
            BotStrategy::NoiseTrader => BotStrategy::NoiseTrader,
        }
    }
} 