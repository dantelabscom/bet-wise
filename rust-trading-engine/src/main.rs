use actix::Actor;
use actix_cors::Cors;
use actix_web::{
    web, App, HttpServer, middleware, HttpResponse, Responder, 
    http::StatusCode, body::BoxBody, error::ResponseError
};
use chrono::Utc;
use dotenv::dotenv;
use num_cpus;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, postgres::PgPoolOptions};
use std::env;
use std::sync::Arc;
use std::str::FromStr;
use tracing::{info, error, debug, Level};
use tracing_subscriber::FmtSubscriber;
use uuid::Uuid;
use std::fmt;

use trading_engine::{
    models::{
        OrderCreationParams, Order, OrderBook, OrderBookEntry, OrderStatus, OrderType, 
        OrderSide, TradeResult, Market, MarketOption, MarketStatus, MarketType, 
        Position, PositionUpdateParams, PositionSummary
    },
    services::{
        matching::OrderMatcher,
        pricing::MarketPricer,
        position::PositionManager,
        websocket::{WsServer, Broadcast, ws_handler, WsMessage, OrderBookMessage, PriceUpdateMessage}
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

// Custom error type for API responses
struct ApiError {
    status_code: StatusCode,
    message: String,
}

impl fmt::Debug for ApiError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "ApiError {{ status_code: {}, message: {} }}", self.status_code, self.message)
    }
}

impl fmt::Display for ApiError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl ResponseError for ApiError {
    fn status_code(&self) -> StatusCode {
        self.status_code
    }

    fn error_response(&self) -> HttpResponse {
        let body = ApiResponse::<()> {
            success: false,
            data: None,
            error: Some(self.message.clone()),
        };
        
        HttpResponse::build(self.status_code)
            .json(body)
    }
}

impl Responder for ApiError {
    type Body = BoxBody;

    fn respond_to(self, _: &actix_web::HttpRequest) -> HttpResponse {
        self.error_response()
    }
}

// Database error handling helper
impl From<sqlx::Error> for ApiError {
    fn from(err: sqlx::Error) -> Self {
        error!("Database error: {:?}", err);
        ApiError {
            status_code: StatusCode::INTERNAL_SERVER_ERROR,
            message: "Database operation failed".to_string(),
        }
    }
}

