use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, VecDeque};
use uuid::Uuid;

use crate::models::order::{Order, OrderSide, OrderStatus, OutcomeSide};

/// Represents the status of a prediction market
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MarketStatus {
    /// Market is open for trading
    Open,
    
    /// Market is temporarily paused (e.g., during an event)
    Paused,
    
    /// Market is closed for trading but not yet resolved
    Closed,
    
    /// Market has been resolved as Yes
    ResolvedYes,
    
    /// Market has been resolved as No
    ResolvedNo,
    
    /// Market has been cancelled (e.g., due to unforeseen circumstances)
    Cancelled,
}

impl From<i32> for MarketStatus {
    fn from(value: i32) -> Self {
        match value {
            0 => MarketStatus::Open,
            1 => MarketStatus::Paused,
            2 => MarketStatus::Closed,
            3 => MarketStatus::ResolvedYes,
            4 => MarketStatus::ResolvedNo,
            5 => MarketStatus::Cancelled,
            _ => panic!("Invalid MarketStatus value: {}", value),
        }
    }
}

impl From<MarketStatus> for i32 {
    fn from(value: MarketStatus) -> Self {
        match value {
            MarketStatus::Open => 0,
            MarketStatus::Paused => 1,
            MarketStatus::Closed => 2,
            MarketStatus::ResolvedYes => 3,
            MarketStatus::ResolvedNo => 4,
            MarketStatus::Cancelled => 5,
        }
    }
}

/// Represents the order book for a prediction market
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderBook {
    /// Buy orders for Yes outcome (sorted by price descending)
    pub yes_bids: BTreeMap<Decimal, VecDeque<Order>>,
    
    /// Sell orders for Yes outcome (sorted by price ascending)
    pub yes_asks: BTreeMap<Decimal, VecDeque<Order>>,
    
    /// Buy orders for No outcome (sorted by price descending)
    pub no_bids: BTreeMap<Decimal, VecDeque<Order>>,
    
    /// Sell orders for No outcome (sorted by price ascending)
    pub no_asks: BTreeMap<Decimal, VecDeque<Order>>,
}

impl OrderBook {
    /// Creates a new, empty order book
    pub fn new() -> Self {
        Self {
            yes_bids: BTreeMap::new(),
            yes_asks: BTreeMap::new(),
            no_bids: BTreeMap::new(),
            no_asks: BTreeMap::new(),
        }
    }

    /// Adds an order to the appropriate section of the order book
    pub fn add_order(&mut self, order: Order) {
        if !order.is_active() {
            return;
        }

        let book = match (order.side, order.outcome) {
            (OrderSide::Buy, OutcomeSide::Yes) => &mut self.yes_bids,
            (OrderSide::Sell, OutcomeSide::Yes) => &mut self.yes_asks,
            (OrderSide::Buy, OutcomeSide::No) => &mut self.no_bids,
            (OrderSide::Sell, OutcomeSide::No) => &mut self.no_asks,
        };

        book.entry(order.price)
            .or_insert_with(VecDeque::new)
            .push_back(order);
    }

    /// Gets the best bid and ask prices for a specific outcome
    pub fn get_best_prices(&self, outcome: OutcomeSide) -> (Option<Decimal>, Option<Decimal>) {
        match outcome {
            OutcomeSide::Yes => {
                let best_bid = self.yes_bids.keys().next().cloned();
                let best_ask = self.yes_asks.keys().next().cloned();
                (best_bid, best_ask)
            }
            OutcomeSide::No => {
                let best_bid = self.no_bids.keys().next().cloned();
                let best_ask = self.no_asks.keys().next().cloned();
                (best_bid, best_ask)
            }
        }
    }

    /// Gets the best Yes bid price
    pub fn get_best_yes_bid_price(&self) -> Option<Decimal> {
        self.yes_bids.keys().next().cloned()
    }
    
    /// Gets the best Yes ask price
    pub fn get_best_yes_ask_price(&self) -> Option<Decimal> {
        self.yes_asks.keys().next().cloned()
    }
    
    /// Gets the best No bid price
    pub fn get_best_no_bid_price(&self) -> Option<Decimal> {
        self.no_bids.keys().next().cloned()
    }
    
    /// Gets the best No ask price
    pub fn get_best_no_ask_price(&self) -> Option<Decimal> {
        self.no_asks.keys().next().cloned()
    }

    /// Gets the mid price for a specific outcome
    pub fn get_mid_price(&self, outcome: OutcomeSide) -> Option<Decimal> {
        let (best_bid, best_ask) = self.get_best_prices(outcome);
        match (best_bid, best_ask) {
            (Some(bid), Some(ask)) => Some((bid + ask) / Decimal::new(2, 0)),
            (Some(bid), None) => Some(bid),
            (None, Some(ask)) => Some(ask),
            (None, None) => None,
        }
    }

