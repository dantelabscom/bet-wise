# Integrating the Rust Trading Engine with Next.js Frontend

This guide explains how to integrate the high-performance Rust trading engine with your existing Next.js cricket trading platform.

## Architecture Overview

The integration follows a microservices architecture:

```
┌─────────────────┐           ┌───────────────────┐
│                 │           │                   │
│   Next.js App   │◄────────►│   Rust Trading    │
│  (Frontend +    │   REST    │     Engine        │
│  Backend APIs)  │   APIs    │                   │
│                 │           │                   │
└────────┬────────┘           └─────────┬─────────┘
         │                              │
         │                              │
         ▼                              ▼
┌─────────────────┐           ┌─────────────────────┐
│                 │           │                     │
│  Postgres DB    │           │  Trading Engine     │
│  (User data,    │           │  Database           │
│   cricket data) │           │  (Orders, positions)│
│                 │           │                     │
└─────────────────┘           └─────────────────────┘
```

## Required Changes to Next.js App

### 1. Add Trading Engine API Client

Create a new file: `src/lib/clients/trading-engine-client.ts`

```typescript
import axios from 'axios';

const TRADING_ENGINE_BASE_URL = process.env.TRADING_ENGINE_URL || 'http://localhost:8080/api/v1';

export const tradingEngineClient = {
  // Create a new order
  async createOrder(orderParams) {
    const response = await axios.post(`${TRADING_ENGINE_BASE_URL}/orders`, orderParams);
    return response.data;
  },
  
  // Get order book for a market option
  async getOrderBook(marketId, optionId) {
    const response = await axios.get(
      `${TRADING_ENGINE_BASE_URL}/markets/${marketId}/options/${optionId}/orderbook`
    );
    return response.data;
  },
  
  // Get user positions
  async getUserPositions(userId) {
    const response = await axios.get(`${TRADING_ENGINE_BASE_URL}/users/${userId}/positions`);
    return response.data;
  }
};
```

### 2. Update Order API Endpoint

Modify `src/app/api/markets/[marketId]/orders/route.ts` to forward requests to the Rust engine:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { tradingEngineClient } from '@/lib/clients/trading-engine-client';

export async function POST(request: NextRequest) {
  try {
    const orderParams = await request.json();
    
    // Forward the order creation to the Rust trading engine
    const result = await tradingEngineClient.createOrder(orderParams);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
```

### 3. Update WebSocket Service

Update `src/lib/services/websocket/socket-server.ts` to connect to the Rust engine's WebSocket server:

```typescript
// Add this to the WebSocket initialization code
const tradingEngineWs = new WebSocket(process.env.TRADING_ENGINE_WS_URL || 'ws://localhost:8080/ws');

tradingEngineWs.on('message', (data) => {
  const message = JSON.parse(data.toString());
  
  // Forward messages from the trading engine to clients
  switch (message.type) {
    case 'orderbook:update':
      io.to(`market:${message.marketId}`).emit('orderbook:update', message.data);
      break;
    case 'price:update':
      io.to(`market:${message.marketId}`).emit('price:update', message.data);
      break;
    // Handle other message types
  }
});
```

## Configuration

Add the following environment variables:

```
# .env.local
TRADING_ENGINE_URL=http://localhost:8080/api/v1
TRADING_ENGINE_WS_URL=ws://localhost:8080/ws
```

## Deployment Considerations

1. **Docker Compose**: Create a docker-compose.yml that includes both the Next.js app and Rust engine

2. **Kubernetes**: For production, deploy both services as separate pods with appropriate service configuration

3. **Load Balancing**: Ensure proper load balancing for the Rust service if scaling horizontally

4. **Database Separation**: Maintain separate databases for user/content data and trading data

## Phased Migration Strategy

1. **Phase 1**: Deploy Rust engine alongside existing TypeScript implementation
   - Implement feature flag to route some traffic to Rust engine
   - Run side-by-side comparison of performance

2. **Phase 2**: Migrate critical endpoints one by one
   - Start with order book queries (read-only)
   - Then migrate order creation
   - Finally migrate position management

3. **Phase 3**: Full cutover to Rust engine
   - Remove TypeScript trading code once confident in Rust implementation
   - Maintain compatibility with frontend components

## Testing Strategy

1. **Load Testing**: Use tools like k6 or Artillery to compare performance

2. **Consistency Checks**: Ensure both implementations produce the same results

3. **Failover Testing**: Verify frontend gracefully handles trading engine failures 