import { db } from '@/lib/db';
import { orders, positions, wallets, transactions } from '@/lib/db/schema';
import { and, eq, gt, gte, lt, lte, desc, asc, or } from 'drizzle-orm';
import { Decimal } from 'decimal.js';

// Import from our new orderbook implementation
import { 
  createOrder as createOrderImpl,
  getOrderBook as getOrderBookImpl,
  getUserPositions as getUserPositionsImpl,
  cancelOrder as cancelOrderImpl
} from './orderbook';

import { 
  Order, 
  OrderBook, 
  OrderBookEntry, 
  OrderCreationParams, 
  OrderMatch, 
  TradeResult,
  Position
} from './orderbook/types';

/**
 * Create a new order in the system
 * @param orderParams The order parameters
 * @returns The created order
 */
export const createOrder = async (orderParams: OrderCreationParams): Promise<Order | null> => {
  return createOrderImpl(orderParams);
};

/**
 * Get the order book for a specific market option
 * @param marketId The market ID
 * @param marketOptionId The market option ID
 * @returns The order book
 */
export const getOrderBook = async (marketId: number, marketOptionId: number): Promise<OrderBook> => {
  return getOrderBookImpl(marketId, marketOptionId);
};

/**
 * Cancel an order
 * @param orderId The order ID
 * @param userId The user ID (for verification)
 * @returns True if cancelled successfully
 */
export const cancelOrder = async (orderId: number, userId: string): Promise<boolean> => {
  return cancelOrderImpl(orderId.toString(), userId);
};

/**
 * Get user's positions
 * @param userId The user ID
 * @returns The user's positions
 */
export const getUserPositions = async (userId: string): Promise<Position[]> => {
  return getUserPositionsImpl(userId);
};

/**
 * Get user's orders
 * @param userId The user ID
 * @param status Optional status filter
 * @returns The user's orders
 */
export const getUserOrders = async (userId: string, status?: string): Promise<Order[]> => {
  try {
    const whereClause = status 
      ? and(eq(orders.userId, userId), eq(orders.status, status as any)) 
      : eq(orders.userId, userId);
    
    const userOrders = await db.query.orders.findMany({
      where: whereClause,
      orderBy: [desc(orders.createdAt)],
      with: {
        market: {
          columns: {
            name: true,
            status: true,
          },
        },
        marketOption: {
          columns: {
            name: true,
            currentPrice: true,
          },
        },
      },
    });
    
    return userOrders.map(order => ({
      id: order.id.toString(),
      userId: order.userId,
      marketId: order.marketId,
      marketOptionId: order.marketOptionId,
      type: order.type as 'limit' | 'market',
      side: order.side as 'buy' | 'sell',
      price: order.price,
      quantity: order.quantity,
      filledQuantity: order.filledQuantity,
      status: order.status as 'open' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected' | 'expired',
      expiresAt: order.expiresAt || undefined,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      market: order.market,
      marketOption: order.marketOption,
    }));
  } catch (error) {
    console.error('Error getting user orders:', error);
    return [];
  }
}; 