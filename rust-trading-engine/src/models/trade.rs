use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::order::{OrderSide, OutcomeSide};

/// Represents a completed trade (match) between two orders
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    /// Unique identifier for this trade
    pub trade_id: Uuid,
    
    /// ID of the market this trade belongs to
    pub market_id: String,
    
    /// Order ID of the buyer
    pub buy_order_id: Uuid,
    
    /// User ID of the buyer
    pub buyer_id: Uuid,
    
    /// Order ID of the seller
    pub sell_order_id: Uuid,
    
    /// User ID of the seller
    pub seller_id: Uuid,
    
    /// Whether this trade is for the Yes or No outcome
    pub outcome: OutcomeSide,
    
    /// The execution price of the trade
    pub price: Decimal,
    
    /// The quantity that was traded
    pub quantity: u32,
    
    /// When the trade was executed
    pub executed_at: DateTime<Utc>,
}

impl Trade {
    /// Creates a new trade from two matched orders
    pub fn new(
        market_id: String,
        buy_order_id: Uuid,
        buyer_id: Uuid,
        sell_order_id: Uuid,
        seller_id: Uuid,
        outcome: OutcomeSide,
        price: Decimal,
        quantity: u32,
    ) -> Self {
        Self {
            trade_id: Uuid::new_v4(),
            market_id,
            buy_order_id,
            buyer_id,
            sell_order_id,
            seller_id,
            outcome,
            price,
            quantity,
            executed_at: Utc::now(),
        }
    }

    /// Gets the user ID for a particular side
    pub fn user_id_for_side(&self, side: OrderSide) -> Uuid {
        match side {
            OrderSide::Buy => self.buyer_id,
            OrderSide::Sell => self.seller_id,
        }
    }

    /// Gets the order ID for a particular side
    pub fn order_id_for_side(&self, side: OrderSide) -> Uuid {
        match side {
            OrderSide::Buy => self.buy_order_id,
            OrderSide::Sell => self.sell_order_id,
        }
    }
    
    /// Calculate the profit or loss for a user when the market is resolved
    pub fn calculate_payout(&self, winner: OutcomeSide) -> (Uuid, Decimal, Uuid, Decimal) {
        let base = Decimal::from(self.quantity);
        
        // For the yes side (if yes wins, they get full payout, otherwise zero)
        let yes_user_id = match self.outcome {
            OutcomeSide::Yes => self.buyer_id,
            OutcomeSide::No => self.seller_id,
        };
        
        // For the no side (if no wins, they get full payout, otherwise zero)
        let no_user_id = match self.outcome {
            OutcomeSide::Yes => self.seller_id,
            OutcomeSide::No => self.buyer_id,
        };
        
        // Calculate payouts based on the winner
        let (yes_payout, no_payout) = match winner {
            OutcomeSide::Yes => (base, Decimal::ZERO),
            OutcomeSide::No => (Decimal::ZERO, base),
        };
        
        (yes_user_id, yes_payout, no_user_id, no_payout)
    }
} 