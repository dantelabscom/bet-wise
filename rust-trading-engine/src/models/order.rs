use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Side of an order (buy or sell)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OrderSide {
    /// Buy order (bid)
    Buy,
    
    /// Sell order (ask)
    Sell,
}

impl From<i32> for OrderSide {
    fn from(value: i32) -> Self {
        match value {
            0 => OrderSide::Buy,
            1 => OrderSide::Sell,
            _ => panic!("Invalid OrderSide value: {}", value),
        }
    }
}

impl From<OrderSide> for i32 {
    fn from(value: OrderSide) -> Self {
        match value {
            OrderSide::Buy => 0,
            OrderSide::Sell => 1,
        }
    }
}

/// Side of market outcome (yes or no)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OutcomeSide {
    /// Yes outcome
    Yes,
    
    /// No outcome
    No,
}

impl From<i32> for OutcomeSide {
    fn from(value: i32) -> Self {
        match value {
            0 => OutcomeSide::Yes,
            1 => OutcomeSide::No,
            _ => panic!("Invalid OutcomeSide value: {}", value),
        }
    }
}

impl From<OutcomeSide> for i32 {
    fn from(value: OutcomeSide) -> Self {
        match value {
            OutcomeSide::Yes => 0,
            OutcomeSide::No => 1,
        }
    }
}

/// Status of an order in the market
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OrderStatus {
    /// Order is open and can be matched
    Open,
    
    /// Order has been partially filled
    PartiallyFilled,
    
    /// Order has been completely filled
    Filled,
    
    /// Order has been cancelled
    Cancelled,
    
    /// Order was rejected
    Rejected,
}

impl From<i32> for OrderStatus {
    fn from(value: i32) -> Self {
        match value {
            0 => OrderStatus::Open,
            1 => OrderStatus::PartiallyFilled,
            2 => OrderStatus::Filled,
            3 => OrderStatus::Cancelled,
            4 => OrderStatus::Rejected,
            _ => panic!("Invalid OrderStatus value: {}", value),
        }
    }
}

impl From<OrderStatus> for i32 {
    fn from(value: OrderStatus) -> Self {
        match value {
            OrderStatus::Open => 0,
            OrderStatus::PartiallyFilled => 1,
            OrderStatus::Filled => 2,
            OrderStatus::Cancelled => 3,
            OrderStatus::Rejected => 4,
        }
    }
}

/// A trading order in the prediction market
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    /// Unique identifier for this order
    pub order_id: Uuid,
    
    /// ID of the user who placed this order
    pub user_id: Uuid,
    
    /// ID of the market this order belongs to
    pub market_id: String,
    
    /// Whether this is a buy or sell order
    pub side: OrderSide,
    
    /// Whether this order is for the Yes or No outcome
    pub outcome: OutcomeSide,
    
    /// Price of the order (between 0.0 and 1.0)
    pub price: Decimal,
    
    /// Total quantity of shares
    pub quantity: u32,
    
    /// Remaining quantity to be filled
    pub remaining_quantity: u32,
    
    /// Current status of the order
    pub status: OrderStatus,
    
    /// When the order was created
    pub created_at: DateTime<Utc>,
    
    /// When the order was last updated
    pub updated_at: DateTime<Utc>,
}

impl Order {
    /// Creates a new order
    pub fn new(
        user_id: Uuid,
        market_id: String,
        side: OrderSide,
        outcome: OutcomeSide,
        price: Decimal,
        quantity: u32,
    ) -> Self {
        let now = Utc::now();
        Self {
            order_id: Uuid::new_v4(),
            user_id,
            market_id,
            side,
            outcome,
            price,
            quantity,
            remaining_quantity: quantity,
            status: OrderStatus::Open,
            created_at: now,
            updated_at: now,
        }
    }

    /// Checks if this order can be matched with another order
    pub fn can_match_with(&self, other: &Order) -> bool {
        // Orders must be for the same market
        if self.market_id != other.market_id {
            return false;
        }

        // Orders must be for the same outcome
        if self.outcome != other.outcome {
            return false;
        }

        // Orders must be on opposite sides
        if self.side == other.side {
            return false;
        }

        // A user cannot match with themselves
        if self.user_id == other.user_id {
            return false;
        }

        // Check if prices are compatible
        match (self.side, other.side) {
            (OrderSide::Buy, OrderSide::Sell) => self.price >= other.price,
            (OrderSide::Sell, OrderSide::Buy) => self.price <= other.price,
            _ => false,
        }
    }

    /// Updates the order after a partial fill
    pub fn apply_fill(&mut self, fill_quantity: u32) {
        if fill_quantity >= self.remaining_quantity {
            self.remaining_quantity = 0;
            self.status = OrderStatus::Filled;
        } else {
            self.remaining_quantity -= fill_quantity;
            self.status = OrderStatus::PartiallyFilled;
        }
        self.updated_at = Utc::now();
    }

    /// Cancels this order
    pub fn cancel(&mut self) {
        self.status = OrderStatus::Cancelled;
        self.updated_at = Utc::now();
    }

    /// Checks if this order is still active (can be matched)
    pub fn is_active(&self) -> bool {
        matches!(self.status, OrderStatus::Open | OrderStatus::PartiallyFilled)
    }
} 