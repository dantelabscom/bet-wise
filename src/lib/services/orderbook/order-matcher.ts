import { Decimal } from 'decimal.js';
import { 
  Order, 
  OrderBook, 
  OrderBookEntry, 
  OrderCreationParams, 
  OrderMatch, 
  OrderSide, 
  OrderStatus, 
  TradeResult 
} from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * OrderMatcher class handles the core order matching logic
 */
export class OrderMatcher {
  [x: string]: any;
  /**
   * Create a new order in the system
   * @param orderParams Order creation parameters
   * @param existingOrders Existing orders to match against
   * @returns The created order and trade result
   */
  createOrder(orderParams: OrderCreationParams, existingOrders: Order[]): { order: Order, tradeResult: TradeResult } {
    // Validate order parameters
    if (new Decimal(orderParams.quantity).lte(0)) {
      throw new Error('Order quantity must be greater than zero');
    }
    
    if (orderParams.type === 'limit' && new Decimal(orderParams.price).lte(0)) {
      throw new Error('Limit order price must be greater than zero');
    }
    
    // For market orders, set price to 0 for buys or a very high number for sells
    const price = orderParams.type === 'market'
      ? orderParams.side === 'buy' ? '0' : '9999.99'
      : orderParams.price;
    
    // Create the order
    const order: Order = {
      id: uuidv4(),
      userId: orderParams.userId,
      marketId: orderParams.marketId,
      marketOptionId: orderParams.marketOptionId,
      type: orderParams.type,
      side: orderParams.side,
      price,
      quantity: orderParams.quantity,
      filledQuantity: '0',
      status: 'open',
      expiresAt: orderParams.expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    // Match the order against existing orders
    const tradeResult = this.matchOrder(order, existingOrders);
    
    // Update order status based on trade result
    order.filledQuantity = tradeResult.filledQuantity;
    order.status = tradeResult.status;
    order.updatedAt = new Date();
    
    return { order, tradeResult };
  }
  
  /**
   * Match an order against existing orders
   * @param order The order to match
   * @param existingOrders Existing orders to match against
   * @returns The trade result
   */
  matchOrder(order: Order, existingOrders: Order[]): TradeResult {
    const matches: OrderMatch[] = [];
    let remainingQuantity = new Decimal(order.quantity);
    let filledQuantity = new Decimal(0);
    let totalValue = new Decimal(0);
    
    // Find matching orders based on the order side and price
    const opposingSide = order.side === 'buy' ? 'sell' : 'buy';
    
    // Filter and sort matching orders
    const matchingOrders = existingOrders
      .filter(o => 
        o.marketId === order.marketId &&
        o.marketOptionId === order.marketOptionId &&
        o.side === opposingSide &&
        o.status !== 'filled' &&
        o.status !== 'cancelled' &&
        o.status !== 'rejected' &&
        o.userId !== order.userId &&
        this.isPriceMatching(order, o)
      )
      .sort((a, b) => this.sortOrders(a, b, order.side));
    
    // Process each matching order
    for (const matchingOrder of matchingOrders) {
      if (remainingQuantity.lte(0)) break;
      
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
      matchingOrder.filledQuantity = new Decimal(matchingOrder.filledQuantity).plus(matchQuantity).toString();
      matchingOrder.status = new Decimal(matchingOrder.filledQuantity).equals(matchingOrder.quantity) 
        ? 'filled' 
        : 'partially_filled';
      matchingOrder.updatedAt = new Date();
    }
    
    // Calculate the final order status
    const status = filledQuantity.equals(0) 
      ? 'open' 
      : filledQuantity.equals(order.quantity) 
        ? 'filled' 
        : 'partially_filled';
    
    const averagePrice = filledQuantity.gt(0) 
      ? totalValue.div(filledQuantity).toFixed(2) 
      : order.price;
    
    return {
      orderId: order.id,
      matches,
      filledQuantity: filledQuantity.toString(),
      averagePrice,
      status,
      remainingQuantity: remainingQuantity.toString(),
    };
  }
  
  /**
   * Check if the price of two orders matches for trading
   * @param takerOrder The taker order
   * @param makerOrder The maker order
   * @returns True if the prices match for trading
   */
  private isPriceMatching(takerOrder: Order, makerOrder: Order): boolean {
    const takerPrice = new Decimal(takerOrder.price);
    const makerPrice = new Decimal(makerOrder.price);
    
    if (takerOrder.side === 'buy') {
      // Buy order matches if its price is >= sell order price
      return takerPrice.gte(makerPrice);
    } else {
      // Sell order matches if its price is <= buy order price
      return takerPrice.lte(makerPrice);
    }
  }
  
  /**
   * Sort orders for matching
   * @param a First order
   * @param b Second order
   * @param takerSide Side of the taker order
   * @returns Sort order (-1, 0, or 1)
   */
  private sortOrders(a: Order, b: Order, takerSide: OrderSide): number {
    const priceA = new Decimal(a.price);
    const priceB = new Decimal(b.price);
    
    // For buy orders, we want the lowest sell prices first
    // For sell orders, we want the highest buy prices first
    const priceCompare = takerSide === 'buy'
      ? priceA.comparedTo(priceB)
      : priceB.comparedTo(priceA);
    
    if (priceCompare !== 0) {
      return priceCompare;
    }
    
    // If prices are equal, sort by time (oldest first)
    return a.createdAt.getTime() - b.createdAt.getTime();
  }
  
  /**
   * Generate an order book from a list of orders
   * @param marketId The market ID
   * @param marketOptionId The market option ID
   * @param orders The orders to include in the order book
   * @returns The order book
   */
  getOrderBook(marketId: number, marketOptionId: number, orders: Order[]): OrderBook {
    // Filter relevant orders
    const relevantOrders = orders.filter(o => 
      o.marketId === marketId &&
      o.marketOptionId === marketOptionId &&
      (o.status === 'open' || o.status === 'partially_filled')
    );
    
    // Separate buy and sell orders
    const buyOrders = relevantOrders.filter(o => o.side === 'buy');
    const sellOrders = relevantOrders.filter(o => o.side === 'sell');
    
    // Aggregate orders by price level
    const bids = this.aggregateOrdersByPrice(buyOrders, 'buy');
    const asks = this.aggregateOrdersByPrice(sellOrders, 'sell');
    
    // Find the last trade
    const filledOrders = orders.filter(o => 
      o.marketId === marketId &&
      o.marketOptionId === marketOptionId &&
      (o.status === 'filled' || o.status === 'partially_filled')
    ).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    
    const lastTrade = filledOrders.length > 0 ? filledOrders[0] : undefined;
    
    return {
      marketId,
      marketOptionId,
      bids,
      asks,
      lastTradePrice: lastTrade?.price,
      lastTradeQuantity: lastTrade?.filledQuantity,
      lastTradeTime: lastTrade?.updatedAt,
    };
  }
  
  /**
   * Aggregate orders by price level
   * @param orders The orders to aggregate
   * @param side The order side
   * @returns The aggregated order book entries
   */
  private aggregateOrdersByPrice(orders: Order[], side: OrderSide): OrderBookEntry[] {
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
      const diff = new Decimal(a.price).minus(b.price).toNumber();
      return side === 'buy' ? -diff : diff;
    });
    
    return result;
  }
} 