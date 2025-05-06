/**
 * Order types and interfaces for the trading platform
 */

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'limit' | 'market';
export type OrderStatus = 'open' | 'partially_filled' | 'filled' | 'cancelled' | 'rejected' | 'expired';

export interface Order {
  [x: string]: any;
  id: string;
  userId: string;
  marketId: number;
  marketOptionId: number;
  type: OrderType;
  side: OrderSide;
  price: string;
  quantity: string;
  filledQuantity: string;
  status: OrderStatus;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderCreationParams {
  userId: string;
  marketId: number;
  marketOptionId: number;
  type: OrderType;
  side: OrderSide;
  price: string;
  quantity: string;
  expiresAt?: Date;
}

export interface OrderBookEntry {
  price: string;
  quantity: string;
  orders: number;
}

export interface OrderBook {
  marketId: number;
  marketOptionId: number;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  lastTradePrice?: string;
  lastTradeQuantity?: string;
  lastTradeTime?: Date;
}

export interface OrderMatch {
  takerOrderId: string;
  makerOrderId: string;
  price: string;
  quantity: string;
  timestamp: Date;
}

export interface TradeResult {
  orderId: string;
  matches: OrderMatch[];
  filledQuantity: string;
  averagePrice: string;
  status: OrderStatus;
  remainingQuantity: string;
}

export interface Position {
  id: string;
  userId: string;
  marketId: number;
  marketOptionId: number;
  quantity: string;
  averageEntryPrice: string;
  realizedPnl: string;
  createdAt: Date;
  updatedAt: Date;
  market?: {
    name: string;
    status: string;
    type: string;
  };
  marketOption?: {
    name: string;
    currentPrice: string;
  };
}

export interface PositionSummary {
  position: Position;
  currentPrice?: number;
  marketValue?: number;
  unrealizedPnl?: number;
  unrealizedPnlPercentage?: number;
  totalPnl?: number;
} 