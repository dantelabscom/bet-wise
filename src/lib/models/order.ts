import { orders } from '@/lib/db/schema';

export type OrderType = typeof orders.$inferSelect.type;
export type OrderStatus = typeof orders.$inferSelect.status;
export type OrderSide = typeof orders.$inferSelect.side;

export interface Order {
  id: number;
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
  market?: {
    name: string;
    status: string;
  };
  marketOption?: {
    name: string;
    currentPrice: string;
  };
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

export interface OrderBookEntry {
  price: string;
  quantity: string;
  orders: number; // Number of orders at this price level
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

export interface OrderMatch {
  takerOrderId: number;
  makerOrderId: number;
  price: string;
  quantity: string;
  timestamp: Date;
}

export interface TradeResult {
  orderId: number;
  matches: OrderMatch[];
  filledQuantity: string;
  averagePrice: string;
  status: OrderStatus;
  remainingQuantity: string;
}

export const calculateOrderValue = (price: string, quantity: string): number => {
  return parseFloat(price) * parseFloat(quantity);
};

export const formatOrderPrice = (price: string | number): string => {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  return numPrice.toFixed(2);
};

export const getOrderStatusDisplay = (status: OrderStatus): string => {
  switch (status) {
    case 'open': return 'Open';
    case 'filled': return 'Filled';
    case 'partially_filled': return 'Partially Filled';
    case 'cancelled': return 'Cancelled';
    default: return status;
  }
}; 