    /// Gets the implied probability for a Yes outcome
    pub fn get_implied_probability(&self) -> Option<Decimal> {
        self.get_mid_price(OutcomeSide::Yes)
    }

    /// Removes an order from the order book by ID
    pub fn remove_order(&mut self, order_id: Uuid) -> Option<Order> {
        // Check all order queues
        for &outcome in &[OutcomeSide::Yes, OutcomeSide::No] {
            for &side in &[OrderSide::Buy, OrderSide::Sell] {
                let book = match (side, outcome) {
                    (OrderSide::Buy, OutcomeSide::Yes) => &mut self.yes_bids,
                    (OrderSide::Sell, OutcomeSide::Yes) => &mut self.yes_asks,
                    (OrderSide::Buy, OutcomeSide::No) => &mut self.no_bids,
                    (OrderSide::Sell, OutcomeSide::No) => &mut self.no_asks,
                };

                // Look through each price level
                for orders in book.values_mut() {
                    // Find the order by ID
                    if let Some(pos) = orders.iter().position(|o| o.order_id == order_id) {
                        let order = orders.remove(pos).unwrap();
                        // If this was the last order at this price level, the map entry will be
                        // automatically removed when the orders VecDeque is dropped
                        return Some(order);
                    }
                }
            }
        }

        None
    }

    /// Updates an existing order in the book
    pub fn update_order(&mut self, updated_order: Order) -> Option<Order> {
        // First remove the old order
        if let Some(old_order) = self.remove_order(updated_order.order_id) {
            // Then add the updated order if it's still active
            if updated_order.is_active() {
                self.add_order(updated_order.clone());
            }
            Some(old_order)
        } else {
            None
        }
    }
}

/// Represents a prediction market
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Market {
    /// Unique identifier for this market
    pub market_id: String,
    
    /// Title/question of the market
    pub question: String,
    
    /// Detailed description of the market
    pub description: String,
    
    /// Current status of the market
    pub status: MarketStatus,
    
    /// The order book for this market
    pub order_book: OrderBook,
    
    /// When the market was created
    pub created_at: DateTime<Utc>,
    
    /// When the market was last updated
    pub updated_at: DateTime<Utc>,
    
    /// When the market is scheduled to close
    pub close_time: Option<DateTime<Utc>>,
    
    /// When the market was resolved (if it has been)
    pub resolved_at: Option<DateTime<Utc>>,
    
    /// The outcome the market was resolved to (if resolved)
    pub resolution: Option<OutcomeSide>,
}

impl Market {
    /// Creates a new prediction market
    pub fn new(
        market_id: String,
        question: String,
        description: String,
        close_time: Option<DateTime<Utc>>,
    ) -> Self {
        let now = Utc::now();
        Self {
            market_id,
            question,
            description,
            status: MarketStatus::Open,
            order_book: OrderBook::new(),
            created_at: now,
            updated_at: now,
            close_time,
            resolved_at: None,
            resolution: None,
        }
    }

    /// Creates a Market from database fields and orders
    pub fn from_db(
        id: String,
        question: String,
        description: String,
        status: MarketStatus,
        created_at: DateTime<Utc>,
        updated_at: DateTime<Utc>,
        close_time: Option<DateTime<Utc>>,
        resolved_at: Option<DateTime<Utc>>,
        resolution: Option<OutcomeSide>,
        orders: Vec<Order>,
    ) -> Self {
        let mut market = Self {
            market_id: id,
            question,
            description,
            status,
            order_book: OrderBook::new(),
            created_at,
            updated_at,
            close_time,
            resolved_at,
            resolution,
        };
        
        // Populate order book with active orders
        for order in orders {
            if order.is_active() {
                market.order_book.add_order(order);
            }
        }
        
        market
    }

    /// Checks if the market is open for trading
    pub fn is_open(&self) -> bool {
        self.status == MarketStatus::Open
    }

    /// Checks if the market has been resolved
    pub fn is_resolved(&self) -> bool {
        matches!(self.status, MarketStatus::ResolvedYes | MarketStatus::ResolvedNo)
    }

    /// Resolves the market to a specific outcome
    pub fn resolve(&mut self, outcome: OutcomeSide) {
        let now = Utc::now();
        self.status = match outcome {
            OutcomeSide::Yes => MarketStatus::ResolvedYes,
            OutcomeSide::No => MarketStatus::ResolvedNo,
        };
        self.resolved_at = Some(now);
        self.resolution = Some(outcome);
        self.updated_at = now;
    }

    /// Cancels the market
    pub fn cancel(&mut self) {
        self.status = MarketStatus::Cancelled;
        self.updated_at = Utc::now();
    }

    /// Gets the current implied probability (market price) for Yes
    pub fn get_implied_probability(&self) -> Option<Decimal> {
        self.order_book.get_implied_probability()
    }

    /// Closes the market for trading
    pub fn close(&mut self) {
        self.status = MarketStatus::Closed;
        self.updated_at = Utc::now();
    }
} 