use crate::models::{Market, MarketOption, OrderSide, calculate_implied_probability};
use anyhow::Result;
use rust_decimal::Decimal;
use tracing::{debug, info};

// Cannot use constants with Decimal::new, so use statics or define them in constructor
// MIN_PRICE: 1.01 - Minimum price (highest probability ~99%)
// MAX_PRICE: 1000.0 - Maximum price (lowest probability ~0.1%)
// DEFAULT_MARKET_OVERROUND: 1.05 - 5% house edge

/// Market pricing service that implements price discovery algorithms
pub struct MarketPricer {
    min_price: Decimal,
    max_price: Decimal,
    default_overround: Decimal,
}

impl MarketPricer {
    /// Create a new market pricer
    pub fn new() -> Self {
        Self {
            min_price: Decimal::new(101, 2),      // 1.01
            max_price: Decimal::new(1000, 0),     // 1000.0
            default_overround: Decimal::new(105, 2), // 1.05
        }
    }
    
    /// Calculate new price based on market activity
    /// 
    /// # Arguments
    /// * `option` - The market option to update
    /// * `order_side` - Buy or sell
    /// * `quantity` - Quantity of the order
    /// * `current_liquidity` - Estimated market liquidity
    /// 
    /// # Returns
    /// The new price as a Decimal
    pub fn calculate_new_price(
        &self,
        option: &MarketOption,
        order_side: OrderSide,
        quantity: Decimal,
        current_liquidity: Decimal
    ) -> Decimal {
        // Current implied probability
        let current_prob = calculate_implied_probability(option.current_price);
        
        // Calculate impact factor based on order size relative to liquidity
        let impact_factor = std::cmp::min(
            Decimal::new(1, 0), 
            quantity / current_liquidity
        );
        
        // Buy orders increase price (decrease probability), sell orders decrease price (increase probability)
        let decimal_point_one = Decimal::new(1, 1); // 0.1
        let prob_change = match order_side {
            OrderSide::Buy => -current_prob * decimal_point_one * impact_factor,
            OrderSide::Sell => current_prob * decimal_point_one * impact_factor,
        };
        
        // New implied probability with limits
        let decimal_point_001 = Decimal::new(1, 3); // 0.001
        let decimal_point_99 = Decimal::new(99, 2); // 0.99
        let new_prob = std::cmp::min(
            decimal_point_99,
            std::cmp::max(decimal_point_001, current_prob + prob_change)
        );
        
        // Convert back to decimal odds
        let new_price = Decimal::new(1, 0) / new_prob;
        
        // Ensure price is within limits
        std::cmp::min(self.max_price, std::cmp::max(self.min_price, new_price))
    }
    
    /// Re-balance all option prices in a market to ensure they add up to the desired overround
    /// 
    /// # Arguments
    /// * `options` - All options in the market
    /// * `overround` - The desired overround (e.g., 1.05 for 5% house edge)
    /// 
    /// # Returns
    /// The rebalanced option prices
    pub fn rebalance_market(
        &self,
        _market: &Market,
        options: &[MarketOption],
        overround: Option<Decimal>
    ) -> Vec<MarketOption> {
        let overround = overround.unwrap_or(self.default_overround);
        
        // Calculate current implied probabilities
        let probabilities: Vec<(i64, Decimal)> = options
            .iter()
            .map(|option| {
                (option.id, calculate_implied_probability(option.current_price))
            })
            .collect();
        
        // Calculate total probability
        let total_prob = probabilities
            .iter()
            .fold(Decimal::new(0, 0), |sum, (_id, prob)| sum + prob);
        
        // Rebalance to desired overround
        options
            .iter()
            .enumerate()
            .map(|(index, option)| {
                // Normalize the probability and apply the overround
                let normalized_prob = (probabilities[index].1 / total_prob) * overround;
                
                // Calculate new price (decimal odds) from probability
                let new_price = std::cmp::min(
                    self.max_price, 
                    std::cmp::max(self.min_price, Decimal::new(1, 0) / normalized_prob)
                );
                
                // Create a new option with updated price
                MarketOption {
                    current_price: new_price,
                    last_price: Some(option.current_price),
                    ..option.clone()
                }
            })
            .collect()
    }
    
    /// Process a market order and calculate price updates
    /// 
    /// # Arguments
    /// * `market` - The market
    /// * `option_id` - The option ID being traded
    /// * `side` - Buy or sell
    /// * `quantity` - The quantity of the order
    /// 
    /// # Returns
    /// A vector of updated market options
    pub fn process_market_order(
        &self,
        market: &Market,
        option_id: i64,
        side: OrderSide,
        quantity: Decimal
    ) -> Result<Vec<MarketOption>> {
        if let Some(options) = &market.options {
            // Find the option being traded
            if let Some(option_index) = options.iter().position(|o| o.id == option_id) {
                let option = &options[option_index];
                
                // Estimate market liquidity based on trading volume
                let market_liquidity = std::cmp::max(
                    Decimal::new(1000, 0), 
                    market.trading_volume
                );
                
                // Calculate new price based on the order
                let new_price = self.calculate_new_price(
                    option, 
                    side, 
                    quantity, 
                    market_liquidity
                );
                
                debug!(
                    "Calculated new price for option {}: {} -> {}", 
                    option.id, option.current_price, new_price
                );
                
                // Create a temporary list of options with the updated price
                let mut updated_options = options.clone();
                updated_options[option_index].last_price = Some(updated_options[option_index].current_price);
                updated_options[option_index].current_price = new_price;
                
                // Rebalance all options
                let rebalanced_options = self.rebalance_market(market, &updated_options, None);
                
                info!("Processed order: option_id={}, side={:?}, quantity={}, new_price={}", 
                    option_id, side, quantity, new_price);
                
                return Ok(rebalanced_options);
            }
        }
        
        anyhow::bail!("Option or market not found")
    }
} 