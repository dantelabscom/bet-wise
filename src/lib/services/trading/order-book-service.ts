import { webSocketService } from '../websocket/socket-service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Represents a trading order in the order book
 */
export interface Order {
  id: string;
  userId: string;
  marketId: string;
  side: 'yes' | 'no';
  price: number;
  quantity: number;
  timestamp: number;
  status: 'open' | 'filled' | 'cancelled';
}

/**
 * Order book structure for a binary yes/no market
 */
export interface OrderBook {
  marketId: string;
  yesOrders: Order[];
  noOrders: Order[];
  lastPrice: number;
  lastUpdated: number;
}

/**
 * Service for managing order books for cricket match markets
 */
export class OrderBookService {
  private static instance: OrderBookService;
  private orderBooks: Map<string, OrderBook> = new Map();
  private simulationIntervals: Map<string, NodeJS.Timeout> = new Map();
  
  // Private constructor for singleton pattern
  private constructor() {}
  
  // Get singleton instance
  public static getInstance(): OrderBookService {
    if (!OrderBookService.instance) {
      OrderBookService.instance = new OrderBookService();
    }
    return OrderBookService.instance;
  }
  
  /**
   * Get order book for a specific market
   * @param marketId Market ID
   */
  public getOrderBook(marketId: string): OrderBook | null {
    return this.orderBooks.get(marketId) || null;
  }
  
  /**
   * Create a new order book for a market
   * @param marketId Market ID
   * @param initialPrice Initial price for the market (usually 0.5 or 50% for even odds)
   */
  public createOrderBook(marketId: string, initialPrice: number = 0.5): OrderBook {
    const orderBook: OrderBook = {
      marketId,
      yesOrders: [],
      noOrders: [],
      lastPrice: initialPrice,
      lastUpdated: Date.now()
    };
    
    this.orderBooks.set(marketId, orderBook);
    
    // Start simulating trading activity for this market
    this.startTradingSimulation(marketId);
    
    return orderBook;
  }
  
  /**
   * Add an order to the order book
   * @param order Order to add
   */
  public addOrder(order: Order): OrderBook | null {
    const orderBook = this.orderBooks.get(order.marketId);
    if (!orderBook) return null;
    
    // Add order to the appropriate side
    if (order.side === 'yes') {
      orderBook.yesOrders.push(order);
      // Sort by price in descending order (highest buy price first)
      orderBook.yesOrders.sort((a, b) => b.price - a.price);
    } else {
      orderBook.noOrders.push(order);
      // Sort by price in ascending order (lowest sell price first)
      orderBook.noOrders.sort((a, b) => a.price - b.price);
    }
    
    orderBook.lastUpdated = Date.now();
    
    // Try to match orders
    this.matchOrders(order.marketId);
    
    // Broadcast order book update
    this.broadcastOrderBookUpdate(order.marketId);
    
    return orderBook;
  }
  
  /**
   * Try to match orders in the order book
   * @param marketId Market ID
   */
  private matchOrders(marketId: string): void {
    const orderBook = this.orderBooks.get(marketId);
    if (!orderBook) return;
    
    let matchFound = true;
    
    // Continue matching until no more matches are found
    while (matchFound && orderBook.yesOrders.length > 0 && orderBook.noOrders.length > 0) {
      matchFound = false;
      
      const topYesOrder = orderBook.yesOrders[0];
      const topNoOrder = orderBook.noOrders[0];
      
      // In a binary market, if yes price is p, no price should be (1-p)
      // For matching, we check if yes price + no price >= 1 (accounting for spread)
      if (topYesOrder.price + topNoOrder.price >= 1) {
        matchFound = true;
        
        // Calculate match quantity (minimum of the two orders)
        const matchQuantity = Math.min(topYesOrder.quantity, topNoOrder.quantity);
        
        // Update order quantities
        topYesOrder.quantity -= matchQuantity;
        topNoOrder.quantity -= matchQuantity;
        
        // Update last price (average of the two prices)
        orderBook.lastPrice = (topYesOrder.price + (1 - topNoOrder.price)) / 2;
        orderBook.lastUpdated = Date.now();
        
        // Remove filled orders
        if (topYesOrder.quantity === 0) {
          topYesOrder.status = 'filled';
          orderBook.yesOrders.shift();
        }
        
        if (topNoOrder.quantity === 0) {
          topNoOrder.status = 'filled';
          orderBook.noOrders.shift();
        }
      }
    }
  }
  
  /**
   * Cancel an order
   * @param orderId Order ID
   * @param marketId Market ID
   * @param userId User ID (for security check)
   */
  public cancelOrder(orderId: string, marketId: string, userId: string): boolean {
    const orderBook = this.orderBooks.get(marketId);
    if (!orderBook) return false;
    
    // Find and cancel in yes orders
    const yesOrderIndex = orderBook.yesOrders.findIndex(
      order => order.id === orderId && order.userId === userId
    );
    
    if (yesOrderIndex !== -1) {
      orderBook.yesOrders[yesOrderIndex].status = 'cancelled';
      orderBook.yesOrders.splice(yesOrderIndex, 1);
      orderBook.lastUpdated = Date.now();
      
      // Broadcast update
      this.broadcastOrderBookUpdate(marketId);
      return true;
    }
    
    // Find and cancel in no orders
    const noOrderIndex = orderBook.noOrders.findIndex(
      order => order.id === orderId && order.userId === userId
    );
    
    if (noOrderIndex !== -1) {
      orderBook.noOrders[noOrderIndex].status = 'cancelled';
      orderBook.noOrders.splice(noOrderIndex, 1);
      orderBook.lastUpdated = Date.now();
      
      // Broadcast update
      this.broadcastOrderBookUpdate(marketId);
      return true;
    }
    
    return false;
  }
  
