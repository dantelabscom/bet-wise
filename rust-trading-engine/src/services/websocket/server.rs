use actix::{Actor, StreamHandler, Handler, Message, Addr, ActorContext, AsyncContext};
use actix_web::{web, Error, HttpRequest, HttpResponse};
use actix_web_actors::ws;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use tracing::{debug, info, warn};

/// WebSocket message types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum WsMessage {
    #[serde(rename = "join")]
    Join(String), // Join a room (e.g., "market:123")
    
    #[serde(rename = "leave")]
    Leave(String), // Leave a room
    
    #[serde(rename = "orderbook")]
    OrderBook(OrderBookMessage),
    
    #[serde(rename = "price")]
    Price(PriceUpdateMessage),
    
    #[serde(rename = "match")]
    Match(MatchUpdateMessage),
    
    #[serde(rename = "error")]
    Error(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderBookMessage {
    pub market_id: i64,
    pub market_option_id: i64,
    pub data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceUpdateMessage {
    pub market_id: i64,
    pub market_option_id: i64,
    pub last_price: String,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchUpdateMessage {
    pub match_id: String,
    pub market_id: i64,
    pub data: serde_json::Value,
}

/// WebSocket server actor
pub struct WsServer {
    // All connected clients
    clients: HashMap<String, Addr<WsConnection>>,
    // Room membership: room -> set of client IDs
    rooms: HashMap<String, HashSet<String>>,
}

impl Actor for WsServer {
    type Context = actix::Context<Self>;
}

impl Default for WsServer {
    fn default() -> Self {
        Self {
            clients: HashMap::new(),
            rooms: HashMap::new(),
        }
    }
}

/// Message to register a new client
#[derive(Message)]
#[rtype(result = "()")]
pub struct Connect {
    pub client_id: String,
    pub addr: Addr<WsConnection>,
}

/// Message to remove a client
#[derive(Message)]
#[rtype(result = "()")]
pub struct Disconnect {
    pub client_id: String,
}

/// Message to join a room
#[derive(Message)]
#[rtype(result = "()")]
pub struct JoinRoom {
    pub client_id: String,
    pub room: String,
}

/// Message to leave a room
#[derive(Message)]
#[rtype(result = "()")]
pub struct LeaveRoom {
    pub client_id: String,
    pub room: String,
}

/// Message to broadcast to a room
#[derive(Message)]
#[rtype(result = "()")]
pub struct Broadcast {
    pub room: String,
    pub message: WsMessage,
    pub exclude_client: Option<String>,
}

impl Handler<Connect> for WsServer {
    type Result = ();

    fn handle(&mut self, msg: Connect, _: &mut Self::Context) -> Self::Result {
        info!("Client connected: {}", msg.client_id);
        self.clients.insert(msg.client_id, msg.addr);
    }
}

impl Handler<Disconnect> for WsServer {
    type Result = ();

    fn handle(&mut self, msg: Disconnect, _: &mut Self::Context) -> Self::Result {
        info!("Client disconnected: {}", msg.client_id);
        
        // Remove client from all rooms
        for (_, members) in self.rooms.iter_mut() {
            members.remove(&msg.client_id);
        }
        
        // Remove client from clients map
        self.clients.remove(&msg.client_id);
    }
}

impl Handler<JoinRoom> for WsServer {
    type Result = ();

    fn handle(&mut self, msg: JoinRoom, _: &mut Self::Context) -> Self::Result {
        debug!("Client {} joining room: {}", msg.client_id, msg.room);
        
        // Create room if it doesn't exist
        let room = self.rooms
            .entry(msg.room.clone())
            .or_insert_with(HashSet::new);
        
        // Add client to room
        room.insert(msg.client_id);
    }
}

impl Handler<LeaveRoom> for WsServer {
    type Result = ();

    fn handle(&mut self, msg: LeaveRoom, _: &mut Self::Context) -> Self::Result {
        debug!("Client {} leaving room: {}", msg.client_id, msg.room);
        
        if let Some(room) = self.rooms.get_mut(&msg.room) {
            room.remove(&msg.client_id);
        }
    }
}

impl Handler<Broadcast> for WsServer {
    type Result = ();

    fn handle(&mut self, msg: Broadcast, _: &mut Self::Context) -> Self::Result {
        debug!("Broadcasting to room: {}", msg.room);
        
        if let Some(room) = self.rooms.get(&msg.room) {
            // Serialize message
            if let Ok(message_str) = serde_json::to_string(&msg.message) {
                // Send to all clients in the room
                for client_id in room {
                    // Skip excluded client if specified
                    if let Some(ref exclude) = msg.exclude_client {
                        if client_id == exclude {
                            continue;
                        }
                    }
                    
                    if let Some(client_addr) = self.clients.get(client_id) {
                        let _ = client_addr.do_send(SendMessage(message_str.clone()));
                    }
                }
            } else {
                warn!("Failed to serialize message for broadcast");
            }
        }
    }
}

/// Individual WebSocket connection actor
pub struct WsConnection {
    id: String,
    server: Addr<WsServer>,
}

impl WsConnection {
    pub fn new(id: String, server: Addr<WsServer>) -> Self {
        Self { id, server }
    }
}

impl Actor for WsConnection {
    type Context = ws::WebsocketContext<Self>;
    
    fn started(&mut self, ctx: &mut Self::Context) {
        // Register with server
        self.server.do_send(Connect {
            client_id: self.id.clone(),
            addr: ctx.address(),
        });
    }
    
    fn stopping(&mut self, _: &mut Self::Context) -> actix::Running {
        // Unregister from server
        self.server.do_send(Disconnect {
            client_id: self.id.clone(),
        });
        actix::Running::Stop
    }
}

/// Message to send to WebSocket client
#[derive(Message)]
#[rtype(result = "()")]
pub struct SendMessage(pub String);

impl Handler<SendMessage> for WsConnection {
    type Result = ();

    fn handle(&mut self, msg: SendMessage, ctx: &mut Self::Context) -> Self::Result {
        ctx.text(msg.0);
    }
}

/// Handle incoming WebSocket messages from client
impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for WsConnection {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(msg)) => ctx.pong(&msg),
            Ok(ws::Message::Text(text)) => {
                debug!("Received message: {}", text);
                
                // Parse message
                match serde_json::from_str::<WsMessage>(&text) {
                    Ok(WsMessage::Join(room)) => {
                        self.server.do_send(JoinRoom {
                            client_id: self.id.clone(),
                            room,
                        });
                    }
                    Ok(WsMessage::Leave(room)) => {
                        self.server.do_send(LeaveRoom {
                            client_id: self.id.clone(),
                            room,
                        });
                    }
                    Err(e) => {
                        warn!("Invalid message format: {}", e);
                        
                        // Send error back to client
                        let error_msg = WsMessage::Error(format!("Invalid message format: {}", e));
                        if let Ok(error_str) = serde_json::to_string(&error_msg) {
                            ctx.text(error_str);
                        }
                    }
                    _ => {
                        warn!("Unexpected message type from client");
                    }
                }
            }
            Ok(ws::Message::Close(reason)) => {
                info!("Connection closed");
                ctx.close(reason);
                ctx.stop();
            }
            _ => (),
        }
    }
}

/// HTTP handler to upgrade to WebSocket connection
pub async fn ws_handler(
    req: HttpRequest,
    stream: web::Payload,
    server: web::Data<Addr<WsServer>>,
) -> Result<HttpResponse, Error> {
    // Generate a unique ID for this connection
    let conn_id = uuid::Uuid::new_v4().to_string();
    
    info!("WebSocket connection request: {}", conn_id);
    
    // Create the WebSocket connection
    let conn = WsConnection::new(conn_id, server.get_ref().clone());
    
    // Upgrade to WebSocket connection
    ws::start(conn, &req, stream)
} 