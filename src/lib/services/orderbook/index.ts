import { db } from '@/lib/db';
import { orders, positions, wallets, transactions, marketOptions, markets } from '@/lib/db/schema';
import { and, eq, gt, gte, lt, lte, desc, asc, or } from 'drizzle-orm';
import { Decimal } from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';

import { OrderMatcher } from './order-matcher';
import { PositionManager } from './position-manager';
import { MarketPricer } from './market-pricer';
import { 
  Order, 
  OrderBook, 
  OrderCreationParams, 
  OrderStatus, 
  Position, 
  TradeResult 
} from './types';

// Create instances of the core services
const orderMatcher = new OrderMatcher();
const positionManager = new PositionManager();
const marketPricer = new MarketPricer();

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
    
    // Get existing open orders for matching
    const existingOrders = await db.query.orders.findMany({
      where: and(
        eq(orders.marketId, orderParams.marketId),
        eq(orders.marketOptionId, orderParams.marketOptionId),
        or(
          eq(orders.status, 'open'),
          eq(orders.status, 'partially_filled')
        )
      ),
    });
    
    // Convert DB orders to the format expected by OrderMatcher
    const matcherOrders: Order[] = existingOrders.map(o => ({
      id: o.id.toString(),
      userId: o.userId,
      marketId: o.marketId,
      marketOptionId: o.marketOptionId,
      type: o.type as 'limit' | 'market',
      side: o.side as 'buy' | 'sell',
      price: o.price,
      quantity: o.quantity,
      filledQuantity: o.filledQuantity,
      status: o.status as OrderStatus,
      expiresAt: o.expiresAt || undefined,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    }));
    
    // Create the order and match it
    const { order, tradeResult } = orderMatcher.createOrder(orderParams, matcherOrders);
    
    // Start a transaction
    return await db.transaction(async (tx) => {
      // Create the order in the database
      const [newOrder] = await tx.insert(orders).values({
        userId: order.userId,
        marketId: order.marketId,
        marketOptionId: order.marketOptionId,
        type: order.type,
        side: order.side,
        price: order.price,
        quantity: order.quantity,
        filledQuantity: order.filledQuantity,
        status: order.status as "open" | "filled" | "partially_filled" | "cancelled",
        expiresAt: order.expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      
      // Process matches
      for (const match of tradeResult.matches) {
        // Find the maker order
        const makerOrder = matcherOrders.find(o => o.id === match.makerOrderId);
        if (!makerOrder) continue;
        
        // Update maker order in database
        await tx.update(orders)
          .set({
            filledQuantity: makerOrder.filledQuantity,
            status: makerOrder.status as "open" | "filled" | "partially_filled" | "cancelled",
            updatedAt: new Date(),
          })
          .where(eq(orders.id, parseInt(makerOrder.id)));
        
        // Record the match
        await tx.insert(transactions).values({
          walletId: 0, // This will be updated later
          amount: new Decimal(match.quantity).mul(match.price).toString(),
          type: 'trade',
          reference: `match_${newOrder.id}_${makerOrder.id}`,
          description: `Matched ${match.quantity} @ ${match.price}`,
          createdAt: new Date(),
        });
        
        // Update positions for both parties
        await updatePositionsForMatch(
          tx,
          order.userId,
          makerOrder.userId,
          order.marketId,
          order.marketOptionId,
          match.quantity,
          match.price,
          order.side === 'buy'
        );
      }
      
      // Update market prices
      if (parseFloat(tradeResult.filledQuantity) > 0) {
        const marketOptionsList = await tx.query.marketOptions.findMany({
          where: eq(marketOptions.marketId, order.marketId),
        });
        
        const marketOptionsForPricing = marketOptionsList.map(option => ({
          id: option.id,
          marketId: option.marketId,
          name: option.name,
          initialPrice: option.initialPrice,
          currentPrice: option.currentPrice,
          lastPrice: option.lastPrice || undefined,
          minPrice: option.minPrice || undefined,
          maxPrice: option.maxPrice || undefined,
          weight: option.weight || '1',
          createdAt: option.createdAt,
          updatedAt: option.updatedAt,
        }));
        
        const priceUpdates = marketPricer.processMarketOrder(
          order.marketId,
          order.marketOptionId,
          order.side,
          tradeResult.filledQuantity,
          marketOptionsForPricing
        );
        
        // Apply price updates
        for (const update of priceUpdates) {
          await tx.update(marketOptions)
            .set({
              currentPrice: update.newPrice,
              lastPrice: update.lastPrice,
              updatedAt: new Date(),
            })
            .where(eq(marketOptions.id, update.marketOptionId));
        }
      }
      
      return {
        id: newOrder.id.toString(),
        userId: newOrder.userId,
        marketId: newOrder.marketId,
        marketOptionId: newOrder.marketOptionId,
        type: newOrder.type as 'limit' | 'market',
        side: newOrder.side as 'buy' | 'sell',
        price: newOrder.price,
        quantity: newOrder.quantity,
        filledQuantity: newOrder.filledQuantity,
        status: newOrder.status as OrderStatus,
        expiresAt: newOrder.expiresAt || undefined,
        createdAt: newOrder.createdAt,
        updatedAt: newOrder.updatedAt,
      };
    });
  } catch (error) {
    console.error('Error creating order:', error);
    return null;
  }
};

