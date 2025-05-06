# BetWise Rust Trading Engine Integration

This document provides instructions on how to integrate and use the high-performance Rust trading engine with the BetWise Next.js application.

## Overview

The Rust trading engine is a high-performance backend service that handles core trading functionality:

- Order matching
- Price discovery
- Position management
- Real-time updates via WebSockets

## Getting Started

### Prerequisites

- Node.js 18+ for the Next.js app
- Rust 1.70+ for the trading engine
- Docker and Docker Compose (optional, for containerized deployment)
- PostgreSQL database

### Environment Configuration

Add the following environment variables to your `.env.local` file:

```
# Rust Trading Engine Configuration
NEXT_PUBLIC_TRADING_ENGINE_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_TRADING_ENGINE_WS_URL=ws://localhost:8080/ws

# Feature flag to control whether to use the Rust trading engine
USE_RUST_ENGINE=true
```

### Running Locally

1. Start the Rust trading engine:

```bash
cd rust-trading-engine
cargo run --release
```

2. In a separate terminal, start the Next.js app:

```bash
npm run dev
```

### Running with Docker Compose

To run both the Next.js app and the Rust trading engine together:

```bash
docker-compose up -d
```

## Integration Points

The integration between the Next.js app and the Rust trading engine happens at these key points:

1. **Order Creation**: When a user places an order, it's forwarded to the Rust engine
2. **Order Book Data**: Order book information is fetched from the Rust engine
3. **Position Management**: User positions are tracked and managed by the Rust engine
4. **Real-time Updates**: WebSocket connections provide live updates from the Rust engine

## API Endpoints

The Rust trading engine exposes these REST API endpoints:

- `POST /api/v1/orders` - Create a new order
- `GET /api/v1/markets/{market_id}/options/{option_id}/orderbook` - Get order book data
- `GET /api/v1/users/{user_id}/positions` - Get user positions

## WebSocket Events

The Rust engine provides real-time updates via WebSocket:

- `orderbook:update` - Order book changes
- `price:update` - Price updates
- `match:update` - Trade match notifications

## Phased Migration

The integration uses a feature flag (`USE_RUST_ENGINE`) to gradually migrate from the TypeScript implementation to the Rust engine:

1. **Phase 1**: Deploy with `USE_RUST_ENGINE=false` to keep using TypeScript implementation
2. **Phase 2**: Set `USE_RUST_ENGINE=true` for specific markets or users
3. **Phase 3**: Full migration with `USE_RUST_ENGINE=true` for all traffic

## Troubleshooting

### Health Check

You can verify the Rust engine is running correctly:

```bash
curl http://localhost:8080/health
```

Expected response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "database": "connected",
    "timestamp": "2023-07-15T12:34:56.789Z",
    "version": "0.1.0"
  }
}
```

### Fallback Mechanism

If the Rust engine is unavailable, the Next.js app will automatically fall back to the TypeScript implementation to ensure uninterrupted service.

## Performance Monitoring

Monitor the performance difference between the TypeScript and Rust implementations:

- Response times are logged in the Next.js server logs
- The `engine` field in API responses indicates which implementation was used

## Support

For issues or questions about the integration:

1. Check the logs of both the Next.js app and Rust engine
2. Verify database connectivity
3. Ensure WebSocket connections are established correctly 