// API handler to create a new order
async fn create_order(
    order_params: web::Json<OrderCreationParams>,
    matcher: web::Data<OrderMatcher>,
    pricer: web::Data<MarketPricer>,
    position_manager: web::Data<PositionManager>,
    ws_server: web::Data<WsServer>,
    db_pool: web::Data<PgPool>
) -> Result<impl Responder, ApiError> {
    info!("Received order creation request for market_id={}, option_id={}", 
          order_params.market_id, order_params.market_option_id);
    
    // 1. Validate the order
    if order_params.quantity.is_sign_negative() || order_params.quantity.is_zero() {
        return Err(ApiError {
            status_code: StatusCode::BAD_REQUEST,
            message: "Order quantity must be positive".to_string(),
        });
    }
    
    if order_params.order_type == OrderType::Limit && order_params.price.is_zero() {
        return Err(ApiError {
            status_code: StatusCode::BAD_REQUEST,
            message: "Limit orders must have a non-zero price".to_string(),
        });
    }
    
    // 2. Fetch market data to ensure it exists and is active
    let market = sqlx::query_as!(
        Market,
        r#"
        SELECT id, name, description, 
               market_type as "market_type!: MarketType", 
               status as "status!: MarketStatus", 
               event_id, event_start_time, event_end_time, 
               resolution as "resolution: Option<serde_json::Value>", 
               resolution_time, trading_volume, metadata,
               created_at, updated_at 
        FROM markets
        WHERE id = $1
        "#,
        order_params.market_id
    )
    .fetch_one(db_pool.get_ref())
    .await
    .map_err(|_| ApiError {
        status_code: StatusCode::NOT_FOUND,
        message: "Market not found".to_string(),
    })?;
    
    // Verify market is in a tradable state
    if market.status != MarketStatus::Open {
        return Err(ApiError {
            status_code: StatusCode::BAD_REQUEST,
            message: format!("Market is not open for trading (status: {:?})", market.status),
        });
    }
    
    // 3. Fetch market option
    let market_option = sqlx::query_as!(
        MarketOption,
        r#"
        SELECT id, market_id, name, initial_price, current_price, 
               last_price, min_price, max_price, metadata, weight,
               created_at, updated_at
        FROM market_options
        WHERE id = $1 AND market_id = $2
        "#,
        order_params.market_option_id,
        order_params.market_id
    )
    .fetch_one(db_pool.get_ref())
    .await
    .map_err(|_| ApiError {
        status_code: StatusCode::NOT_FOUND,
        message: "Market option not found".to_string(),
    })?;
    
    // 4. Create the order
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
    
    // Begin transaction
    let mut tx = db_pool.begin().await?;
    
    // Save order to database
    sqlx::query!(
        r#"
        INSERT INTO orders 
        (id, user_id, market_id, market_option_id, type, side, price, quantity, 
         filled_quantity, status, expires_at, created_at, updated_at)
        VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        "#,
        order.id,
        order.user_id,
        order.market_id,
        order.market_option_id,
        order.order_type.to_string(),
        order.side.to_string(),
        order.price,
        order.quantity,
        order.filled_quantity,
        order.status.to_string(),
        order.expires_at,
        order.created_at,
        order.updated_at,
    )
    .execute(&mut tx)
    .await?;
    
    // 5. Fetch the current order book from DB
    let buy_orders = sqlx::query!(
        r#"
        SELECT price, SUM(quantity - filled_quantity) as total_quantity, COUNT(*) as order_count
        FROM orders
        WHERE market_id = $1 AND market_option_id = $2 AND side = 'buy' AND status = 'open'
        GROUP BY price
        ORDER BY price DESC
        LIMIT 50
        "#,
        order.market_id,
        order.market_option_id
    )
    .fetch_all(&mut tx)
    .await?;
    
    let sell_orders = sqlx::query!(
        r#"
        SELECT price, SUM(quantity - filled_quantity) as total_quantity, COUNT(*) as order_count
        FROM orders
        WHERE market_id = $1 AND market_option_id = $2 AND side = 'sell' AND status = 'open'
        GROUP BY price
        ORDER BY price ASC
        LIMIT 50
        "#,
        order.market_id,
        order.market_option_id
    )
    .fetch_all(&mut tx)
    .await?;
    
    // Convert to OrderBookEntry
    let buy_entries = buy_orders
        .iter()
        .map(|row| OrderBookEntry {
            price: row.price,
            quantity: row.total_quantity.unwrap_or_default(),
            order_count: row.order_count as i32,
        })
        .collect();
    
    let sell_entries = sell_orders
        .iter()
        .map(|row| OrderBookEntry {
            price: row.price,
            quantity: row.total_quantity.unwrap_or_default(),
            order_count: row.order_count as i32,
        })
        .collect();
    
    // Get the last price
    let last_price = sqlx::query!(
        r#"
        SELECT price FROM orders 
        WHERE market_id = $1 AND market_option_id = $2 AND status = 'filled'
        ORDER BY updated_at DESC
        LIMIT 1
        "#,
        order.market_id,
        order.market_option_id
    )
    .fetch_optional(&mut tx)
    .await?
    .map(|row| row.price);
    
    let order_book = OrderBook {
        market_id: order.market_id,
        market_option_id: order.market_option_id,
        buy_orders: buy_entries,
        sell_orders: sell_entries,
        last_price,
        last_updated: Utc::now(),
    };
    
    // 6. Run through the matching engine
    let trade_result = matcher.match_order(&order, &order_book).await
        .map_err(|e| ApiError {
            status_code: StatusCode::INTERNAL_SERVER_ERROR,
            message: format!("Order matching error: {}", e),
        })?;
    
    // 7. Update order status and filled quantity in the database
    sqlx::query!(
        r#"
        UPDATE orders 
        SET status = $1, filled_quantity = $2, updated_at = $3
        WHERE id = $4
        "#,
        trade_result.status.to_string(),
        trade_result.filled_quantity,
        Utc::now(),
        order.id,
    )
    .execute(&mut tx)
    .await?;
    
    // 8. Record matches
    for (index, order_match) in trade_result.matches.iter().enumerate() {
        // Find the maker order that was matched
        let maker_orders = sqlx::query!(
            r#"
            SELECT id, user_id, filled_quantity, quantity, status
            FROM orders
            WHERE market_id = $1 AND market_option_id = $2 AND side != $3 AND status IN ('open', 'partially_filled')
            ORDER BY 
                CASE WHEN $3 = 'buy' THEN price END ASC,
                CASE WHEN $3 = 'sell' THEN price END DESC,
                created_at ASC
            LIMIT 1
            "#,
            order.market_id,
            order.market_option_id,
            order.side.to_string(),
        )
        .fetch_one(&mut tx)
        .await
        .map_err(|e| {
            error!("Failed to find maker order: {}", e);
            ApiError {
                status_code: StatusCode::INTERNAL_SERVER_ERROR,
                message: format!("Failed to find maker order: {}", e),
            }
        })?;
        
        let maker_order_id = maker_orders.id;
        
        // Record the match
        sqlx::query!(
            r#"
            INSERT INTO order_matches
            (id, taker_order_id, maker_order_id, price, quantity, timestamp)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
            "#,
            order_match.taker_order_id,
            maker_order_id,
            order_match.price,
            order_match.quantity,
            order_match.timestamp,
        )
        .execute(&mut tx)
        .await?;
        
        // Update maker order
        let new_filled_quantity = maker_orders.filled_quantity + order_match.quantity;
        let new_status = if new_filled_quantity >= maker_orders.quantity {
            OrderStatus::Filled
        } else {
            OrderStatus::PartiallyFilled
        };
        
        sqlx::query!(
            r#"
            UPDATE orders
            SET filled_quantity = $1, status = $2, updated_at = $3
            WHERE id = $4
            "#,
            new_filled_quantity,
            new_status.to_string(),
            Utc::now(),
            maker_order_id,
        )
        .execute(&mut tx)
        .await?;
        
        // 9. Update positions for both sides
        
        // Taker position update
        let taker_params = PositionUpdateParams {
            user_id: order.user_id,
            market_id: order.market_id,
            market_option_id: order.market_option_id,
            quantity_delta: match order.side {
                OrderSide::Buy => order_match.quantity,
                OrderSide::Sell => -order_match.quantity,
            },
            price: order_match.price,
        };
        
        // Get current position
        let taker_current_position = sqlx::query_as!(
            Position,
            r#"
            SELECT * FROM positions
            WHERE user_id = $1 AND market_id = $2 AND market_option_id = $3
            FOR UPDATE
            "#,
            taker_params.user_id,
            taker_params.market_id,
            taker_params.market_option_id,
        )
        .fetch_optional(&mut tx)
        .await?;
        
        // Update position
        let updated_taker_position = position_manager.update_position(
            taker_params, 
            taker_current_position
        )
        .map_err(|e| ApiError {
            status_code: StatusCode::INTERNAL_SERVER_ERROR,
            message: format!("Position update error: {}", e),
        })?;
        
        // Save position change
        if taker_current_position.is_some() {
            sqlx::query!(
                r#"
                UPDATE positions
                SET quantity = $1, average_entry_price = $2, realized_pnl = $3, updated_at = $4
                WHERE id = $5
                "#,
                updated_taker_position.quantity,
                updated_taker_position.average_entry_price,
                updated_taker_position.realized_pnl,
                updated_taker_position.updated_at,
                updated_taker_position.id,
            )
            .execute(&mut tx)
            .await?;
        } else {
            sqlx::query!(
                r#"
                INSERT INTO positions
                (id, user_id, market_id, market_option_id, quantity, average_entry_price, 
                 realized_pnl, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                "#,
                updated_taker_position.id,
                updated_taker_position.user_id,
                updated_taker_position.market_id,
                updated_taker_position.market_option_id,
                updated_taker_position.quantity,
                updated_taker_position.average_entry_price,
                updated_taker_position.realized_pnl,
                updated_taker_position.created_at,
                updated_taker_position.updated_at,
            )
            .execute(&mut tx)
            .await?;
        }
        
        // Maker position update
        let maker_params = PositionUpdateParams {
            user_id: maker_orders.user_id,
            market_id: order.market_id,
            market_option_id: order.market_option_id,
            quantity_delta: match order.side {
                OrderSide::Buy => -order_match.quantity, // Opposite of taker
                OrderSide::Sell => order_match.quantity, // Opposite of taker
            },
            price: order_match.price,
        };
        
        // Get current position
        let maker_current_position = sqlx::query_as!(
            Position,
            r#"
            SELECT * FROM positions
            WHERE user_id = $1 AND market_id = $2 AND market_option_id = $3
            FOR UPDATE
            "#,
            maker_params.user_id,
            maker_params.market_id,
            maker_params.market_option_id,
        )
        .fetch_optional(&mut tx)
        .await?;
        
        // Update position
        let updated_maker_position = position_manager.update_position(
            maker_params, 
            maker_current_position
        )
        .map_err(|e| ApiError {
            status_code: StatusCode::INTERNAL_SERVER_ERROR,
            message: format!("Position update error: {}", e),
        })?;
        
        // Save position change
        if maker_current_position.is_some() {
            sqlx::query!(
                r#"
                UPDATE positions
                SET quantity = $1, average_entry_price = $2, realized_pnl = $3, updated_at = $4
                WHERE id = $5
                "#,
                updated_maker_position.quantity,
                updated_maker_position.average_entry_price,
                updated_maker_position.realized_pnl,
                updated_maker_position.updated_at,
                updated_maker_position.id,
            )
            .execute(&mut tx)
            .await?;
        } else {
            sqlx::query!(
                r#"
                INSERT INTO positions
                (id, user_id, market_id, market_option_id, quantity, average_entry_price, 
                 realized_pnl, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                "#,
                updated_maker_position.id,
                updated_maker_position.user_id,
                updated_maker_position.market_id,
                updated_maker_position.market_option_id,
                updated_maker_position.quantity,
                updated_maker_position.average_entry_price,
                updated_maker_position.realized_pnl,
                updated_maker_position.created_at,
                updated_maker_position.updated_at,
            )
            .execute(&mut tx)
            .await?;
        }
        
        // Log the match details
        info!(
            "Match {}. Taker: {} ({:?}) with Maker: {} at price {} for quantity {}",
            index+1, order.id, order.side, maker_order_id, order_match.price, order_match.quantity
        );
    }
    
    // 10. Update market prices
    if !trade_result.matches.is_empty() {
        // Fetch all market options
        let options = sqlx::query_as!(
            MarketOption,
            r#"
            SELECT * FROM market_options
            WHERE market_id = $1
            "#,
            order.market_id
        )
        .fetch_all(&mut tx)
        .await?;
        
        // Create full market with options
        let market_with_options = Market {
            options: Some(options),
            ..market
        };
        
        // Calculate new prices based on the trade
        let updated_options = pricer.process_market_order(
            &market_with_options,
            order.market_option_id,
            order.side,
            trade_result.filled_quantity
        )
        .map_err(|e| ApiError {
            status_code: StatusCode::INTERNAL_SERVER_ERROR,
            message: format!("Price update error: {}", e),
        })?;
        
        // Update prices in database
        for option in updated_options {
            sqlx::query!(
                r#"
                UPDATE market_options
                SET current_price = $1, last_price = $2, updated_at = $3
                WHERE id = $4
                "#,
                option.current_price,
                option.last_price,
                Utc::now(),
                option.id,
            )
            .execute(&mut tx)
            .await?;
            
            // Record price history
            sqlx::query!(
                r#"
                INSERT INTO market_price_history
                (market_option_id, price, timestamp)
                VALUES ($1, $2, $3)
                "#,
                option.id,
                option.current_price,
                Utc::now(),
            )
            .execute(&mut tx)
            .await?;
            
            debug!(
                "Updated price for option {}: {} -> {}", 
                option.id, option.last_price.unwrap_or_default(), option.current_price
            );
        }
        
        // Update market trading volume
        let trade_volume = trade_result.matches.iter()
            .fold(Decimal::new(0, 0), |acc, m| acc + m.quantity * m.price);
        
        sqlx::query!(
            r#"
            UPDATE markets
            SET trading_volume = trading_volume + $1, updated_at = $2
            WHERE id = $3
            "#,
            trade_volume,
            Utc::now(),
            order.market_id,
        )
        .execute(&mut tx)
        .await?;
    }
    
    // Commit the transaction
    tx.commit().await?;
    
    // 11. Fetch the updated order book to broadcast
    let updated_buy_orders = sqlx::query!(
        r#"
        SELECT price, SUM(quantity - filled_quantity) as total_quantity, COUNT(*) as order_count
        FROM orders
        WHERE market_id = $1 AND market_option_id = $2 AND side = 'buy' AND status IN ('open', 'partially_filled')
        GROUP BY price
        ORDER BY price DESC
        LIMIT 50
        "#,
        order.market_id,
        order.market_option_id
    )
    .fetch_all(db_pool.get_ref())
    .await?;
    
    let updated_sell_orders = sqlx::query!(
        r#"
        SELECT price, SUM(quantity - filled_quantity) as total_quantity, COUNT(*) as order_count
        FROM orders
        WHERE market_id = $1 AND market_option_id = $2 AND side = 'sell' AND status IN ('open', 'partially_filled')
        GROUP BY price
        ORDER BY price ASC
        LIMIT 50
        "#,
        order.market_id,
        order.market_option_id
    )
    .fetch_all(db_pool.get_ref())
    .await?;
    
    // Convert to OrderBookEntry
    let updated_buy_entries = updated_buy_orders
        .iter()
        .map(|row| OrderBookEntry {
            price: row.price,
            quantity: row.total_quantity.unwrap_or_default(),
            order_count: row.order_count as i32,
        })
        .collect();
    
    let updated_sell_entries = updated_sell_orders
        .iter()
        .map(|row| OrderBookEntry {
            price: row.price,
            quantity: row.total_quantity.unwrap_or_default(),
            order_count: row.order_count as i32,
        })
        .collect();
    
    let updated_order_book = OrderBook {
        market_id: order.market_id,
        market_option_id: order.market_option_id,
        buy_orders: updated_buy_entries,
        sell_orders: updated_sell_entries,
        last_price,
        last_updated: Utc::now(),
    };
    
    // 12. Broadcast order book update via WebSocket
    // Use appropriate message format when integrating with WebSocket server
    let room_name = format!("market:{}", order.market_id);
    debug!("Broadcasting order book update to room: {}", room_name);
    
    // 13. Return success response with trade result
    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(trade_result),
        error: None,
    }))
}

