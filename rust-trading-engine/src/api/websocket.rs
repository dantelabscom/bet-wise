use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use futures::{StreamExt, SinkExt};
use log::{debug, info, error};
use serde::{Deserialize, Serialize};
use tokio::sync::{broadcast, mpsc, RwLock};
use tokio_stream::wrappers::BroadcastStream;
use warp::ws::{Message, WebSocket};
use uuid::Uuid;
use rust_decimal::Decimal;

use crate::models::{Order, Trade, OutcomeSide};

/// Types of events that can be sent over WebSocket
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum WebSocketEvent {
    /// New trade executed
    Trade(Trade),
    
    /// Market price update
    PriceUpdate {
        market_id: String,
        outcome: OutcomeSide,
        price: Decimal,
    },
    
    /// Market resolved
    MarketResolution {
        market_id: String,
        outcome: OutcomeSide,
    },
    
    /// Payout notification
    Payout {
        user_id: Uuid,
        amount: Decimal,
    },
    
    /// Order status update
    OrderUpdate(Order),
}

/// Client subscription for a WebSocket connection
#[derive(Debug)]
struct ClientSubscription {
    /// Markets the client is subscribed to
    markets: HashSet<String>,
    
    /// Whether the client is subscribed to user-specific events
    user_id: Option<Uuid>,
}

/// WebSocket server for real-time notifications
pub struct WebSocketServer {
    /// Event broadcaster
    event_sender: broadcast::Sender<WebSocketEvent>,
    
    /// Client subscriptions
    clients: Arc<RwLock<HashMap<Uuid, ClientSubscription>>>,
}

