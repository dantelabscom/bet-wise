use actix::Actor;
use actix_cors::Cors;
use actix_web::{web, App, HttpServer, middleware, HttpResponse, Responder, http::StatusCode};
use chrono::Utc;
use dotenv::dotenv;
use num_cpus;
use rust_decimal::Decimal;
use serde::Serialize;
use std::env;
use std::str::FromStr;
use tracing::{info, error, debug, Level};
use tracing_subscriber::FmtSubscriber;
use uuid::Uuid;

use trading_engine::{
    models::{
        OrderCreationParams, Order, OrderBook, OrderBookEntry, OrderStatus, 
        OrderSide, Position, PositionUpdateParams, PositionSummary
    },
    services::{
        matching::OrderMatcher,
        pricing::MarketPricer,
        position::PositionManager,
        websocket::{WsServer, ws_handler}
    }
};

// Generic response type
#[derive(Serialize)]
struct ApiResponse<T>
where
    T: Serialize,
{
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

// API handler to create a new order
async fn create_order(
    order_params: web::Json<OrderCreationParams>,
    matcher: web::Data<OrderMatcher>,
    pricer: web::Data<MarketPricer>,
    position_manager: web::Data<PositionManager>
) -> impl Responder {
    info!("Received order creation request for market_id={}, option_id={}", 
          order_params.market_id, order_params.market_option_id);
    
    // Create a new order with a unique ID
    let order_id = Uuid::new_v4();
    let now = Utc::now();
    
    let order = Order {
        id: order_id,
        user_id: order_params.user_id,
        market_id: order_params.market_id,
        market_option_id: order_params.market_option_id,
        order_type: order_params.order_type,
        side: order_params.side,
        price: order_params.price,
        quantity: order_params.quantity,
        filled_quantity: Decimal::new(0, 0),
        status: OrderStatus::Open,
        expires_at: order_params.expires_at,
        created_at: now,
        updated_at: now,
    };
    
    // Create a sample order book for matching
    let sample_order_book = OrderBook {
        market_id: order.market_id,
        market_option_id: order.market_option_id,
        buy_orders: vec![
            OrderBookEntry {
                price: Decimal::new(120, 2), // 1.20
                quantity: Decimal::new(1000, 0), // 1000
                order_count: 5,
            },
        ],
        sell_orders: vec![
            OrderBookEntry {
                price: Decimal::new(130, 2), // 1.30
                quantity: Decimal::new(800, 0), // 800
                order_count: 4,
            },
        ],
        last_price: Some(Decimal::new(125, 2)), // 1.25
        last_updated: Utc::now(),
    };
    
    // Match the order using the matching engine
    let trade_result = match matcher.match_order(&order, &sample_order_book).await {
        Ok(result) => result,
        Err(e) => {
            error!("Order matching error: {}", e);
            return HttpResponse::InternalServerError().json(ApiResponse::<serde_json::Value> {
                success: false,
                data: None,
                error: Some(format!("Order matching failed: {}", e)),
            });
        }
    };
    
    info!("Order matched: filled_quantity={}, status={:?}", 
         trade_result.filled_quantity, trade_result.status);
    
    // Update position if order was filled
    if !trade_result.filled_quantity.is_zero() {
        // Calculate position update
        let position_params = PositionUpdateParams {
            user_id: order.user_id,
            market_id: order.market_id,
            market_option_id: order.market_option_id,
            quantity_delta: match order.side {
                OrderSide::Buy => trade_result.filled_quantity,
                OrderSide::Sell => -trade_result.filled_quantity,
            },
            price: trade_result.average_price,
        };
        
        // Create or update position
        match position_manager.update_position(position_params, None) {
            Ok(updated_position) => {
                info!("Position updated: quantity={}, avg_price={}", 
                     updated_position.quantity, updated_position.average_entry_price);
            },
            Err(e) => {
                error!("Position update error: {}", e);
            }
        }
    }
    
    // Return trade result
    HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(trade_result),
        error: None,
    })
}

// Get order book
async fn get_order_book(
    path: web::Path<(i64, i64)> // market_id, market_option_id
) -> impl Responder {
    let (market_id, market_option_id) = path.into_inner();
    
    info!("Get order book request for market_id={}, option_id={}", market_id, market_option_id);
    
    // Create a sample order book
    let sample_order_book = OrderBook {
        market_id,
        market_option_id,
        buy_orders: vec![
            OrderBookEntry {
                price: Decimal::new(120, 2), // 1.20
                quantity: Decimal::new(500, 0), // 500
                order_count: 5,
            },
            OrderBookEntry {
                price: Decimal::new(115, 2), // 1.15
                quantity: Decimal::new(1000, 0), // 1000
                order_count: 8,
            },
        ],
        sell_orders: vec![
            OrderBookEntry {
                price: Decimal::new(130, 2), // 1.30
                quantity: Decimal::new(800, 0), // 800
                order_count: 4,
            },
            OrderBookEntry {
                price: Decimal::new(140, 2), // 1.40
                quantity: Decimal::new(1200, 0), // 1200
                order_count: 6,
            },
        ],
        last_price: Some(Decimal::new(125, 2)), // 1.25
        last_updated: Utc::now(),
    };
    
    HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(sample_order_book),
        error: None,
    })
}