// API handler to get order book
async fn get_order_book(
    path: web::Path<(i64, i64)>, // market_id, market_option_id
    db_pool: web::Data<PgPool>
) -> Result<impl Responder, ApiError> {
    let (market_id, market_option_id) = path.into_inner();
    info!("Get order book request for market_id={}, option_id={}", market_id, market_option_id);
    
    // Verify the market and option exist
    let market_option = sqlx::query!(
        r#"
        SELECT mo.id, m.status as "market_status!: MarketStatus"
        FROM market_options mo
        JOIN markets m ON mo.market_id = m.id
        WHERE mo.id = $1 AND mo.market_id = $2
        "#,
        market_option_id,
        market_id
    )
    .fetch_optional(db_pool.get_ref())
    .await?;
    
    if market_option.is_none() {
        return Err(ApiError {
            status_code: StatusCode::NOT_FOUND,
            message: "Market option not found".to_string(),
        });
    }
    
    let market_option = market_option.unwrap();
    
    // Check if market is tradable (can view orderbook)
    if market_option.market_status != MarketStatus::Open && 
       market_option.market_status != MarketStatus::Suspended {
        return Err(ApiError {
            status_code: StatusCode::BAD_REQUEST,
            message: format!("Market is not in a viewable state (status: {:?})", 
                            market_option.market_status),
        });
    }
    
    // Fetch buy orders, aggregated by price level
    let buy_orders = sqlx::query!(
        r#"
        SELECT price, SUM(quantity - filled_quantity) as total_quantity, COUNT(*) as order_count
        FROM orders
        WHERE market_id = $1 AND market_option_id = $2 AND side = 'buy' 
              AND status IN ('open', 'partially_filled')
        GROUP BY price
        ORDER BY price DESC
        LIMIT 50
        "#,
        market_id,
        market_option_id
    )
    .fetch_all(db_pool.get_ref())
    .await?;
    
    // Fetch sell orders, aggregated by price level
    let sell_orders = sqlx::query!(
        r#"
        SELECT price, SUM(quantity - filled_quantity) as total_quantity, COUNT(*) as order_count
        FROM orders
        WHERE market_id = $1 AND market_option_id = $2 AND side = 'sell' 
              AND status IN ('open', 'partially_filled')
        GROUP BY price
        ORDER BY price ASC
        LIMIT 50
        "#,
        market_id,
        market_option_id
    )
    .fetch_all(db_pool.get_ref())
    .await?;
    
    // Convert to OrderBookEntry
    let buy_entries = buy_orders
        .iter()
        .map(|row| OrderBookEntry {
            price: row.price,
            quantity: row.total_quantity.unwrap_or_default(),
            order_count: row.order_count as i32,
        })
        .collect();
    
    let sell_entries = sell_orders
        .iter()
        .map(|row| OrderBookEntry {
            price: row.price,
            quantity: row.total_quantity.unwrap_or_default(),
            order_count: row.order_count as i32,
        })
        .collect();
    
    // Get the last price from recent trades
    let last_price = sqlx::query!(
        r#"
        SELECT price FROM order_matches 
        WHERE taker_order_id IN (
            SELECT id FROM orders WHERE market_id = $1 AND market_option_id = $2
        )
        OR maker_order_id IN (
            SELECT id FROM orders WHERE market_id = $1 AND market_option_id = $2
        )
        ORDER BY timestamp DESC
        LIMIT 1
        "#,
        market_id,
        market_option_id
    )
    .fetch_optional(db_pool.get_ref())
    .await?
    .map(|row| row.price);
    
    // If no matches found, use current price from market option
    let last_price = if last_price.is_none() {
        sqlx::query!(
            r#"
            SELECT current_price FROM market_options
            WHERE id = $1 AND market_id = $2
            "#,
            market_option_id,
            market_id
        )
        .fetch_one(db_pool.get_ref())
        .await?
        .current_price
        .into()
    } else {
        last_price
    };
    
    // Construct the order book
    let order_book = OrderBook {
        market_id,
        market_option_id,
        buy_orders: buy_entries,
        sell_orders: sell_entries,
        last_price,
        last_updated: Utc::now(),
    };
    
    // In production, we would use Redis or similar for caching
    // frequent order book requests
    
    // Record user accessing the order book for analytics
    let _ = sqlx::query!(
        r#"
        INSERT INTO order_book_views (market_id, market_option_id, timestamp)
        VALUES ($1, $2, $3)
        "#,
        market_id,
        market_option_id,
        Utc::now()
    )
    .execute(db_pool.get_ref())
    .await;
    
    Ok(HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(order_book),
        error: None,
    }))
}

