use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

/// Market status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MarketStatus {
    #[serde(rename = "pending")]
    Pending,
    #[serde(rename = "open")]
    Open,
    #[serde(rename = "suspended")]
    Suspended,
    #[serde(rename = "closed")]
    Closed,
    #[serde(rename = "cancelled")]
    Cancelled,
    #[serde(rename = "settled")]
    Settled,
}

/// Market type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MarketType {
    #[serde(rename = "binary")]
    Binary,
    #[serde(rename = "multiple_winners")]
    MultipleWinners,
    #[serde(rename = "scalar")]
    Scalar,
}

/// Market resolution
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum MarketResolution {
    #[serde(rename = "yes")]
    Yes,
    #[serde(rename = "no")]
    No,
    #[serde(rename = "specific")]
    Specific(i64), // The winning option ID
    #[serde(rename = "scalar")]
    Scalar(Decimal), // The final value for scalar markets
    #[serde(rename = "cancelled")]
    Cancelled,
}

/// Market entity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Market {
    pub id: i64,
    pub name: String,
    pub description: String,
    pub market_type: MarketType,
    pub status: MarketStatus,
    pub event_id: Option<i64>, // ID of the event this market belongs to (e.g., a cricket match)
    pub event_start_time: Option<DateTime<Utc>>,
    pub event_end_time: Option<DateTime<Utc>>,
    pub resolution: Option<MarketResolution>,
    pub resolution_time: Option<DateTime<Utc>>,
    pub trading_volume: Decimal,
    pub metadata: Option<Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub options: Option<Vec<MarketOption>>,
}

/// Market option (e.g., "Yes" or "No" in a binary market)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketOption {
    pub id: i64,
    pub market_id: i64,
    pub name: String,
    pub initial_price: Decimal,
    pub current_price: Decimal,
    pub last_price: Option<Decimal>,
    pub min_price: Option<Decimal>,
    pub max_price: Option<Decimal>,
    pub metadata: Option<Value>,
    pub weight: Option<Decimal>, // For weighted markets
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Market price history entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketPriceHistory {
    pub id: i64,
    pub market_option_id: i64,
    pub price: Decimal,
    pub timestamp: DateTime<Utc>,
}

/// Market creation parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketCreationParams {
    pub name: String,
    pub description: String,
    pub market_type: MarketType,
    pub event_id: Option<i64>,
    pub event_start_time: Option<DateTime<Utc>>,
    pub event_end_time: Option<DateTime<Utc>>,
    pub metadata: Option<Value>,
    pub options: Vec<MarketOptionCreationParams>,
}

/// Market option creation parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketOptionCreationParams {
    pub name: String,
    pub initial_price: Decimal,
    pub min_price: Option<Decimal>,
    pub max_price: Option<Decimal>,
    pub metadata: Option<Value>,
    pub weight: Option<Decimal>,
}

/// Market with extended statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketWithStats {
    pub market: Market,
    pub volume_24h: Decimal,
    pub price_change_24h: HashMap<i64, Decimal>, // Option ID to price change
    pub order_count: i64,
}

/// Helper function to convert decimal odds to implied probability
pub fn calculate_implied_probability(odds: Decimal) -> Decimal {
    if odds.is_zero() {
        return Decimal::new(0, 0);
    }
    
    Decimal::new(1, 0) / odds
}

// Add SQLx implementations for MarketStatus
impl sqlx::Type<sqlx::Postgres> for MarketStatus {
    fn type_info() -> sqlx::postgres::PgTypeInfo {
        sqlx::postgres::PgTypeInfo::with_name("text")
    }
}

impl<'r> sqlx::Decode<'r, sqlx::Postgres> for MarketStatus {
    fn decode(value: sqlx::postgres::PgValueRef<'r>) -> Result<Self, sqlx::error::BoxDynError> {
        let s = <&str as sqlx::Decode<sqlx::Postgres>>::decode(value)?;
        match s {
            "open" => Ok(MarketStatus::Open),
            "suspended" => Ok(MarketStatus::Suspended),
            "closed" => Ok(MarketStatus::Closed),
            "cancelled" => Ok(MarketStatus::Cancelled),
            _ => Err(format!("Unknown market status: {}", s).into()),
        }
    }
} 