/**
 * Update positions for both parties in a trade
 * @param tx Database transaction
 * @param buyerId The buyer's user ID
 * @param sellerId The seller's user ID
 * @param marketId The market ID
 * @param marketOptionId The market option ID
 * @param quantity Trade quantity
 * @param price Trade price
 * @param isBuyerTaker Whether the buyer is the taker
 */
async function updatePositionsForMatch(
  tx: any,
  buyerId: string,
  sellerId: string,
  marketId: number,
  marketOptionId: number,
  quantity: string,
  price: string,
  isBuyerTaker: boolean
): Promise<void> {
  // Get buyer position
  const buyerPosition = await tx.query.positions.findFirst({
    where: and(
      eq(positions.userId, buyerId),
      eq(positions.marketId, marketId),
      eq(positions.marketOptionId, marketOptionId)
    ),
  });
  
  // Get seller position
  const sellerPosition = await tx.query.positions.findFirst({
    where: and(
      eq(positions.userId, sellerId),
      eq(positions.marketId, marketId),
      eq(positions.marketOptionId, marketOptionId)
    ),
  });
  
  // Update buyer position
  const buyerUpdateParams = {
    userId: buyerId,
    marketId: marketId,
    marketOptionId: marketOptionId,
    quantityDelta: quantity,
    price: price,
  };
  
  const updatedBuyerPosition = positionManager.updatePosition(
    buyerUpdateParams,
    buyerPosition ? {
      id: buyerPosition.id,
      userId: buyerPosition.userId,
      marketId: buyerPosition.marketId,
      marketOptionId: buyerPosition.marketOptionId,
      quantity: buyerPosition.quantity,
      averageEntryPrice: buyerPosition.averageEntryPrice,
      realizedPnl: buyerPosition.realizedPnl,
      createdAt: buyerPosition.createdAt,
      updatedAt: buyerPosition.updatedAt,
    } : null
  );
  
  // Update seller position
  const sellerUpdateParams = {
    userId: sellerId,
    marketId: marketId,
    marketOptionId: marketOptionId,
    quantityDelta: `-${quantity}`, // Negative for seller
    price: price,
  };
  
  const updatedSellerPosition = positionManager.updatePosition(
    sellerUpdateParams,
    sellerPosition ? {
      id: sellerPosition.id,
      userId: sellerPosition.userId,
      marketId: sellerPosition.marketId,
      marketOptionId: sellerPosition.marketOptionId,
      quantity: sellerPosition.quantity,
      averageEntryPrice: sellerPosition.averageEntryPrice,
      realizedPnl: sellerPosition.realizedPnl,
      createdAt: sellerPosition.createdAt,
      updatedAt: sellerPosition.updatedAt,
    } : null
  );
  
  // Save buyer position
  if (buyerPosition) {
    await tx.update(positions)
      .set({
        quantity: updatedBuyerPosition.quantity,
        averageEntryPrice: updatedBuyerPosition.averageEntryPrice,
        realizedPnl: updatedBuyerPosition.realizedPnl,
        updatedAt: new Date(),
      })
      .where(eq(positions.id, buyerPosition.id));
  } else {
    await tx.insert(positions).values({
      id: updatedBuyerPosition.id,
      userId: updatedBuyerPosition.userId,
      marketId: updatedBuyerPosition.marketId,
      marketOptionId: updatedBuyerPosition.marketOptionId,
      quantity: updatedBuyerPosition.quantity,
      averageEntryPrice: updatedBuyerPosition.averageEntryPrice,
      realizedPnl: updatedBuyerPosition.realizedPnl,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  
  // Save seller position
  if (sellerPosition) {
    await tx.update(positions)
      .set({
        quantity: updatedSellerPosition.quantity,
        averageEntryPrice: updatedSellerPosition.averageEntryPrice,
        realizedPnl: updatedSellerPosition.realizedPnl,
        updatedAt: new Date(),
      })
      .where(eq(positions.id, sellerPosition.id));
  } else {
    await tx.insert(positions).values({
      id: updatedSellerPosition.id,
      userId: updatedSellerPosition.userId,
      marketId: updatedSellerPosition.marketId,
      marketOptionId: updatedSellerPosition.marketOptionId,
      quantity: updatedSellerPosition.quantity,
      averageEntryPrice: updatedSellerPosition.averageEntryPrice,
      realizedPnl: updatedSellerPosition.realizedPnl,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  
  // Update wallets
  const tradeValue = new Decimal(price).mul(quantity);
  
  // Get wallets
  const buyerWallet = await tx.query.wallets.findFirst({
    where: eq(wallets.userId, buyerId),
  });
  
  const sellerWallet = await tx.query.wallets.findFirst({
    where: eq(wallets.userId, sellerId),
  });
  
  if (!buyerWallet || !sellerWallet) {
    throw new Error('Wallet not found');
  }
  
  // Deduct from buyer wallet
  await tx.update(wallets)
    .set({
      balance: new Decimal(buyerWallet.balance).minus(tradeValue).toString(),
      updatedAt: new Date(),
    })
    .where(eq(wallets.id, buyerWallet.id));
  
  // Add to seller wallet
  await tx.update(wallets)
    .set({
      balance: new Decimal(sellerWallet.balance).plus(tradeValue).toString(),
      updatedAt: new Date(),
    })
    .where(eq(wallets.id, sellerWallet.id));
  
  // Create transaction records
  await tx.insert(transactions).values([
    {
      walletId: buyerWallet.id,
      amount: `-${tradeValue.toString()}`,
      type: 'trade',
      reference: `trade_${isBuyerTaker ? 'taker' : 'maker'}`,
      description: `Bought ${quantity} @ ${price}`,
      createdAt: new Date(),
    },
    {
      walletId: sellerWallet.id,
      amount: tradeValue.toString(),
      type: 'trade',
      reference: `trade_${!isBuyerTaker ? 'taker' : 'maker'}`,
      description: `Sold ${quantity} @ ${price}`,
      createdAt: new Date(),
    }
  ]);
}

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
        or(
          eq(orders.status, 'open'),
          eq(orders.status, 'partially_filled')
        )
      ),
      orderBy: [desc(orders.price), asc(orders.createdAt)],
    });
    
    // Fetch all open sell orders (asks)
    const sellOrders = await db.query.orders.findMany({
      where: and(
        eq(orders.marketId, marketId),
        eq(orders.marketOptionId, marketOptionId),
        eq(orders.side, 'sell'),
        or(
          eq(orders.status, 'open'),
          eq(orders.status, 'partially_filled')
        )
      ),
      orderBy: [asc(orders.price), asc(orders.createdAt)],
    });
    
    // Convert to the format expected by OrderMatcher
    const allOrders = [...buyOrders, ...sellOrders].map(o => ({
      id: o.id.toString(),
      userId: o.userId,
      marketId: o.marketId,
      marketOptionId: o.marketOptionId,
      type: o.type as 'limit' | 'market',
      side: o.side as 'buy' | 'sell',
      price: o.price,
      quantity: o.quantity,
      filledQuantity: o.filledQuantity,
      status: o.status as OrderStatus,
      expiresAt: o.expiresAt || undefined,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    }));
    
    // Generate the order book
    return orderMatcher.getOrderBook(marketId, marketOptionId, allOrders);
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
      averageEntryPrice: pos.averageEntryPrice,
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
 * Cancel an order
 * @param orderId The order ID
 * @param userId The user ID (for verification)
 * @returns True if cancelled successfully
 */
export const cancelOrder = async (orderId: string, userId: string): Promise<boolean> => {
  try {
    // Find the order
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, parseInt(orderId)),
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
    
    return await db.transaction(async (tx) => {
      // Cancel the order
      await tx.update(orders)
        .set({
          status: 'cancelled',
          updatedAt: new Date(),
        })
        .where(eq(orders.id, parseInt(orderId)));
      
      // If it's a buy order, refund the wallet for unfilled amount
      if (order.side === 'buy' && unfilledQuantity.gt(0)) {
        const refundAmount = unfilledQuantity.mul(order.price);
        
        const wallet = await tx.query.wallets.findFirst({
          where: eq(wallets.userId, userId),
        });
        
        if (wallet) {
          // Update wallet balance
          await tx.update(wallets)
            .set({
              balance: new Decimal(wallet.balance).plus(refundAmount).toString(),
              updatedAt: new Date(),
            })
            .where(eq(wallets.id, wallet.id));
          
          // Create transaction record
          await tx.insert(transactions).values({
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
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    return false;
  }
}; 