// API handler to get user positions
async fn get_positions(
    user_id: web::Path<String>,
    db_pool: web::Data<PgPool>
) -> Result<impl Responder, ApiError> {
    // Convert string to UUID
    let user_id = match Uuid::from_str(&user_id) {
        Ok(id) => id,
        Err(_) => {
            return Err(ApiError {
                status_code: StatusCode::BAD_REQUEST,
                message: "Invalid user ID format".to_string(),
            });
        }
    };
    
    info!("Get positions request for user_id={}", user_id);
    
    // Verify user exists
    let user_exists = sqlx::query!(
        r#"
        SELECT COUNT(*) as count FROM users WHERE id = $1
        "#,
        user_id
    )
    .fetch_one(db_pool.get_ref())
    .await?;
    
    if user_exists.count.unwrap_or_default() == 0 {
        return Err(ApiError {
            status_code: StatusCode::NOT_FOUND,
            message: "User not found".to_string(),
        });
    }
    
    // Fetch all positions for the user
    let positions = sqlx::query_as!(
        Position,
        r#"
        SELECT * FROM positions
        WHERE user_id = $1
        "#,
        user_id
    )
    .fetch_all(db_pool.get_ref())
    .await?;
    
    // For each position, calculate current value and P&L
    let mut position_summaries = Vec::new();
    
    for position in positions {
        // Get current price from the market option
        let option = sqlx::query!(
            r#"
            SELECT current_price, m.status as "market_status!: MarketStatus" 
            FROM market_options mo
            JOIN markets m ON mo.market_id = m.id
            WHERE mo.id = $1
            "#,
            position.market_option_id
        )
        .fetch_one(db_pool.get_ref())
        .await?;
        
        let current_price = option.current_price;
        
        // Calculate market value of position
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
        
        // Add to summaries
        position_summaries.push(PositionSummary {
            position,
            current_price: Some(current_price),
            market_value: Some(market_value),
            unrealized_pnl: Some(unrealized_pnl),
            unrealized_pnl_percentage,
            total_pnl: Some(total_pnl),
        });
    }
    
    // Get total portfolio value and P&L
    let portfolio_value = position_summaries.iter()
        .fold(Decimal::new(0, 0), |acc, p| acc + p.market_value.unwrap_or_default());
    
    let total_realized_pnl = position_summaries.iter()
        .fold(Decimal::new(0, 0), |acc, p| acc + p.position.realized_pnl);
    
    let total_unrealized_pnl = position_summaries.iter()
        .fold(Decimal::new(0, 0), |acc, p| acc + p.unrealized_pnl.unwrap_or_default());
    
    // Record the position lookup for analytics
    let _ = sqlx::query!(
        r#"
        INSERT INTO position_views (user_id, timestamp)
        VALUES ($1, $2)
        "#,
        user_id,
        Utc::now()
    )
    .execute(db_pool.get_ref())
    .await;
    
    Ok(HttpResponse::Ok().json(ApiResponse {
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
    }))
}