  /**
   * Get aggregated order book levels (for UI display)
   * @param marketId Market ID
   * @param levels Number of price levels to return
   */
  public getOrderBookLevels(marketId: string, levels: number = 5): any {
    const orderBook = this.orderBooks.get(marketId);
    if (!orderBook) return null;
    
    const yesLevels: {price: number, quantity: number}[] = [];
    const noLevels: {price: number, quantity: number}[] = [];
    
    // Aggregate yes orders by price
    const yesPrices = new Map<number, number>();
    for (const order of orderBook.yesOrders) {
      const price = order.price;
      const quantity = yesPrices.get(price) || 0;
      yesPrices.set(price, quantity + order.quantity);
    }
    
    // Aggregate no orders by price
    const noPrices = new Map<number, number>();
    for (const order of orderBook.noOrders) {
      const price = order.price;
      const quantity = noPrices.get(price) || 0;
      noPrices.set(price, quantity + order.quantity);
    }
    
    // Convert to arrays and sort
    Array.from(yesPrices.entries())
      .sort((a, b) => b[0] - a[0]) // Descending by price
      .slice(0, levels)
      .forEach(([price, quantity]) => {
        yesLevels.push({ price, quantity });
      });
    
    Array.from(noPrices.entries())
      .sort((a, b) => a[0] - b[0]) // Ascending by price
      .slice(0, levels)
      .forEach(([price, quantity]) => {
        noLevels.push({ price, quantity });
      });
    
    return {
      marketId,
      yes: yesLevels,
      no: noLevels,
      lastPrice: orderBook.lastPrice,
      lastUpdated: orderBook.lastUpdated
    };
  }
  
  /**
   * Start simulating trading activity for a market
   * @param marketId Market ID
   */
  private startTradingSimulation(marketId: string): void {
    // Stop any existing simulation
    this.stopTradingSimulation(marketId);
    
    // Create random interval between 2-10 seconds
    const interval = setInterval(() => {
      this.simulateTradeActivity(marketId);
    }, 2000 + Math.random() * 8000);
    
    this.simulationIntervals.set(marketId, interval);
    console.log(`Started trading simulation for market ${marketId}`);
  }
  
  /**
   * Stop simulating trading activity for a market
   * @param marketId Market ID
   */
  private stopTradingSimulation(marketId: string): void {
    const interval = this.simulationIntervals.get(marketId);
    if (interval) {
      clearInterval(interval);
      this.simulationIntervals.delete(marketId);
      console.log(`Stopped trading simulation for market ${marketId}`);
    }
  }
  
  /**
   * Simulate trade activity for a market
   * @param marketId Market ID
   */
  private simulateTradeActivity(marketId: string): void {
    const orderBook = this.orderBooks.get(marketId);
    if (!orderBook) return;
    
    // Get current price or use 0.5 as default
    const currentPrice = orderBook.lastPrice || 0.5;
    
    // Decide whether to add or cancel orders
    const action = Math.random();
    
    if (action < 0.8) { // 80% chance to add new order
      // Decide which side (yes/no)
      const side = Math.random() < 0.5 ? 'yes' : 'no';
      
      // Generate price with some randomness around current price
      let price;
      if (side === 'yes') {
        // For yes orders, price should be below current price (buyers want lower prices)
        price = Math.max(0.05, Math.min(0.95, currentPrice - 0.05 - Math.random() * 0.15));
      } else {
        // For no orders, price should be above 1-currentPrice (sellers want higher prices)
        price = Math.max(0.05, Math.min(0.95, (1 - currentPrice) + 0.05 + Math.random() * 0.15));
      }
      
      // Round to 2 decimal places
      price = Math.round(price * 100) / 100;
      
      // Generate random quantity between 5-50
      const quantity = 5 + Math.floor(Math.random() * 46);
      
      // Create simulated order
      const simulatedOrder: Order = {
        id: uuidv4(),
        userId: `sim_${Math.floor(Math.random() * 1000)}`, // Simulated user ID
        marketId,
        side,
        price,
        quantity,
        timestamp: Date.now(),
        status: 'open'
      };
      
      // Add order to book
      this.addOrder(simulatedOrder);
      
    } else if (action < 0.95) { // 15% chance to cancel an existing order
      const orderBook = this.orderBooks.get(marketId);
      if (!orderBook) return;
      
      // Select a random side
      const side = Math.random() < 0.5 ? 'yes' : 'no';
      const orders = side === 'yes' ? orderBook.yesOrders : orderBook.noOrders;
      
      // Cancel a random order if any exist
      if (orders.length > 0) {
        const randomIndex = Math.floor(Math.random() * orders.length);
        const orderToCancel = orders[randomIndex];
        this.cancelOrder(orderToCancel.id, marketId, orderToCancel.userId);
      }
    }
    // Remaining 5% chance: do nothing
  }
  
  /**
   * Broadcast order book update via WebSocket
   * @param marketId Market ID
   */
  private broadcastOrderBookUpdate(marketId: string): void {
    const orderBookLevels = this.getOrderBookLevels(marketId);
    if (orderBookLevels) {
      webSocketService.sendOrderBookUpdate(marketId, orderBookLevels);
    }
  }
}

// Export singleton instance
export const orderBookService = OrderBookService.getInstance(); 