impl WebSocketServer {
    /// Creates a new WebSocket server
    pub fn new(capacity: usize) -> Self {
        let (event_sender, _) = broadcast::channel(capacity);
        
        Self {
            event_sender,
            clients: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    /// Gets a receiver for the trade notification channel
    /// In production, this would also take a repository reference to fetch market data
    pub fn get_trade_receiver<R: crate::db::connection::Repository + Send + Sync + 'static>(
        &self,
        repository: Arc<R>
    ) -> mpsc::Sender<Trade> {
        let event_sender = self.event_sender.clone();
        
        let (tx, mut rx) = mpsc::channel::<Trade>(100);
        
        // Clone repository for use in async task
        let repository_clone = repository.clone();
        
        tokio::spawn(async move {
            while let Some(trade) = rx.recv().await {
                let event = WebSocketEvent::Trade(trade.clone());
                
                if let Err(e) = event_sender.send(event) {
                    error!("Failed to broadcast trade: {}", e);
                }
                
                // Calculate and send accurate price updates based on current order book
                match Self::calculate_market_price(repository_clone.as_ref(), &trade.market_id, trade.outcome).await {
                    Ok(price) => {
                        let price_event = WebSocketEvent::PriceUpdate {
                            market_id: trade.market_id.clone(),
                            outcome: trade.outcome,
                            price,
                        };
                        
                        if let Err(e) = event_sender.send(price_event) {
                            error!("Failed to broadcast price update: {}", e);
                        }
                    },
                    Err(e) => {
                        error!("Failed to calculate market price: {}", e);
                    }
                }
            }
        });
        
        tx
    }
    
    /// Calculate the current market price based on the order book
    async fn calculate_market_price<R: crate::db::connection::Repository>(
        repository: &R,
        market_id: &str,
        outcome: OutcomeSide
    ) -> Result<Decimal, String> {
        // Get the market from repository
        let market = repository.get_market(market_id).await
            .map_err(|e| format!("Failed to get market: {}", e))?;
            
        // Get the implied probability/price from the order book
        let price = market.get_implied_probability()
            .unwrap_or_else(|| {
                // Fallback to mid price calculation if no implied probability available
                let (best_bid, best_ask) = match outcome {
                    OutcomeSide::Yes => (
                        market.order_book.get_best_yes_bid_price(),
                        market.order_book.get_best_yes_ask_price()
                    ),
                    OutcomeSide::No => (
                        market.order_book.get_best_no_bid_price(),
                        market.order_book.get_best_no_ask_price()
                    ),
                };
                
                // Calculate mid price if both bid and ask exist
                if let (Some(bid), Some(ask)) = (best_bid, best_ask) {
                    (bid + ask) / Decimal::from(2)
                } else if let Some(bid) = best_bid {
                    // Only bid exists
                    bid
                } else if let Some(ask) = best_ask {
                    // Only ask exists
                    ask
                } else {
                    // No orders, use default 0.5 probability
                    Decimal::new(5, 1)
                }
            });
            
        Ok(price)
    }
    
    /// Gets a receiver for the payout notification channel
    pub fn get_payout_receiver(&self) -> mpsc::Sender<(Uuid, Decimal)> {
        let event_sender = self.event_sender.clone();
        
        let (tx, mut rx) = mpsc::channel::<(Uuid, Decimal)>(100);
        
        tokio::spawn(async move {
            while let Some((user_id, amount)) = rx.recv().await {
                let event = WebSocketEvent::Payout {
                    user_id,
                    amount,
                };
                
                if let Err(e) = event_sender.send(event) {
                    error!("Failed to broadcast payout: {}", e);
                }
            }
        });
        
        tx
    }
    
    /// Gets a receiver for the order update channel
    pub fn get_order_update_receiver(&self) -> mpsc::Sender<Order> {
        let event_sender = self.event_sender.clone();
        
        let (tx, mut rx) = mpsc::channel::<Order>(100);
        
        tokio::spawn(async move {
            while let Some(order) = rx.recv().await {
                let event = WebSocketEvent::OrderUpdate(order);
                
                if let Err(e) = event_sender.send(event) {
                    error!("Failed to broadcast order update: {}", e);
                }
            }
        });
        
        tx
    }
    
    /// Gets a receiver for the market resolution channel
    pub fn get_market_resolution_receiver(&self) -> mpsc::Sender<(String, OutcomeSide)> {
        let event_sender = self.event_sender.clone();
        
        let (tx, mut rx) = mpsc::channel::<(String, OutcomeSide)>(100);
        
        tokio::spawn(async move {
            while let Some((market_id, outcome)) = rx.recv().await {
                let event = WebSocketEvent::MarketResolution {
                    market_id,
                    outcome,
                };
                
                if let Err(e) = event_sender.send(event) {
                    error!("Failed to broadcast market resolution: {}", e);
                }
            }
        });
        
        tx
    }
    
    /// Handles a new WebSocket connection
    pub async fn handle_connection(&self, ws: WebSocket) {
        let client_id = Uuid::new_v4();
        info!("New WebSocket connection: {}", client_id);
        
        // Split the WebSocket
        let (mut ws_tx, mut ws_rx) = ws.split();
        
        // Create a new subscription for this client
        let subscription = ClientSubscription {
            markets: HashSet::new(),
            user_id: None,
        };
        
        // Add the client to the map
        {
            let mut clients = self.clients.write().await;
            clients.insert(client_id, subscription);
        }
        
        // Subscribe to events
        let event_rx = self.event_sender.subscribe();
        
        // Spawn a task to forward events to the client
        let clients = Arc::clone(&self.clients);
        let event_forward = tokio::spawn(async move {
            let mut stream = BroadcastStream::new(event_rx);
            
            while let Some(Ok(event)) = stream.next().await {
                // Check if the client is subscribed to this event
                let should_send = {
                    let clients = clients.read().await;
                    if let Some(subscription) = clients.get(&client_id) {
                        match &event {
                            WebSocketEvent::Trade(trade) => {
                                subscription.markets.contains(&trade.market_id)
                            }
                            WebSocketEvent::PriceUpdate { market_id, .. } => {
                                subscription.markets.contains(market_id)
                            }
                            WebSocketEvent::MarketResolution { market_id, .. } => {
                                subscription.markets.contains(market_id)
                            }
                            WebSocketEvent::Payout { user_id, .. } => {
                                subscription.user_id.map_or(false, |id| id == *user_id)
                            }
                            WebSocketEvent::OrderUpdate(order) => {
                                subscription.user_id.map_or(false, |id| id == order.user_id) ||
                                subscription.markets.contains(&order.market_id)
                            }
                        }
                    } else {
                        false
                    }
                };
                
                if should_send {
                    let json = serde_json::to_string(&event).unwrap();
                    if let Err(e) = ws_tx.send(Message::text(json)).await {
                        error!("Failed to send WebSocket message: {}", e);
                        break;
                    }
                }
            }
            
            debug!("WebSocket event forwarder for client {} terminated", client_id);
        });
        
        // Process incoming messages from the client
        while let Some(result) = ws_rx.next().await {
            match result {
                Ok(msg) => {
                    if msg.is_text() {
                        if let Ok(text) = msg.to_str() {
                            self.process_client_message(client_id, text).await;
                        }
                    } else if msg.is_close() {
                        break;
                    }
                }
                Err(e) => {
                    error!("WebSocket error: {}", e);
                    break;
                }
            }
        }
        
        // Client disconnected, cleanup
        {
            let mut clients = self.clients.write().await;
            clients.remove(&client_id);
        }
        
        // Stop the event forwarder
        event_forward.abort();
        
        info!("WebSocket connection closed: {}", client_id);
    }
    
    /// Processes a message from a client
    async fn process_client_message(&self, client_id: Uuid, message: &str) {
        #[derive(Deserialize)]
        struct SubscriptionMessage {
            action: String,
            #[serde(default)]
            markets: Vec<String>,
            user_id: Option<String>,
        }
        
        if let Ok(msg) = serde_json::from_str::<SubscriptionMessage>(message) {
            let mut clients = self.clients.write().await;
            
            if let Some(subscription) = clients.get_mut(&client_id) {
                match msg.action.as_str() {
                    "subscribe" => {
                        // Subscribe to markets
                        for market_id in msg.markets {
                            subscription.markets.insert(market_id.clone());
                        }
                        
                        // Subscribe to user events
                        if let Some(user_id_str) = msg.user_id {
                            if let Ok(user_id) = Uuid::parse_str(&user_id_str) {
                                subscription.user_id = Some(user_id);
                            }
                        }
                        
                        debug!("Client {} subscribed to {:?}", client_id, subscription);
                    }
                    "unsubscribe" => {
                        // Unsubscribe from markets
                        for market_id in msg.markets {
                            subscription.markets.remove(&market_id);
                        }
                        
                        // Unsubscribe from user events
                        if msg.user_id.is_some() {
                            subscription.user_id = None;
                        }
                        
                        debug!("Client {} unsubscribed from some topics", client_id);
                    }
                    _ => {
                        debug!("Unknown action from client {}: {}", client_id, msg.action);
                    }
                }
            }
        }
    }
} 