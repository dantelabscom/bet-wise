use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Order types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OrderType {
    #[serde(rename = "limit")]
    Limit,
    #[serde(rename = "market")]
    Market,
}

/// Order sides
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OrderSide {
    #[serde(rename = "buy")]
    Buy,
    #[serde(rename = "sell")]
    Sell,
}

/// Order status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OrderStatus {
    #[serde(rename = "open")]
    Open,
    #[serde(rename = "partially_filled")]
    PartiallyFilled,
    #[serde(rename = "filled")]
    Filled,
    #[serde(rename = "cancelled")]
    Cancelled,
    #[serde(rename = "rejected")]
    Rejected,
    #[serde(rename = "expired")]
    Expired,
}

/// Add Display implementation for OrderStatus
impl std::fmt::Display for OrderStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            OrderStatus::Open => write!(f, "open"),
            OrderStatus::PartiallyFilled => write!(f, "partially_filled"),
            OrderStatus::Filled => write!(f, "filled"),
            OrderStatus::Cancelled => write!(f, "cancelled"),
        }
    }
}

/// Order entity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    pub id: Uuid,
    pub user_id: Uuid,
    pub market_id: i64,
    pub market_option_id: i64,
    pub order_type: OrderType,
    pub side: OrderSide,
    pub price: Decimal,
    pub quantity: Decimal,
    pub filled_quantity: Decimal,
    pub status: OrderStatus,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Parameters for creating a new order
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderCreationParams {
    pub user_id: Uuid,
    pub market_id: i64,
    pub market_option_id: i64,
    pub order_type: OrderType,
    pub side: OrderSide,
    pub price: Decimal,
    pub quantity: Decimal,
    pub expires_at: Option<DateTime<Utc>>,
}

/// Order book entry (aggregated orders at a price level)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderBookEntry {
    pub price: Decimal,
    pub quantity: Decimal,
    pub order_count: i32,
}

/// Order match record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderMatch {
    pub taker_order_id: Uuid,
    pub maker_order_id: Uuid,
    pub price: Decimal,
    pub quantity: Decimal,
    pub timestamp: DateTime<Utc>,
}

/// Complete order book for a market
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderBook {
    pub market_id: i64,
    pub market_option_id: i64,
    pub buy_orders: Vec<OrderBookEntry>,
    pub sell_orders: Vec<OrderBookEntry>,
    pub last_price: Option<Decimal>,
    pub last_updated: DateTime<Utc>,
}

/// Trade result after matching an order
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeResult {
    pub order_id: Uuid,
    pub matches: Vec<OrderMatch>,
    pub filled_quantity: Decimal,
    pub average_price: Decimal,
    pub status: OrderStatus,
    pub remaining_quantity: Decimal,
} 