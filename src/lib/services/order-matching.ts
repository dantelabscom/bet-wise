import { db } from '@/lib/db';
import { orders, positions, wallets, transactions } from '@/lib/db/schema';
import { and, eq, gt, gte, lt, lte, desc, asc, or } from 'drizzle-orm';
import { Order, OrderBook, OrderBookEntry, OrderCreationParams, OrderMatch, TradeResult } from '@/lib/models/order';
import { Position, PositionUpdate, calculatePositionDelta } from '@/lib/models/position';
import { processMarketOrder } from './market-pricing';
import Decimal from 'decimal.js';

/**
 * Create a new order in the system
 * @param orderParams The order parameters
 * @returns The created order
 */
export const createOrder = async (orderParams: OrderCreationParams): Promise<Order | null> => {
  try {
    // Validate order parameters
    if (parseFloat(orderParams.quantity) <= 0) {
      throw new Error('Order quantity must be greater than zero');
    }
    
    if (orderParams.type === 'limit' && parseFloat(orderParams.price) <= 0) {
      throw new Error('Limit order price must be greater than zero');
    }
    
    // For market orders, set price to 0 for buys (willing to pay any price)
    // or to a very high number for sells (willing to accept any price)
    if (orderParams.type === 'market') {
      orderParams.price = orderParams.side === 'buy' ? '0' : '9999.99';
    }
    
    // Check wallet balance for buy orders
    if (orderParams.side === 'buy') {
      const wallet = await db.query.wallets.findFirst({
        where: eq(wallets.userId, orderParams.userId),
      });
      
      if (!wallet) {
        throw new Error('Wallet not found');
      }
      
      const orderValue = new Decimal(orderParams.price).mul(orderParams.quantity);
      if (new Decimal(wallet.balance).lt(orderValue)) {
        throw new Error('Insufficient funds');
      }
    }
    
    // Check position for sell orders
    if (orderParams.side === 'sell') {
      const position = await db.query.positions.findFirst({
        where: and(
          eq(positions.userId, orderParams.userId),
          eq(positions.marketId, orderParams.marketId),
          eq(positions.marketOptionId, orderParams.marketOptionId)
        ),
      });
      
      if (!position || new Decimal(position.quantity).lt(orderParams.quantity)) {
        throw new Error('Insufficient position');
      }
    }
    
    // Create the order
    const [newOrder] = await db.insert(orders).values({
      userId: orderParams.userId,
      marketId: orderParams.marketId,
      marketOptionId: orderParams.marketOptionId,
      type: orderParams.type,
      side: orderParams.side,
      price: orderParams.price,
      quantity: orderParams.quantity,
      filledQuantity: '0',
      status: 'open',
      expiresAt: orderParams.expiresAt || undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    
    if (!newOrder) {
      throw new Error('Failed to create order');
    }
    
    // Convert to Order model
    const order: Order = {
      id: newOrder.id,
      userId: newOrder.userId,
      marketId: newOrder.marketId,
      marketOptionId: newOrder.marketOptionId,
      type: newOrder.type,
      side: newOrder.side,
      price: newOrder.price,
      quantity: newOrder.quantity,
      filledQuantity: newOrder.filledQuantity,
      status: newOrder.status,
      expiresAt: newOrder.expiresAt || undefined,
      createdAt: newOrder.createdAt,
      updatedAt: newOrder.updatedAt,
    };
    
    // Process the order through the matching engine
    const tradeResult = await matchOrder(order);
    
    // Update market prices based on the trade
    if (parseFloat(tradeResult.filledQuantity) > 0) {
      await processMarketOrder(
        orderParams.marketId,
        orderParams.marketOptionId,
        orderParams.side,
        parseFloat(tradeResult.filledQuantity)
      );
    }
    
    return {
      ...order,
      filledQuantity: tradeResult.filledQuantity,
      status: tradeResult.status,
    };
  } catch (error) {
    console.error('Error creating order:', error);
    return null;
  }
};

/**
 * Match an order against the order book
 * @param order The order to match
 * @returns The trade result
 */
export const matchOrder = async (order: Order): Promise<TradeResult> => {
  try {
    const matches: OrderMatch[] = [];
    let remainingQuantity = new Decimal(order.quantity);
    let filledQuantity = new Decimal(0);
    let totalValue = new Decimal(0);
    
    // Find matching orders based on the order side and price
    const opposingSide = order.side === 'buy' ? 'sell' : 'buy';
    
    // For buy orders, we want the lowest sell prices (ASC)
    // For sell orders, we want the highest buy prices (DESC)
    const sortDirection = order.side === 'buy' ? asc : desc;
    const priceComparison = order.side === 'buy' 
      ? (price: string) => gte(orders.price, price) 
      : (price: string) => lte(orders.price, price);
    
    // Get matching orders
    const matchingOrders = await db.query.orders.findMany({
      where: and(
        eq(orders.marketId, order.marketId),
        eq(orders.marketOptionId, order.marketOptionId),
        eq(orders.side, opposingSide),
        eq(orders.status, 'open'),
        priceComparison(order.price)
      ),
      orderBy: [
        sortDirection(orders.price),
        asc(orders.createdAt)
      ],
    });
    
    // Process each matching order
    for (const matchingOrder of matchingOrders) {
      if (remainingQuantity.lte(0)) break;
      
      // Skip own orders
      if (matchingOrder.userId === order.userId) continue;
      
      const availableQuantity = new Decimal(matchingOrder.quantity).minus(matchingOrder.filledQuantity);
      if (availableQuantity.lte(0)) continue;
      
      // Calculate the match quantity and price
      const matchQuantity = Decimal.min(remainingQuantity, availableQuantity);
      const matchPrice = matchingOrder.price; // Use the maker's price
      
      // Create the match record
      const match: OrderMatch = {
        takerOrderId: order.id,
        makerOrderId: matchingOrder.id,
        price: matchPrice,
        quantity: matchQuantity.toString(),
        timestamp: new Date(),
      };
      
      matches.push(match);
      
      // Update quantities
      remainingQuantity = remainingQuantity.minus(matchQuantity);
      filledQuantity = filledQuantity.plus(matchQuantity);
      totalValue = totalValue.plus(matchQuantity.mul(matchPrice));
      
      // Update the matching order
      const newFilledQuantity = new Decimal(matchingOrder.filledQuantity).plus(matchQuantity);
      const newStatus = newFilledQuantity.equals(matchingOrder.quantity) ? 'filled' : 'partially_filled';
      
      await db.update(orders)
        .set({
          filledQuantity: newFilledQuantity.toString(),
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, matchingOrder.id));
      
      // Update positions for both parties
      await updatePositions(match, order.userId, matchingOrder.userId, order.marketId, order.marketOptionId);
    }
    
    // Calculate the final order status
    const newFilledQuantity = filledQuantity.toString();
    const status = filledQuantity.equals(0) 
      ? 'open' 
      : filledQuantity.equals(order.quantity) 
        ? 'filled' 
        : 'partially_filled';
    
    // Update the original order
    await db.update(orders)
      .set({
        filledQuantity: newFilledQuantity,
        status,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));
    
    const averagePrice = filledQuantity.gt(0) 
      ? totalValue.div(filledQuantity).toFixed(2) 
      : order.price;
    
    return {
      orderId: order.id,
      matches,
      filledQuantity: newFilledQuantity,
      averagePrice,
      status,
      remainingQuantity: remainingQuantity.toString(),
    };
  } catch (error) {
    console.error('Error matching order:', error);
    return {
      orderId: order.id,
      matches: [],
      filledQuantity: '0',
      averagePrice: order.price,
      status: 'open',
      remainingQuantity: order.quantity,
    };
  }
};

/**
 * Update positions for both parties in a trade
 * @param match The trade match
 * @param buyerId The buyer's user ID
 * @param sellerId The seller's user ID
 * @param marketId The market ID
 * @param marketOptionId The market option ID
 */
export const updatePositions = async (
  match: OrderMatch,
  buyerId: string,
  sellerId: string,
  marketId: number,
  marketOptionId: number
): Promise<void> => {
  try {
    // Get or create buyer position
    let buyerPosition = await db.query.positions.findFirst({
      where: and(
        eq(positions.userId, buyerId),
        eq(positions.marketId, marketId),
        eq(positions.marketOptionId, marketOptionId)
      ),
    });
    
    // Get or create seller position
    let sellerPosition = await db.query.positions.findFirst({
      where: and(
        eq(positions.userId, sellerId),
        eq(positions.marketId, marketId),
        eq(positions.marketOptionId, marketOptionId)
      ),
    });
    
    // Calculate position updates
    const buyerUpdate = calculatePositionDelta(
      buyerPosition ? {
        id: buyerPosition.id,
        userId: buyerPosition.userId,
        marketId: buyerPosition.marketId,
        marketOptionId: buyerPosition.marketOptionId,
        quantity: buyerPosition.quantity,
        averagePrice: buyerPosition.averagePrice,
        realizedPnl: buyerPosition.realizedPnl,
        createdAt: buyerPosition.createdAt,
        updatedAt: buyerPosition.updatedAt,
      } : null,
      match.quantity,
      match.price,
      'buy'
    );
    
    const sellerUpdate = calculatePositionDelta(
      sellerPosition ? {
        id: sellerPosition.id,
        userId: sellerPosition.userId,
        marketId: sellerPosition.marketId,
        marketOptionId: sellerPosition.marketOptionId,
        quantity: sellerPosition.quantity,
        averagePrice: sellerPosition.averagePrice,
        realizedPnl: sellerPosition.realizedPnl,
        createdAt: sellerPosition.createdAt,
        updatedAt: sellerPosition.updatedAt,
      } : null,
      match.quantity,
      match.price,
      'sell'
    );
    
    // Apply buyer position update
    if (buyerUpdate.positionId) {
      // Existing position
      const newQuantity = new Decimal(buyerPosition!.quantity).plus(buyerUpdate.quantityChange).toString();
      
      if (new Decimal(newQuantity).gt(0)) {
        // Update existing position
        await db.update(positions)
          .set({
            quantity: newQuantity,
            averagePrice: buyerUpdate.price,
            updatedAt: new Date(),
          })
          .where(eq(positions.id, buyerUpdate.positionId));
      } else {
        // Delete position if quantity is 0
        await db.delete(positions)
          .where(eq(positions.id, buyerUpdate.positionId));
      }
    } else {
      // Create new position
      await db.insert(positions).values({
        userId: buyerId,
        marketId: marketId,
        marketOptionId: marketOptionId,
        quantity: match.quantity,
        averagePrice: match.price,
        realizedPnl: '0',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    
    // Apply seller position update
    if (sellerUpdate.positionId) {
      // Existing position
      const newQuantity = new Decimal(sellerPosition!.quantity).plus(sellerUpdate.quantityChange).toString();
      const newRealizedPnl = new Decimal(sellerPosition!.realizedPnl).plus(sellerUpdate.realizedPnl || 0).toString();
      
      if (new Decimal(newQuantity).gt(0)) {
        // Update existing position
        await db.update(positions)
          .set({
            quantity: newQuantity,
            realizedPnl: newRealizedPnl,
            updatedAt: new Date(),
          })
          .where(eq(positions.id, sellerUpdate.positionId));
      } else {
        // Delete position if quantity is 0
        await db.delete(positions)
          .where(eq(positions.id, sellerUpdate.positionId));
      }
    }
    
    // Update wallets
    const tradeValue = new Decimal(match.price).mul(match.quantity);
    
    // Get wallets
    const buyerWallet = await db.query.wallets.findFirst({
      where: eq(wallets.userId, buyerId),
    });
    
    const sellerWallet = await db.query.wallets.findFirst({
      where: eq(wallets.userId, sellerId),
    });
    
    if (!buyerWallet || !sellerWallet) {
      throw new Error('Wallet not found');
    }
    
    // Deduct from buyer wallet
    await db.update(wallets)
      .set({
        balance: new Decimal(buyerWallet.balance).minus(tradeValue).toString(),
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, buyerWallet.id));
    
    // Add to seller wallet
    await db.update(wallets)
      .set({
        balance: new Decimal(sellerWallet.balance).plus(tradeValue).toString(),
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, sellerWallet.id));
    
    // Create transaction records
    await db.insert(transactions).values([
      {
        walletId: buyerWallet.id,
        amount: `-${tradeValue.toString()}`,
        type: 'trade',
        reference: `order_${match.takerOrderId}`,
        description: `Bought ${match.quantity} @ ${match.price}`,
        createdAt: new Date(),
      },
      {
        walletId: sellerWallet.id,
        amount: tradeValue.toString(),
        type: 'trade',
        reference: `order_${match.makerOrderId}`,
        description: `Sold ${match.quantity} @ ${match.price}`,
        createdAt: new Date(),
      }
    ]);
    
  } catch (error) {
    console.error('Error updating positions:', error);
    throw error;
  }
};

/**
 * Get the order book for a specific market option
 * @param marketId The market ID
 * @param marketOptionId The market option ID
 * @returns The order book
 */
export const getOrderBook = async (marketId: number, marketOptionId: number): Promise<OrderBook> => {
  try {
    // Fetch all open buy orders (bids)
    const buyOrders = await db.query.orders.findMany({
      where: and(
        eq(orders.marketId, marketId),
        eq(orders.marketOptionId, marketOptionId),
        eq(orders.side, 'buy'),
        eq(orders.status, 'open')
      ),
      orderBy: [desc(orders.price), asc(orders.createdAt)],
    });
    
    // Fetch all open sell orders (asks)
    const sellOrders = await db.query.orders.findMany({
      where: and(
        eq(orders.marketId, marketId),
        eq(orders.marketOptionId, marketOptionId),
        eq(orders.side, 'sell'),
        eq(orders.status, 'open')
      ),
      orderBy: [asc(orders.price), asc(orders.createdAt)],
    });
    
    // Group orders by price level
    const bids: OrderBookEntry[] = aggregateOrdersByPrice(buyOrders, 'buy');
    const asks: OrderBookEntry[] = aggregateOrdersByPrice(sellOrders, 'sell');
    
    // Get last trade info
    const latestTrade = await db.query.orders.findFirst({
      where: and(
        eq(orders.marketId, marketId),
        eq(orders.marketOptionId, marketOptionId),
        or(
          eq(orders.status, 'filled'),
          eq(orders.status, 'partially_filled')
        )
      ),
      orderBy: [desc(orders.updatedAt)],
    });
    
    return {
      marketId,
      marketOptionId,
      bids,
      asks,
      lastTradePrice: latestTrade?.price,
      lastTradeQuantity: latestTrade?.filledQuantity,
      lastTradeTime: latestTrade?.updatedAt,
    };
  } catch (error) {
    console.error('Error getting order book:', error);
    return {
      marketId,
      marketOptionId,
      bids: [],
      asks: [],
    };
  }
};

/**
 * Aggregate orders by price level for the order book
 * @param orders The orders to aggregate
 * @param side The order side (buy or sell)
 * @returns The aggregated order book entries
 */
const aggregateOrdersByPrice = (orders: any[], side: 'buy' | 'sell'): OrderBookEntry[] => {
  const priceMap = new Map<string, { quantity: Decimal; orders: number }>();
  
  // Group orders by price
  orders.forEach(order => {
    const remainingQuantity = new Decimal(order.quantity).minus(order.filledQuantity);
    if (remainingQuantity.lte(0)) return;
    
    const price = order.price;
    if (!priceMap.has(price)) {
      priceMap.set(price, { quantity: new Decimal(0), orders: 0 });
    }
    
    const entry = priceMap.get(price)!;
    entry.quantity = entry.quantity.plus(remainingQuantity);
    entry.orders += 1;
  });
  
  // Convert to array and sort
  let result = Array.from(priceMap.entries()).map(([price, data]) => ({
    price,
    quantity: data.quantity.toString(),
    orders: data.orders,
  }));
  
  // Sort by price (highest to lowest for bids, lowest to highest for asks)
  result = result.sort((a, b) => {
    const diff = parseFloat(a.price) - parseFloat(b.price);
    return side === 'buy' ? -diff : diff;
  });
  
  return result;
};

/**
 * Cancel an order
 * @param orderId The order ID
 * @param userId The user ID (for verification)
 * @returns True if cancelled successfully
 */
export const cancelOrder = async (orderId: number, userId: string): Promise<boolean> => {
  try {
    // Find the order
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    // Verify ownership
    if (order.userId !== userId) {
      throw new Error('Unauthorized');
    }
    
    // Verify order is open
    if (order.status !== 'open' && order.status !== 'partially_filled') {
      throw new Error('Order cannot be cancelled');
    }
    
    // Calculate unfilled quantity
    const unfilledQuantity = new Decimal(order.quantity).minus(order.filledQuantity);
    
    // Cancel the order
    await db.update(orders)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));
    
    // If it's a buy order, refund the wallet for unfilled amount
    if (order.side === 'buy' && unfilledQuantity.gt(0)) {
      const refundAmount = unfilledQuantity.mul(order.price);
      
      const wallet = await db.query.wallets.findFirst({
        where: eq(wallets.userId, userId),
      });
      
      if (wallet) {
        // Update wallet balance
        await db.update(wallets)
          .set({
            balance: new Decimal(wallet.balance).plus(refundAmount).toString(),
            updatedAt: new Date(),
          })
          .where(eq(wallets.id, wallet.id));
        
        // Create transaction record
        await db.insert(transactions).values({
          walletId: wallet.id,
          amount: refundAmount.toString(),
          type: 'refund',
          reference: `order_${orderId}`,
          description: `Refund for cancelled order`,
          createdAt: new Date(),
        });
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error cancelling order:', error);
    return false;
  }
};

/**
 * Get user's positions
 * @param userId The user ID
 * @returns The user's positions
 */
export const getUserPositions = async (userId: string): Promise<Position[]> => {
  try {
    const userPositions = await db.query.positions.findMany({
      where: eq(positions.userId, userId),
      with: {
        market: {
          columns: {
            name: true,
            status: true,
            type: true,
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
    
    return userPositions.map(pos => ({
      id: pos.id,
      userId: pos.userId,
      marketId: pos.marketId,
      marketOptionId: pos.marketOptionId,
      quantity: pos.quantity,
      averagePrice: pos.averagePrice,
      realizedPnl: pos.realizedPnl,
      createdAt: pos.createdAt,
      updatedAt: pos.updatedAt,
      market: pos.market,
      marketOption: pos.marketOption,
    }));
  } catch (error) {
    console.error('Error getting user positions:', error);
    return [];
  }
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
      id: order.id,
      userId: order.userId,
      marketId: order.marketId,
      marketOptionId: order.marketOptionId,
      type: order.type,
      side: order.side,
      price: order.price,
      quantity: order.quantity,
      filledQuantity: order.filledQuantity,
      status: order.status,
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