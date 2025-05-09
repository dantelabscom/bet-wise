use std::sync::Arc;
use log::{debug, info};
use rust_decimal::Decimal;
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::models::{
    Market, Order, OrderSide, OrderStatus, OutcomeSide, Trade
};

/// Represents the result of an order matching operation
#[derive(Debug)]
pub struct MatchingResult {
    /// The remaining (unmatched) order, if any
    pub remaining_order: Option<Order>,
    
    /// The trades that were executed as part of the matching
    pub trades: Vec<Trade>,
}

/// Service for matching orders in prediction markets
pub struct MatchingEngine {
    /// Channel for sending trades to other services
    trade_sender: mpsc::Sender<Trade>,
}

impl MatchingEngine {
    /// Creates a new matching engine
    pub fn new(trade_sender: mpsc::Sender<Trade>) -> Self {
        Self { trade_sender }
    }

    /// Processes a new order against the market order book
    pub async fn process_order(&self, mut order: Order, market: &mut Market) -> MatchingResult {
        if !market.is_open() {
            debug!("Market {} is not open, rejecting order", market.market_id);
            order.status = OrderStatus::Rejected;
            return MatchingResult {
                remaining_order: Some(order),
                trades: Vec::new(),
            };
        }

        let mut trades = Vec::new();
        
        // Match the order against the order book
        let matched_result = self.match_order(&mut order, market).await;
        trades.extend(matched_result.trades);
        
        // If there's still quantity remaining, add it to the order book
        let remaining_order = if order.remaining_quantity > 0 && order.is_active() {
            market.order_book.add_order(order.clone());
            Some(order)
        } else {
            None
        };
        
        MatchingResult {
            remaining_order,
            trades,
        }
    }

    /// Matches an order against the market order book
    async fn match_order(&self, order: &mut Order, market: &mut Market) -> MatchingResult {
        let mut trades = Vec::new();

        // Determine which book to match against based on order type
        let book = match (order.side, order.outcome) {
            (OrderSide::Buy, OutcomeSide::Yes) => &mut market.order_book.yes_asks,
            (OrderSide::Sell, OutcomeSide::Yes) => &mut market.order_book.yes_bids,
            (OrderSide::Buy, OutcomeSide::No) => &mut market.order_book.no_asks,
            (OrderSide::Sell, OutcomeSide::No) => &mut market.order_book.no_bids,
        };

        // Get a list of matching price levels
        let matching_prices: Vec<Decimal> = match order.side {
            OrderSide::Buy => book
                .keys()
                .take_while(|&&price| price <= order.price)
                .cloned()
                .collect(),
            OrderSide::Sell => book
                .keys()
                .rev()
                .take_while(|&&price| price >= order.price)
                .cloned()
                .collect(),
        };

        // Loop through each price level and try to match
        for price in matching_prices {
            if order.remaining_quantity == 0 {
                break;
            }

            if let Some(orders_at_price) = book.get_mut(&price) {
                // Match against each order at this price level (FIFO)
                let mut i = 0;
                while i < orders_at_price.len() && order.remaining_quantity > 0 {
                    let matching_order = &mut orders_at_price[i];
                    
                    // Skip if same user
                    if matching_order.user_id == order.user_id {
                        i += 1;
                        continue;
                    }
                    
                    // Determine the matched quantity
                    let match_quantity = std::cmp::min(order.remaining_quantity, matching_order.remaining_quantity);
                    
                    // Execute the trade
                    if match_quantity > 0 {
                        // Create a trade record
                        let trade = match order.side {
                            OrderSide::Buy => Trade::new(
                                order.market_id.clone(),
                                order.order_id,
                                order.user_id,
                                matching_order.order_id,
                                matching_order.user_id,
                                order.outcome,
                                price,
                                match_quantity,
                            ),
                            OrderSide::Sell => Trade::new(
                                order.market_id.clone(),
                                matching_order.order_id,
                                matching_order.user_id,
                                order.order_id,
                                order.user_id,
                                order.outcome,
                                price,
                                match_quantity,
                            ),
                        };
                        
                        // Update order quantities
                        order.apply_fill(match_quantity);
                        matching_order.apply_fill(match_quantity);
                        
                        // Send trade notification
                        if let Err(e) = self.trade_sender.try_send(trade.clone()) {
                            debug!("Failed to send trade notification: {}", e);
                        }
                        
                        // Add to result
                        trades.push(trade);
                        
                        info!(
                            "Matched order {} with {} at price {} for quantity {}",
                            order.order_id, matching_order.order_id, price, match_quantity
                        );
                    }
                    
                    // If the matching order is fully filled, remove it
                    if matching_order.remaining_quantity == 0 {
                        orders_at_price.remove(i);
                    } else {
                        i += 1;
                    }
                }
                
                // If no orders left at this price level, remove the price from the book
                if orders_at_price.is_empty() {
                    book.remove(&price);
                }
            }
        }
        
        MatchingResult {
            remaining_order: Some(order.clone()),
            trades,
        }
    }

    /// Cancels an order in the market
    pub fn cancel_order(&self, order_id: Uuid, market: &mut Market) -> Option<Order> {
        market.order_book.remove_order(order_id).map(|mut order| {
            order.status = OrderStatus::Cancelled;
            order
        })
    }
} 