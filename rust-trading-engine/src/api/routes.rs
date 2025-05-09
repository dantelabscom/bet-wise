use std::convert::Infallible;
use std::sync::Arc;
use log::error;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use warp::{self, Filter, Rejection, Reply};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;

use crate::models::{Market, Order, OrderSide, OutcomeSide};
use crate::services::order_service::OrderService;
use crate::services::bot_service::{BotService, BotStrategy};
use crate::services::settlement_service::SettlementService;
use crate::db::connection::Repository;

/// Request to create a new market
#[derive(Debug, Deserialize)]
pub struct CreateMarketRequest {
    pub market_id: String,
    pub question: String,
    pub description: String,
    pub close_time: Option<DateTime<Utc>>,
}

/// Request to submit a new order
#[derive(Debug, Deserialize)]
pub struct SubmitOrderRequest {
    pub user_id: Uuid,
    pub market_id: String,
    pub side: OrderSide,
    pub outcome: OutcomeSide,
    pub price: Decimal,
    pub quantity: u32,
}

/// Request to cancel an order
#[derive(Debug, Deserialize)]
pub struct CancelOrderRequest {
    pub market_id: String,
    pub order_id: Uuid,
}

/// Request to resolve a market
#[derive(Debug, Deserialize)]
pub struct ResolveMarketRequest {
    pub market_id: String,
    pub outcome: OutcomeSide,
}

/// Request to start a bot on a market
#[derive(Debug, Deserialize)]
pub struct StartBotRequest {
    pub market_id: String,
    pub strategy: String,
}

/// Standard API response wrapper
#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }
    
    pub fn error(message: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message),
        }
    }
}

/// Sets up all API routes
pub fn routes<R: Repository + Send + Sync + 'static>(
    order_service: Arc<OrderService<R>>,
    bot_service: Arc<BotService<R>>,
    settlement_service: Arc<SettlementService<R>>,
) -> impl Filter<Extract = impl Reply, Error = Rejection> + Clone {
    let api = warp::path("api");
    let markets = api.and(warp::path("markets"));
    let orders = api.and(warp::path("orders"));
    let bots = api.and(warp::path("bots"));
    
    // GET /api/markets - List all markets
    let list_markets = markets
        .and(warp::get())
        .and(with_order_service(order_service.clone()))
        .and_then(handle_list_markets);
    
    // POST /api/markets - Create a new market
    let create_market = markets
        .and(warp::post())
        .and(warp::body::json())
        .and(with_order_service(order_service.clone()))
        .and_then(handle_create_market);
    
    // GET /api/markets/:id - Get a market by ID
    let get_market = markets
        .and(warp::get())
        .and(warp::path::param::<String>())
        .and(with_order_service(order_service.clone()))
        .and_then(handle_get_market);
    
    // POST /api/markets/:id/resolve - Resolve a market
    let resolve_market = markets
        .and(warp::path::param::<String>())
        .and(warp::path("resolve"))
        .and(warp::post())
        .and(warp::body::json())
        .and(with_order_service(order_service.clone()))
        .and(with_settlement_service(settlement_service.clone()))
        .and_then(handle_resolve_market);
    
    // POST /api/orders - Submit a new order
    let submit_order = orders
        .and(warp::post())
        .and(warp::body::json())
        .and(with_order_service(order_service.clone()))
        .and_then(handle_submit_order);
    
    // DELETE /api/orders/:id - Cancel an order
    let cancel_order = orders
        .and(warp::delete())
        .and(warp::path::param::<Uuid>())
        .and(warp::body::json())
        .and(with_order_service(order_service.clone()))
        .and_then(handle_cancel_order);
    
    // GET /api/orders/user/:user_id/market/:market_id - Get user orders for a market
    let get_user_orders = orders
        .and(warp::get())
        .and(warp::path("user"))
        .and(warp::path::param::<Uuid>())
        .and(warp::path("market"))
        .and(warp::path::param::<String>())
        .and(with_order_service(order_service.clone()))
        .and_then(handle_get_user_orders);
    
    // POST /api/bots/start - Start a bot for a market
    let start_bot = bots
        .and(warp::path("start"))
        .and(warp::post())
        .and(warp::body::json())
        .and(with_bot_service(bot_service.clone()))
        .and_then(handle_start_bot);
    
    // POST /api/bots/stop/:market_id - Stop a bot for a market
    let stop_bot = bots
        .and(warp::path("stop"))
        .and(warp::path::param::<String>())
        .and(warp::post())
        .and(with_bot_service(bot_service.clone()))
        .and_then(handle_stop_bot);
    
    // Combine all routes
    list_markets
        .or(create_market)
        .or(get_market)
        .or(resolve_market)
        .or(submit_order)
        .or(cancel_order)
        .or(get_user_orders)
        .or(start_bot)
        .or(stop_bot)
        .with(warp::log("api"))
}

// Helper function to extract the order service from the filter context
fn with_order_service<R: Repository + Send + Sync + 'static>(
    order_service: Arc<OrderService<R>>,
) -> impl Filter<Extract = (Arc<OrderService<R>>,), Error = Infallible> + Clone {
    warp::any().map(move || order_service.clone())
}

// Helper function to extract the bot service from the filter context
fn with_bot_service<R: Repository + Send + Sync + 'static>(
    bot_service: Arc<BotService<R>>,
) -> impl Filter<Extract = (Arc<BotService<R>>,), Error = Infallible> + Clone {
    warp::any().map(move || bot_service.clone())
}

// Helper function to extract the settlement service from the filter context
fn with_settlement_service<R: Repository + Send + Sync + 'static>(
    settlement_service: Arc<SettlementService<R>>,
) -> impl Filter<Extract = (Arc<SettlementService<R>>,), Error = Infallible> + Clone {
    warp::any().map(move || settlement_service.clone())
}

