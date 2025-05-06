use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Position record for a user in a market option
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub id: Uuid,
    pub user_id: Uuid,
    pub market_id: i64,
    pub market_option_id: i64,
    pub quantity: Decimal,
    pub average_entry_price: Decimal,
    pub realized_pnl: Decimal,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Position delta (change) from a trade
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PositionDelta {
    pub market_id: i64,
    pub market_option_id: i64,
    pub quantity_delta: Decimal,
    pub price: Decimal,
    pub timestamp: DateTime<Utc>,
}

/// Position update params
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PositionUpdateParams {
    pub user_id: Uuid,
    pub market_id: i64,
    pub market_option_id: i64,
    pub quantity_delta: Decimal,
    pub price: Decimal,
}

/// Position summary for a user with profit/loss calculation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PositionSummary {
    pub position: Position,
    pub current_price: Option<Decimal>,
    pub market_value: Option<Decimal>,
    pub unrealized_pnl: Option<Decimal>,
    pub unrealized_pnl_percentage: Option<Decimal>,
    pub total_pnl: Option<Decimal>,
} 