# Rust Prediction Market Trading Engine

A high-performance trading engine for binary prediction markets, inspired by platforms like Probo.

## Features

- Binary prediction markets with Yes/No outcomes
- Efficient order matching with BTreeMap-based order books
- Fair FIFO-based matching that prevents self-matching
- Real-time trade and price updates via WebSockets
- Market resolution and settlement
- Liquidity provision via configurable trading bots
- Async/concurrent processing with tokio
- PostgreSQL database persistence

## Project Structure

```
src/
├── api/              # API layer
│   ├── routes.rs     # HTTP endpoints
│   └── websocket.rs  # WebSocket server for real-time updates
├── db/               # Database layer
│   ├── schema.rs     # Diesel ORM schema
│   └── repository.rs # Database repository
├── models/           # Data models
│   ├── market.rs     # Market and order book
│   ├── order.rs      # Orders and related enums
│   └── trade.rs      # Trade execution records
├── services/         # Business logic
│   ├── bot_service.rs        # Bot strategies for liquidity
│   ├── matching_engine.rs    # Order matching logic
│   ├── order_service.rs      # Order management
│   └── settlement_service.rs # Market resolution and payouts
├── lib.rs            # Library exports
└── main.rs           # Application entry point
```

## Getting Started

### Prerequisites

- Rust 1.65+
- Cargo
- PostgreSQL 12+
- Diesel CLI (`cargo install diesel_cli --no-default-features --features postgres`)

### Database Setup

1. Create a PostgreSQL database:

```bash
createdb prediction_engine
```

2. Create a `.env` file in the project root with:

```
DATABASE_URL=postgres://username:password@localhost:5432/prediction_engine
RUST_LOG=info
```

3. Run database migrations:

```bash
diesel migration run
```

### Building

```bash
cargo build --release
```

### Running

```bash
RUST_LOG=info cargo run --release
```

The server will start on port 8080 by default. You can override this with the `PORT` environment variable:

```bash
PORT=9000 RUST_LOG=info cargo run --release
```

## API Usage

### Markets

#### Create a new market

```
POST /api/markets
```

Request body:
```json
{
  "market_id": "btc-above-50k-eoy",
  "question": "Will BTC price be above $50k at the end of the year?",
  "description": "Market resolves to Yes if BTC price on Coinbase is above $50,000 on December 31st 23:59:59 UTC.",
  "close_time": "2023-12-31T23:59:59Z"
}
```

#### Get a market by ID

```
GET /api/markets/{market_id}
```

#### Get all markets

```
GET /api/markets
```

#### Resolve a market

```
POST /api/markets/{market_id}/resolve
```

Request body:
```json
{
  "market_id": "btc-above-50k-eoy",
  "outcome": "Yes"
}
```

### Orders

#### Submit a new order

```
POST /api/orders
```

Request body:
```json
{
  "user_id": "7f9c2a6b-0e1d-4e3f-8b7a-5e9c2d3f1e0a",
  "market_id": "btc-above-50k-eoy",
  "side": "Buy",
  "outcome": "Yes",
  "price": 0.65,
  "quantity": 10
}
```

#### Cancel an order

```
DELETE /api/orders/{order_id}
```

Request body:
```json
{
  "market_id": "btc-above-50k-eoy"
}
```

#### Get user orders

```
GET /api/orders/user/{user_id}/market/{market_id}
```

### Bots

#### Start a bot for a market

```
POST /api/bots/start
```

Request body:
```json
{
  "market_id": "btc-above-50k-eoy",
  "strategy": "market_maker"
}
```

Available strategies:
- `market_maker`: Places orders on both sides to maintain liquidity
- `trend_follower`: Follows market trend with small offsets
- `noise_trader`: Places random orders around the mid price

#### Stop a bot

```
POST /api/bots/stop/{market_id}
```

## WebSocket API

Connect to the WebSocket endpoint:

```
ws://localhost:8080/ws
```

### Subscribing to events

```json
{
  "action": "subscribe",
  "markets": ["btc-above-50k-eoy"],
  "user_id": "7f9c2a6b-0e1d-4e3f-8b7a-5e9c2d3f1e0a"
}
```

### Unsubscribing from events

```json
{
  "action": "unsubscribe",
  "markets": ["btc-above-50k-eoy"],
  "user_id": "7f9c2a6b-0e1d-4e3f-8b7a-5e9c2d3f1e0a"
}
```

### Event Types

- `Trade`: A new trade has been executed
- `PriceUpdate`: Market price has changed
- `MarketResolution`: A market has been resolved
- `Payout`: User received a payout
- `OrderUpdate`: Order status changed

## License

MIT 