// Handler for listing all markets
async fn handle_list_markets<R: Repository + Send + Sync + 'static>(
    order_service: Arc<OrderService<R>>,
) -> Result<impl Reply, Rejection> {
    // In a real implementation, this would fetch markets from a database
    let markets: Vec<Market> = Vec::new();
    Ok(warp::reply::json(&ApiResponse::success(markets)))
}

// Handler for creating a new market
async fn handle_create_market<R: Repository + Send + Sync + 'static>(
    req: CreateMarketRequest,
    order_service: Arc<OrderService<R>>,
) -> Result<impl Reply, Rejection> {
    let market = Market::new(
        req.market_id,
        req.question,
        req.description,
        req.close_time,
    );
    
    match order_service.create_market(market).await {
        Ok(_) => Ok(warp::reply::json(&ApiResponse::<()>::success(()))),
        Err(e) => {
            error!("Failed to create market: {}", e);
            Ok(warp::reply::json(&ApiResponse::<()>::error(e.to_string())))
        }
    }
}

// Handler for getting a market by ID
async fn handle_get_market<R: Repository + Send + Sync + 'static>(
    market_id: String,
    order_service: Arc<OrderService<R>>,
) -> Result<impl Reply, Rejection> {
    match order_service.get_market(&market_id).await {
        Ok(market) => Ok(warp::reply::json(&ApiResponse::success(market))),
        Err(e) => {
            error!("Failed to get market {}: {}", market_id, e);
            Ok(warp::reply::json(&ApiResponse::<Market>::error(e.to_string())))
        }
    }
}

// Handler for resolving a market
async fn handle_resolve_market<R: Repository + Send + Sync + 'static>(
    market_id: String,
    req: ResolveMarketRequest,
    _order_service: Arc<OrderService<R>>,
    settlement_service: Arc<SettlementService<R>>,
) -> Result<impl Reply, Rejection> {
    match settlement_service.resolve_market(&market_id, req.outcome).await {
        Ok(resolved_market) => {
            Ok(warp::reply::json(&ApiResponse::success(resolved_market)))
        }
        Err(e) => {
            error!("Failed to resolve market {}: {}", market_id, e);
            Ok(warp::reply::json(&ApiResponse::<()>::error(e.to_string())))
        }
    }
}

// Handler for submitting a new order
async fn handle_submit_order<R: Repository + Send + Sync + 'static>(
    req: SubmitOrderRequest,
    order_service: Arc<OrderService<R>>,
) -> Result<impl Reply, Rejection> {
    let order = Order::new(
        req.user_id,
        req.market_id,
        req.side,
        req.outcome,
        req.price,
        req.quantity,
    );
    
    match order_service.submit_order(order).await {
        Ok(result) => Ok(warp::reply::json(&ApiResponse::success(result))),
        Err(e) => {
            error!("Failed to submit order: {}", e);
            Ok(warp::reply::json(&ApiResponse::<()>::error(e.to_string())))
        }
    }
}

// Handler for cancelling an order
async fn handle_cancel_order<R: Repository + Send + Sync + 'static>(
    order_id: Uuid,
    _req: CancelOrderRequest,
    order_service: Arc<OrderService<R>>,
) -> Result<impl Reply, Rejection> {
    match order_service.cancel_order(order_id).await {
        Ok(order) => Ok(warp::reply::json(&ApiResponse::success(order))),
        Err(e) => {
            error!("Failed to cancel order {}: {}", order_id, e);
            Ok(warp::reply::json(&ApiResponse::<Order>::error(e.to_string())))
        }
    }
}

// Handler for getting user orders for a market
async fn handle_get_user_orders<R: Repository + Send + Sync + 'static>(
    user_id: Uuid,
    market_id: String,
    order_service: Arc<OrderService<R>>,
) -> Result<impl Reply, Rejection> {
    match order_service.get_orders_for_user(&market_id, user_id).await {
        Ok(orders) => Ok(warp::reply::json(&ApiResponse::success(orders))),
        Err(e) => {
            error!("Failed to get orders for user {} in market {}: {}", user_id, market_id, e);
            Ok(warp::reply::json(&ApiResponse::<Vec<Order>>::error(e.to_string())))
        }
    }
}

// Handler for starting a bot for a market
async fn handle_start_bot<R: Repository + Send + Sync + 'static>(
    req: StartBotRequest,
    bot_service: Arc<BotService<R>>,
) -> Result<impl Reply, Rejection> {
    // Parse the strategy
    let strategy = match req.strategy.as_str() {
        "market_maker" => BotStrategy::MarketMaker,
        "noise_trader" => BotStrategy::NoiseTrader,
        _ => {
            return Ok(warp::reply::json(&ApiResponse::<()>::error(
                format!("Unknown bot strategy: {}", req.strategy)
            )));
        }
    };
    
    match bot_service.start_bot(req.market_id, strategy).await {
        Ok(_) => Ok(warp::reply::json(&ApiResponse::<()>::success(()))),
        Err(e) => {
            error!("Failed to start bot: {}", e);
            Ok(warp::reply::json(&ApiResponse::<()>::error(e.to_string())))
        }
    }
}

// Handler for stopping a bot for a market
async fn handle_stop_bot<R: Repository + Send + Sync + 'static>(
    market_id: String,
    bot_service: Arc<BotService<R>>,
) -> Result<impl Reply, Rejection> {
    match bot_service.stop_bot(&market_id).await {
        Ok(_) => Ok(warp::reply::json(&ApiResponse::<()>::success(()))),
        Err(e) => {
            error!("Failed to stop bot: {}", e);
            Ok(warp::reply::json(&ApiResponse::<()>::error(e.to_string())))
        }
    }
} 