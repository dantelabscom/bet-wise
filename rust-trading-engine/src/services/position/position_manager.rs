use crate::models::{Position, PositionDelta, PositionUpdateParams, OrderSide};
use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use tracing::info;
use uuid::Uuid;

/// Service for managing user positions
pub struct PositionManager {
    // Any state needed
}

impl PositionManager {
    /// Create a new position manager
    pub fn new() -> Self {
        Self {}
    }
    
    /// Calculate position delta based on a trade
    pub fn calculate_position_delta(
        &self,
        side: OrderSide,
        quantity: Decimal,
        price: Decimal
    ) -> PositionDelta {
        // For buy orders, position increases by quantity
        // For sell orders, position decreases by quantity
        let quantity_delta = match side {
            OrderSide::Buy => quantity,
            OrderSide::Sell => -quantity,
        };
        
        PositionDelta {
            market_id: 0, // This will be set by the caller
            market_option_id: 0, // This will be set by the caller
            quantity_delta,
            price,
            timestamp: Utc::now(),
        }
    }
    
    /// Calculate the new average entry price when a position is modified
    pub fn calculate_new_average_entry_price(
        &self,
        current_position: &Position,
        delta: &PositionDelta
    ) -> Result<Decimal> {
        let current_quantity = current_position.quantity;
        let delta_quantity = delta.quantity_delta;
        
        // If reducing position, average price remains the same
        if delta_quantity < Decimal::new(0, 0) {
            return Ok(current_position.average_entry_price);
        }
        
        // If position was zero or negative and now adding, use the new price
        if current_quantity <= Decimal::new(0, 0) {
            return Ok(delta.price);
        }
        
        // Calculate weighted average price
        let total_quantity = current_quantity + delta_quantity;
        if total_quantity <= Decimal::new(0, 0) {
            // This shouldn't happen, but return current price if it does
            return Ok(current_position.average_entry_price);
        }
        
        let weighted_current = current_quantity * current_position.average_entry_price;
        let weighted_delta = delta_quantity * delta.price;
        let new_average = (weighted_current + weighted_delta) / total_quantity;
        
        Ok(new_average)
    }
    
    /// Calculate realized profit/loss when reducing a position
    pub fn calculate_realized_pnl(
        &self,
        current_position: &Position,
        delta: &PositionDelta
    ) -> Result<Decimal> {
        // Only calculate P&L when reducing a position (negative delta)
        if delta.quantity_delta >= Decimal::new(0, 0) {
            return Ok(Decimal::new(0, 0));
        }
        
        // Calculate price difference
        let price_diff = delta.price - current_position.average_entry_price;
        
        // Calculate P&L: quantity sold * price difference
        // Note: delta.quantity_delta is negative, so we negate it for calculation
        let pnl = -delta.quantity_delta * price_diff;
        
        Ok(pnl)
    }
    
    /// Calculate unrealized profit/loss for a position
    pub fn calculate_unrealized_pnl(
        &self,
        position: &Position,
        current_price: Decimal
    ) -> Result<Decimal> {
        // Calculate price difference
        let price_diff = current_price - position.average_entry_price;
        
        // Calculate P&L: quantity * price difference
        let pnl = position.quantity * price_diff;
        
        Ok(pnl)
    }
    
    /// Update a position based on a trade
    pub fn update_position(
        &self,
        params: PositionUpdateParams,
        current_position: Option<Position>
    ) -> Result<Position> {
        // Create position delta from params
        let delta = PositionDelta {
            market_id: params.market_id,
            market_option_id: params.market_option_id,
            quantity_delta: params.quantity_delta,
            price: params.price,
            timestamp: Utc::now(),
        };
        
        // If position exists, update it
        if let Some(mut position) = current_position {
            // Calculate realized PnL if reducing position
            let realized_pnl = if delta.quantity_delta < Decimal::new(0, 0) {
                self.calculate_realized_pnl(&position, &delta)?
            } else {
                Decimal::new(0, 0)
            };
            
            // Update quantities and average price
            let new_quantity = position.quantity + delta.quantity_delta;
            let new_avg_price = if new_quantity > Decimal::new(0, 0) {
                self.calculate_new_average_entry_price(&position, &delta)?
            } else {
                // If position is zero or negative after update, reset average price
                position.average_entry_price
            };
            
            // Update position
            position.quantity = new_quantity;
            position.average_entry_price = new_avg_price;
            position.realized_pnl += realized_pnl;
            position.updated_at = Utc::now();
            
            info!(
                "Updated position for user {}: quantity={}, avg_price={}, realized_pnl={}",
                position.user_id, position.quantity, position.average_entry_price, position.realized_pnl
            );
            
            Ok(position)
        } else {
            // Create new position
            let position = Position {
                id: Uuid::new_v4(),
                user_id: params.user_id,
                market_id: params.market_id,
                market_option_id: params.market_option_id,
                quantity: delta.quantity_delta,
                average_entry_price: delta.price,
                realized_pnl: Decimal::new(0, 0),
                created_at: Utc::now(),
                updated_at: Utc::now(),
            };
            
            info!(
                "Created new position for user {}: quantity={}, avg_price={}",
                position.user_id, position.quantity, position.average_entry_price
            );
            
            Ok(position)
        }
    }
} 