// API handler to create a new order - Called when in dummy mode
async fn create_order_dummy(
    order_params: web::Json<OrderCreationParams>,
    matcher: web::Data<OrderMatcher>,
    pricer: web::Data<MarketPricer>,
    position_manager: web::Data<PositionManager>
) -> impl Responder {
    info!("DUMMY MODE: Received order creation request for market_id={}, option_id={}", 
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
    
    // Create a sample order book for testing
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
    
    // Match the order
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
    
    info!("DUMMY MODE: Order matched: filled_quantity={}, status={:?}", 
          trade_result.filled_quantity, trade_result.status);
    
    // Return simulated successful response
    HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(trade_result),
        error: None,
    })
}

// Get order book - dummy version
async fn get_order_book_dummy() -> impl Responder {
    let market_id = 1;
    let market_option_id = 1;
    
    info!("DUMMY MODE: Get order book request for market_id={}, option_id={}", market_id, market_option_id);
    
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

// Get positions - dummy version
async fn get_positions_dummy() -> impl Responder {
    let user_id = Uuid::new_v4();
    
    info!("DUMMY MODE: Get positions request for user_id={}", user_id);
    
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

// Simple health check endpoint that works in any mode
async fn health_check(db_pool: web::Data<PgPool>) -> impl Responder {
    // Try to check database connection
    match sqlx::query("SELECT 1").execute(db_pool.get_ref()).await {
        Ok(_) => HttpResponse::Ok().json(ApiResponse {
            success: true,
            data: Some(serde_json::json!({
                "status": "healthy",
                "database": "connected",
                "timestamp": Utc::now().to_string(),
                "version": env!("CARGO_PKG_VERSION")
            })),
            error: None,
        }),
        Err(e) => {
            // Check if we're in dummy mode
            if env::var("DUMMY_MODE").unwrap_or_else(|_| "false".to_string())
                .parse::<bool>().unwrap_or(false) {
                // In dummy mode, pretend everything is fine
                HttpResponse::Ok().json(ApiResponse {
                    success: true,
                    data: Some(serde_json::json!({
                        "status": "healthy",
                        "database": "dummy",
                        "timestamp": Utc::now().to_string(),
                        "version": env!("CARGO_PKG_VERSION")
                    })),
                    error: None,
                })
            } else {
                error!("Database health check failed: {}", e);
                HttpResponse::ServiceUnavailable().json(ApiResponse::<serde_json::Value> {
                    success: false,
                    data: None,
                    error: Some(format!("Database connection error: {}", e)),
                })
            }
        }
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Load environment variables
    dotenv().ok();
    
    // Setup logging with more detailed configuration
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .with_thread_ids(true)
        .with_target(true)
        .with_file(true)
        .with_line_number(true)
        .finish();
    
    tracing::subscriber::set_global_default(subscriber)
        .expect("Failed to set subscriber");
    
    // Get configuration from environment with better error handling
    let dummy_mode = env::var("DUMMY_MODE").unwrap_or_else(|_| "false".to_string())
        .parse::<bool>().unwrap_or(false);
        
    info!("Running in {} mode", if dummy_mode { "DUMMY" } else { "PRODUCTION" });
    
    let port = env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse::<u16>()
        .expect("PORT must be a number");
    
    let workers = env::var("SERVER_WORKERS")
        .unwrap_or_else(|_| num_cpus::get().to_string())
        .parse::<usize>()
        .expect("SERVER_WORKERS must be a number");
    
    // Create services
    let order_matcher = web::Data::new(OrderMatcher::new());
    let market_pricer = web::Data::new(MarketPricer::new());
    let position_manager = web::Data::new(PositionManager::new());
    
    // Database connection setup
    let db_pool = if !dummy_mode {
        let database_url = env::var("DATABASE_URL")
            .expect("DATABASE_URL must be set");
        
        let max_connections = env::var("DB_MAX_CONNECTIONS")
            .unwrap_or_else(|_| "10".to_string())
            .parse::<u32>()
            .expect("DB_MAX_CONNECTIONS must be a number");
        
        // Connect to database with robust configuration
        info!("Connecting to database at {}", database_url.split('@').last().unwrap_or(""));
        let pool = match PgPoolOptions::new()
            .max_connections(max_connections)
            .acquire_timeout(std::time::Duration::from_secs(30))
            .connect(&database_url)
            .await {
                Ok(pool) => {
                    info!("Successfully connected to database");
                    pool
                },
                Err(e) => {
                    error!("Failed to connect to database: {}", e);
                    std::process::exit(1);
                }
            };
        
        // Verify database connection by executing a simple query
        match sqlx::query("SELECT 1").execute(&pool).await {
            Ok(_) => info!("Database connection verified"),
            Err(e) => {
                error!("Failed to verify database connection: {}", e);
                std::process::exit(1);
            }
        };
        
        web::Data::new(pool)
    } else {
        // Dummy pool for testing - won't actually work but allows the app to start
        info!("Using dummy database pool for testing");
        web::Data::new(PgPool::connect("postgres://fake:fake@localhost/fake")
            .await
            .expect("Failed to create dummy pool"))
    };
    
    // Create WebSocket server
    let ws_server = WsServer::default().start();
    let ws_server = web::Data::new(ws_server);
    
    info!("Starting trading engine server on port {} with {} workers", port, workers);
    
    // Create and start HTTP server with proper configuration
    HttpServer::new(move || {
        // Configure CORS for cross-origin requests
        let cors = Cors::default()
            .allow_any_origin()
            .allowed_methods(vec!["GET", "POST", "PUT", "DELETE"])
            .allowed_headers(vec!["Content-Type", "Authorization", "Accept"])
            .expose_headers(vec!["content-length"])
            .max_age(3600);
        
        let app = App::new()
            // Register services as app data
            .app_data(order_matcher.clone())
            .app_data(market_pricer.clone())
            .app_data(position_manager.clone())
            .app_data(ws_server.clone())
            .app_data(db_pool.clone())
            // Add middleware
            .wrap(middleware::Logger::default())
            .wrap(middleware::Compress::default()) // Add response compression
            .wrap(middleware::NormalizePath::trim()) // Normalize URL paths
            .wrap(cors)
            // Add health check endpoint
            .route("/health", web::get().to(health_check))
            // WebSocket route
            .route("/ws", web::get().to(ws_handler));
            
        // Set up the API routes based on whether we're in dummy mode or not
        if dummy_mode {
            app.service(
                web::scope("/api/v1")
                    .route("/orders", web::post().to(create_order_dummy))
                    .route("/markets/{market_id}/options/{option_id}/orderbook", 
                           web::get().to(get_order_book_dummy))
                    .route("/users/{user_id}/positions", 
                           web::get().to(get_positions_dummy))
            )
        } else {
            app.service(
                web::scope("/api/v1")
                    .route("/orders", web::post().to(create_order))
                    .route("/markets/{market_id}/options/{option_id}/orderbook", 
                           web::get().to(get_order_book))
                    .route("/users/{user_id}/positions", 
                           web::get().to(get_positions))
            )
        }
    })
    .workers(workers)
    .keep_alive(std::time::Duration::from_secs(75)) // Keep-alive setting
    .shutdown_timeout(30) // Allow 30 seconds for graceful shutdown
    .bind(("0.0.0.0", port))?
    .run()
    .await
}