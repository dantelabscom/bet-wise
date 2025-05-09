use std::sync::Arc;
use std::env;
use log::info;
use tokio::sync::{mpsc, Mutex};
use warp::{self, Filter};
use uuid::Uuid;
use dotenv::dotenv;

use prediction_engine::{
    BotConfig, BotService, 
    MatchingEngine, OrderService, SettlementService,
    WebSocketServer, SqlxRepository, BalanceService
};
use prediction_engine::api::routes;
use prediction_engine::db::create_pg_pool;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load environment variables from .env file
    dotenv().ok();
    
    // Set up DATABASE_URL environment variable if not set
    // This is required for SQLx query macros to work properly
    if env::var("DATABASE_URL").is_err() {
        env::set_var("DATABASE_URL", "postgres://postgres:postgres@localhost/prediction_engine");
        info!("DATABASE_URL not set, using default: postgres://postgres:postgres@localhost/prediction_engine");
    }
    
    // Initialize logger
    env_logger::init();
    
    // Initialize database connection pool
    info!("Initializing database connection pool...");
    let pg_pool = create_pg_pool().await?;
    let repository = Arc::new(SqlxRepository::new(pg_pool));
    
    // Create WebSocket server for real-time notifications
    let ws_server = Arc::new(WebSocketServer::new(1000));
    
    // Create channels for event notifications
    let trade_sender = ws_server.get_trade_receiver(Arc::clone(&repository));
    let (payout_sender, _payout_receiver) = mpsc::channel::<(Uuid, rust_decimal::Decimal)>(100);
    
    // Create services
    let matching_engine = Arc::new(Mutex::new(MatchingEngine::new(trade_sender)));
    let balance_service = Arc::new(BalanceService::new(Arc::clone(&repository)));
    let order_service = Arc::new(OrderService::new(
        Arc::clone(&repository), 
        Arc::clone(&matching_engine),
        Arc::clone(&balance_service)
    ));
    let settlement_service = Arc::new(SettlementService::new(
        payout_sender, 
        Arc::clone(&repository),
        Arc::clone(&balance_service)
    ));
    
    // Create bot service with default configuration
    let bot_config = BotConfig::default();
    let bot_service = Arc::new(BotService::new(Arc::clone(&order_service), bot_config));
    
    // Create API routes
    let api_routes = routes(
        Arc::clone(&order_service),
        Arc::clone(&bot_service),
        Arc::clone(&settlement_service),
    );
    
    // WebSocket handler
    let ws_server_clone = Arc::clone(&ws_server);
    let ws_route = warp::path("ws")
        .and(warp::ws())
        .map(move |ws: warp::ws::Ws| {
            let ws_server = Arc::clone(&ws_server_clone);
            ws.on_upgrade(move |websocket| async move {
                ws_server.handle_connection(websocket).await;
            })
        });
    
    // Combine all routes
    let routes = api_routes.or(ws_route);
    
    // Get port from environment or use default
    let port = env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse::<u16>()
        .unwrap_or(8080);
    
    // Start the server
    info!("Starting server on port {}", port);
    warp::serve(routes).run(([0, 0, 0, 0], port)).await;
    
    Ok(())
}
