pub mod models;
pub mod services;
pub mod api;
pub mod db;

// Re-export commonly used db types
pub use db::{PgPool, Repository, SqlxRepository};

// Re-export model types
pub use models::{
    Market,
    order::{Order, OrderSide, OrderStatus, OutcomeSide},
    trade::Trade,
    balance::{UserBalance, BalanceTransaction, TransactionType},
};

pub use services::{MatchingEngine, OrderService, BotService, BotStrategy, BotConfig, SettlementService, BalanceService};
pub use api::{ApiResponse, WebSocketEvent, WebSocketServer}; 