// Get positions
async fn get_positions(
    user_id: web::Path<String>
) -> impl Responder {
    // Convert string to UUID
    let user_id = match Uuid::from_str(&user_id) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::BadRequest().json(ApiResponse::<serde_json::Value> {
                success: false,
                data: None,
                error: Some("Invalid user ID format".to_string()),
            });
        }
    };
    
    info!("Get positions request for user_id={}", user_id);
    
    // Create sample positions
    let sample_positions = vec![
        Position {
            id: Uuid::new_v4(),
            user_id,
            market_id: 1,
            market_option_id: 2,
            quantity: Decimal::new(500, 0), // 500
            average_entry_price: Decimal::new(120, 2), // 1.20
            realized_pnl: Decimal::new(50, 0), // 50
            created_at: Utc::now(),
            updated_at: Utc::now(),
        },
        Position {
            id: Uuid::new_v4(),
            user_id,
            market_id: 2,
            market_option_id: 4,
            quantity: Decimal::new(-200, 0), // -200 (short position)
            average_entry_price: Decimal::new(220, 2), // 2.20
            realized_pnl: Decimal::new(30, 0), // 30
            created_at: Utc::now(),
            updated_at: Utc::now(),
        },
    ];
    
    // Calculate position summaries with P&L
    let mut position_summaries = Vec::new();
    
    for position in sample_positions {
        // Use mock current prices
        let current_price = match position.market_option_id {
            2 => Decimal::new(135, 2), // 1.35
            4 => Decimal::new(210, 2), // 2.10
            _ => Decimal::new(100, 2), // 1.00 default
        };
        
        let market_value = position.quantity * current_price;
        
        // Calculate unrealized P&L
        let cost_basis = position.quantity * position.average_entry_price;
        let unrealized_pnl = market_value - cost_basis;
        
        // Calculate percentage P&L
        let unrealized_pnl_percentage = if !cost_basis.is_zero() {
            Some((unrealized_pnl / cost_basis) * Decimal::new(100, 0))
        } else {
            None
        };
        
        // Total P&L (realized + unrealized)
        let total_pnl = position.realized_pnl + unrealized_pnl;
        
        position_summaries.push(PositionSummary {
            position,
            current_price: Some(current_price),
            market_value: Some(market_value),
            unrealized_pnl: Some(unrealized_pnl),
            unrealized_pnl_percentage,
            total_pnl: Some(total_pnl),
        });
    }
    
    // Calculate portfolio summary
    let portfolio_value = position_summaries.iter()
        .fold(Decimal::new(0, 0), |acc, p| acc + p.market_value.unwrap_or_default());
    
    let total_realized_pnl = position_summaries.iter()
        .fold(Decimal::new(0, 0), |acc, p| acc + p.position.realized_pnl);
    
    let total_unrealized_pnl = position_summaries.iter()
        .fold(Decimal::new(0, 0), |acc, p| acc + p.unrealized_pnl.unwrap_or_default());
    
    HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(serde_json::json!({
            "positions": position_summaries,
            "portfolio_summary": {
                "total_value": portfolio_value,
                "total_realized_pnl": total_realized_pnl,
                "total_unrealized_pnl": total_unrealized_pnl,
                "total_pnl": total_realized_pnl + total_unrealized_pnl
            }
        })),
        error: None,
    })
}

// Simple health check endpoint
async fn health_check() -> impl Responder {
    HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(serde_json::json!({
            "status": "healthy",
            "timestamp": Utc::now().to_string(),
            "version": env!("CARGO_PKG_VERSION")
        })),
        error: None,
    })
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Load environment variables
    dotenv().ok();
    
    // Setup logging
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .with_thread_ids(true)
        .with_target(true)
        .finish();
    
    tracing::subscriber::set_global_default(subscriber)
        .expect("Failed to set subscriber");
    
    // Get port from environment
    let port = env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse::<u16>()
        .expect("PORT must be a number");
    
    let workers = env::var("SERVER_WORKERS")
        .unwrap_or_else(|_| num_cpus::get().to_string())
        .parse::<usize>()
        .expect("SERVER_WORKERS must be a number");
    
    // Create service instances
    let order_matcher = web::Data::new(OrderMatcher::new());
    let market_pricer = web::Data::new(MarketPricer::new());
    let position_manager = web::Data::new(PositionManager::new());
    
    // Create WebSocket server
    let ws_server = WsServer::default().start();
    let ws_server = web::Data::new(ws_server);
    
    info!("Starting trading engine server on port {}", port);
    
    // Create and start HTTP server
    HttpServer::new(move || {
        // Configure CORS
        let cors = Cors::default()
            .allow_any_origin()
            .allowed_methods(vec!["GET", "POST", "PUT", "DELETE"])
            .allowed_headers(vec!["Content-Type", "Authorization", "Accept"])
            .max_age(3600);
        
        App::new()
            // Register services
            .app_data(order_matcher.clone())
            .app_data(market_pricer.clone())
            .app_data(position_manager.clone())
            .app_data(ws_server.clone())
            // Middleware
            .wrap(middleware::Logger::default())
            .wrap(middleware::Compress::default())
            .wrap(cors)
            // API routes
            .route("/health", web::get().to(health_check))
            .route("/ws", web::get().to(ws_handler))
            .service(
                web::scope("/api/v1")
                    .route("/orders", web::post().to(create_order))
                    .route("/markets/{market_id}/options/{option_id}/orderbook", 
                           web::get().to(get_order_book))
                    .route("/users/{user_id}/positions", 
                           web::get().to(get_positions))
            )
    })
    .workers(workers)
    .keep_alive(std::time::Duration::from_secs(75))
    .bind(("0.0.0.0", port))?
    .run()
    .await
} 