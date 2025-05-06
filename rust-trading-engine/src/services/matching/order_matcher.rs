use crate::models::{
    Order, OrderBook, OrderMatch, OrderSide, OrderStatus, TradeResult
};
use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use std::cmp::Ordering;
use tracing::{debug, info};

// Define a type for the compare function to solve the closure type issue
type CompareFn = Box<dyn Fn(&Decimal, &Decimal) -> bool>;

/// Order matching engine that implements the core matching algorithm
pub struct OrderMatcher {
    // Any internal state needed
}

impl OrderMatcher {
    /// Create a new order matcher
    pub fn new() -> Self {
        Self {}
    }
    
    /// Match an order against the order book
    pub async fn match_order(&self, order: &Order, order_book: &OrderBook) -> Result<TradeResult> {
        info!(
            "Matching order {} - side: {:?}, price: {}, quantity: {}", 
            order.id, order.side, order.price, order.quantity
        );
        
        let mut matches = Vec::new();
        let mut remaining_quantity = order.quantity;
        let mut filled_quantity = Decimal::new(0, 0);
        let mut total_value = Decimal::new(0, 0);
        
        // Determine which side of the book to match against
        let (matching_orders, compare_fn): (&Vec<_>, CompareFn) = match order.side {
            OrderSide::Buy => {
                // For buy orders, we match against sell orders sorted by lowest price first
                // We take sell orders with price <= buy order price
                let compare = Box::new(|order_price: &Decimal, match_price: &Decimal| -> bool {
                    order_price >= match_price // Buy price >= sell price
                });
                (&order_book.sell_orders, compare)
            },
            OrderSide::Sell => {
                // For sell orders, we match against buy orders sorted by highest price first
                // We take buy orders with price >= sell order price
                let compare = Box::new(|order_price: &Decimal, match_price: &Decimal| -> bool {
                    order_price <= match_price // Sell price <= buy price
                });
                (&order_book.buy_orders, compare)
            }
        };
        
        // Match the order against the book
        for book_entry in matching_orders {
            if remaining_quantity.is_zero() {
                break;
            }
            
            // Check if this price level has orders that match
            if !compare_fn(&order.price, &book_entry.price) {
                continue;
            }
            
            // Calculate the match quantity
            let match_quantity = std::cmp::min(remaining_quantity, book_entry.quantity);
            
            // Create a match record
            let order_match = OrderMatch {
                taker_order_id: order.id,
                maker_order_id: Default::default(), // This would be filled in by the repo
                price: book_entry.price,
                quantity: match_quantity,
                timestamp: Utc::now(),
            };
            
            matches.push(order_match);
            
            // Update running totals
            remaining_quantity -= match_quantity;
            filled_quantity += match_quantity;
            total_value += match_quantity * book_entry.price;
            
            debug!(
                "Matched {} units at price {}", 
                match_quantity, book_entry.price
            );
        }
        
        // Calculate average execution price
        let average_price = if filled_quantity.is_zero() {
            order.price
        } else {
            total_value / filled_quantity
        };
        
        // Determine the order status based on filled quantity
        let status = if filled_quantity.is_zero() {
            OrderStatus::Open
        } else if filled_quantity == order.quantity {
            OrderStatus::Filled
        } else {
            OrderStatus::PartiallyFilled
        };
        
        let result = TradeResult {
            order_id: order.id,
            matches,
            filled_quantity,
            average_price,
            status,
            remaining_quantity,
        };
        
        info!(
            "Order matching complete - filled: {}, remaining: {}, status: {:?}", 
            result.filled_quantity, result.remaining_quantity, result.status
        );
        
        Ok(result)
    }
    
    /// Calculate the maximum possible execution quantity for an order
    pub fn calculate_potential_execution(&self, order: &Order, order_book: &OrderBook) -> Decimal {
        let (matching_orders, compare_fn): (&Vec<_>, CompareFn) = match order.side {
            OrderSide::Buy => {
                let compare = Box::new(|order_price: &Decimal, match_price: &Decimal| -> bool {
                    order_price >= match_price
                });
                (&order_book.sell_orders, compare)
            },
            OrderSide::Sell => {
                let compare = Box::new(|order_price: &Decimal, match_price: &Decimal| -> bool {
                    order_price <= match_price
                });
                (&order_book.buy_orders, compare)
            }
        };
        
        let mut potential_execution = Decimal::new(0, 0);
        
        for book_entry in matching_orders {
            if !compare_fn(&order.price, &book_entry.price) {
                continue;
            }
            potential_execution += book_entry.quantity;
        }
        
        std::cmp::min(potential_execution, order.quantity)
    }
    
    /// Sort orders for processing (used to maintain price-time priority)
    pub fn sort_orders_for_matching(&self, orders: &mut [Order]) {
        orders.sort_by(|a, b| {
            match a.side {
                OrderSide::Buy => {
                    // Sort buy orders by price (desc) and time (asc)
                    match b.price.cmp(&a.price) {
                        Ordering::Equal => a.created_at.cmp(&b.created_at),
                        other => other,
                    }
                },
                OrderSide::Sell => {
                    // Sort sell orders by price (asc) and time (asc)
                    match a.price.cmp(&b.price) {
                        Ordering::Equal => a.created_at.cmp(&b.created_at),
                        other => other,
                    }
                }
            }
        });
    }
} 