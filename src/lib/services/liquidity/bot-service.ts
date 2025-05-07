import { v4 as uuidv4 } from 'uuid';
import { webSocketService } from '../websocket/socket-service';

// Bot configuration
const NUM_BOTS = 8;
const ORDER_INTERVAL_MIN = 5000; // 5 seconds
const ORDER_INTERVAL_MAX = 15000; // 15 seconds
const CANCEL_PROBABILITY = 0.3; // 30% chance to cancel an order
const PRICE_VOLATILITY = 0.02; // 2% price movement

// Order types
export enum OrderType {
  BUY = 'BUY',
  SELL = 'SELL'
}

// Order side
export enum OrderSide {
  YES = 'YES',
  NO = 'NO'
}

// Bot strategy types
enum BotStrategy {
  MARKET_MAKER, // Places orders on both sides of the book
  TREND_FOLLOWER, // Follows price trends
  CONTRARIAN, // Goes against price trends
  RANDOM // Places random orders
}

// Bot user structure
interface BotUser {
  id: string;
  name: string;
  balance: number;
  strategy: BotStrategy;
  activeOrders: Order[];
}

// Order structure
export interface Order {
  id: string;
  userId: string;
  marketId: string;
  type: OrderType;
  side: OrderSide;
  price: number;
  quantity: number;
  timestamp: number;
  isBot: boolean;
}

// Market structure
interface Market {
  id: string;
  name: string;
  description: string;
  currentPrice: number;
  lastTradePrice: number;
  orders: Order[];
}

// Singleton class for bot service
export class BotService {
  private static instance: BotService;
  private bots: BotUser[] = [];
  private markets: Map<string, Market> = new Map();
  private orderIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning: boolean = false;

  // Private constructor for singleton pattern
  private constructor() {
    this.initializeBots();
  }

  // Get singleton instance
  public static getInstance(): BotService {
    if (!BotService.instance) {
      BotService.instance = new BotService();
    }
    return BotService.instance;
  }

  // Initialize bots with different strategies
  private initializeBots(): void {
    for (let i = 0; i < NUM_BOTS; i++) {
      const strategy = this.getRandomStrategy();
      const bot: BotUser = {
        id: `bot-${uuidv4()}`,
        name: `Trader_${this.generateBotName()}`,
        balance: 5000 + Math.random() * 5000, // Random balance between 5000-10000
        strategy,
        activeOrders: []
      };
      this.bots.push(bot);
    }
    console.log(`Initialized ${this.bots.length} trading bots`);
  }

  // Generate a random bot name
  private generateBotName(): string {
    const adjectives = ['Swift', 'Smart', 'Quick', 'Bold', 'Wise', 'Sharp', 'Alpha', 'Beta', 'Delta', 'Sigma'];
    const nouns = ['Trader', 'Investor', 'Shark', 'Eagle', 'Wolf', 'Hawk', 'Whale', 'Bull', 'Bear', 'Tiger'];
    
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}`;
  }

  // Get a random bot strategy
  private getRandomStrategy(): BotStrategy {
    const strategies = Object.values(BotStrategy).filter(s => typeof s === 'number');
    return strategies[Math.floor(Math.random() * strategies.length)] as BotStrategy;
  }

  // Initialize a market with fake orders
  public initializeMarket(marketId: string, name: string, description: string, initialPrice: number = 0.5): void {
    if (this.markets.has(marketId)) {
      console.log(`Market ${marketId} already initialized`);
      return;
    }

    const market: Market = {
      id: marketId,
      name,
      description,
      currentPrice: initialPrice,
      lastTradePrice: initialPrice,
      orders: []
    };

    this.markets.set(marketId, market);
    
    // Add initial orders to create a spread
    this.addInitialOrders(marketId, initialPrice);
    
    console.log(`Market ${marketId} initialized with initial price ${initialPrice}`);
  }

  // Add initial orders to create a realistic order book
  private addInitialOrders(marketId: string, initialPrice: number): void {
    const market = this.markets.get(marketId);
    if (!market) return;

    // Create initial spread
    const buyPrice = Math.max(0.01, initialPrice - 0.04);
    const sellPrice = Math.min(0.99, initialPrice + 0.04);
    
    // Add buy orders (bids)
    for (let i = 0; i < 5; i++) {
      const bot = this.bots[Math.floor(Math.random() * this.bots.length)];
      const price = buyPrice - (i * 0.01);
      const quantity = 50 + Math.floor(Math.random() * 150);
      
      const order: Order = {
        id: uuidv4(),
        userId: bot.id,
        marketId,
        type: OrderType.BUY,
        side: OrderSide.YES,
        price: Math.max(0.01, price),
        quantity,
        timestamp: Date.now(),
        isBot: true
      };
      
      market.orders.push(order);
      bot.activeOrders.push(order);
    }
    
    // Add sell orders (asks)
    for (let i = 0; i < 5; i++) {
      const bot = this.bots[Math.floor(Math.random() * this.bots.length)];
      const price = sellPrice + (i * 0.01);
      const quantity = 50 + Math.floor(Math.random() * 150);
      
      const order: Order = {
        id: uuidv4(),
        userId: bot.id,
        marketId,
        type: OrderType.SELL,
        side: OrderSide.YES,
        price: Math.min(0.99, price),
        quantity,
        timestamp: Date.now(),
        isBot: true
      };
      
      market.orders.push(order);
      bot.activeOrders.push(order);
    }
    
    // Send order book update through WebSocket
    this.sendOrderBookUpdate(marketId);
  }

  // Start generating liquidity for a market
  public startLiquidityGeneration(marketId: string): void {
    if (this.orderIntervals.has(marketId)) {
      console.log(`Liquidity generation already running for market ${marketId}`);
      return;
    }
    
    const interval = setInterval(() => {
      this.generateBotActivity(marketId);
    }, this.getRandomInterval());
    
    this.orderIntervals.set(marketId, interval);
    console.log(`Started liquidity generation for market ${marketId}`);
  }

  // Stop generating liquidity for a market
  public stopLiquidityGeneration(marketId: string): void {
    const interval = this.orderIntervals.get(marketId);
    if (interval) {
      clearInterval(interval);
      this.orderIntervals.delete(marketId);
      console.log(`Stopped liquidity generation for market ${marketId}`);
    }
  }

  // Generate bot activity for a market
  private generateBotActivity(marketId: string): void {
    const market = this.markets.get(marketId);
    if (!market) return;
    
    // Randomly select a bot
    const bot = this.bots[Math.floor(Math.random() * this.bots.length)];
    
    // Decide whether to place a new order or cancel an existing one
    if (Math.random() < CANCEL_PROBABILITY && bot.activeOrders.length > 0) {
      this.cancelBotOrder(bot, marketId);
    } else {
      this.placeBotOrder(bot, market);
    }
    
    // Match orders if possible
    this.matchOrders(marketId);
    
    // Send order book update through WebSocket
    this.sendOrderBookUpdate(marketId);
  }

  // Place a new order for a bot
  private placeBotOrder(bot: BotUser, market: Market): void {
    // Determine order type and price based on bot strategy
    const { type, side, price, quantity } = this.determineBotOrderDetails(bot, market);
    
    // Create the order
    const order: Order = {
      id: uuidv4(),
      userId: bot.id,
      marketId: market.id,
      type,
      side,
      price,
      quantity,
      timestamp: Date.now(),
      isBot: true
    };
    
    // Add order to market and bot's active orders
    market.orders.push(order);
    bot.activeOrders.push(order);
    
    console.log(`Bot ${bot.name} placed ${type} order for ${quantity} shares at ${price}`);
  }

  // Cancel an existing bot order
  private cancelBotOrder(bot: BotUser, marketId: string): void {
    const market = this.markets.get(marketId);
    if (!market) return;
    
    // Find orders for this market
    const marketOrders = bot.activeOrders.filter(order => order.marketId === marketId);
    if (marketOrders.length === 0) return;
    
    // Select a random order to cancel
    const orderToCancel = marketOrders[Math.floor(Math.random() * marketOrders.length)];
    
    // Remove from bot's active orders
    bot.activeOrders = bot.activeOrders.filter(order => order.id !== orderToCancel.id);
    
    // Remove from market orders
    market.orders = market.orders.filter(order => order.id !== orderToCancel.id);
    
    console.log(`Bot ${bot.name} canceled ${orderToCancel.type} order at ${orderToCancel.price}`);
  }

  // Determine order details based on bot strategy
  private determineBotOrderDetails(bot: BotUser, market: Market): { type: OrderType, side: OrderSide, price: number, quantity: number } {
    let type: OrderType;
    let side: OrderSide;
    let price: number;
    let quantity: number;
    
    // Base quantity on bot balance
    quantity = 10 + Math.floor(Math.random() * 90);
    
    switch (bot.strategy) {
      case BotStrategy.MARKET_MAKER:
        // Market makers place orders on both sides to profit from the spread
        type = Math.random() < 0.5 ? OrderType.BUY : OrderType.SELL;
        side = OrderSide.YES; // Simplify to only YES side for now
        
        if (type === OrderType.BUY) {
          // Place buy order slightly below current price
          price = Math.max(0.01, market.currentPrice - (0.01 + Math.random() * 0.03));
        } else {
          // Place sell order slightly above current price
          price = Math.min(0.99, market.currentPrice + (0.01 + Math.random() * 0.03));
        }
        break;
        
      case BotStrategy.TREND_FOLLOWER:
        // Trend followers buy when price is rising, sell when falling
        if (market.currentPrice > market.lastTradePrice) {
          type = OrderType.BUY;
          price = Math.max(0.01, market.currentPrice - Math.random() * 0.02);
        } else {
          type = OrderType.SELL;
          price = Math.min(0.99, market.currentPrice + Math.random() * 0.02);
        }
        side = OrderSide.YES;
        break;
        
      case BotStrategy.CONTRARIAN:
        // Contrarians do the opposite of trend followers
        if (market.currentPrice > market.lastTradePrice) {
          type = OrderType.SELL;
          price = Math.min(0.99, market.currentPrice + Math.random() * 0.02);
        } else {
          type = OrderType.BUY;
          price = Math.max(0.01, market.currentPrice - Math.random() * 0.02);
        }
        side = OrderSide.YES;
        break;
        
      case BotStrategy.RANDOM:
      default:
        // Random strategy places random orders
        type = Math.random() < 0.5 ? OrderType.BUY : OrderType.SELL;
        side = OrderSide.YES;
        
        if (type === OrderType.BUY) {
          price = Math.max(0.01, market.currentPrice - (Math.random() * 0.05));
        } else {
          price = Math.min(0.99, market.currentPrice + (Math.random() * 0.05));
        }
        break;
    }
    
    // Round price to 2 decimal places
    price = Math.round(price * 100) / 100;
    
    return { type, side, price, quantity };
  }

  // Match orders in a market
  private matchOrders(marketId: string): void {
    const market = this.markets.get(marketId);
    if (!market) return;
    
    // Sort buy orders by price (highest first)
    const buyOrders = market.orders
      .filter(order => order.type === OrderType.BUY)
      .sort((a, b) => b.price - a.price);
    
    // Sort sell orders by price (lowest first)
    const sellOrders = market.orders
      .filter(order => order.type === OrderType.SELL)
      .sort((a, b) => a.price - b.price);
    
    // Check if there are matching orders
    if (buyOrders.length > 0 && sellOrders.length > 0) {
      const bestBuy = buyOrders[0];
      const bestSell = sellOrders[0];
      
      // If best buy price >= best sell price, we have a match
      if (bestBuy.price >= bestSell.price) {
        // Execute the trade at the sell price (taker pays)
        const tradePrice = bestSell.price;
        const tradeQuantity = Math.min(bestBuy.quantity, bestSell.quantity);
        
        // Update order quantities
        bestBuy.quantity -= tradeQuantity;
        bestSell.quantity -= tradeQuantity;
        
        // Update market price
        market.lastTradePrice = market.currentPrice;
        market.currentPrice = tradePrice;
        
        console.log(`Matched orders: ${tradeQuantity} shares at ${tradePrice}`);
        
        // Remove filled orders
        if (bestBuy.quantity === 0) {
          market.orders = market.orders.filter(order => order.id !== bestBuy.id);
          // Remove from bot's active orders
          const buyBot = this.bots.find(bot => bot.id === bestBuy.userId);
          if (buyBot) {
            buyBot.activeOrders = buyBot.activeOrders.filter(order => order.id !== bestBuy.id);
          }
        }
        
        if (bestSell.quantity === 0) {
          market.orders = market.orders.filter(order => order.id !== bestSell.id);
          // Remove from bot's active orders
          const sellBot = this.bots.find(bot => bot.id === bestSell.userId);
          if (sellBot) {
            sellBot.activeOrders = sellBot.activeOrders.filter(order => order.id !== bestSell.id);
          }
        }
        
        // Send trade update through WebSocket
        this.sendTradeUpdate(marketId, {
          marketId,
          price: tradePrice,
          quantity: tradeQuantity,
          buyerId: bestBuy.userId,
          sellerId: bestSell.userId,
          timestamp: Date.now()
        });
      }
    }
  }

  // Process a user order against bot orders
  public processUserOrder(userOrder: Order): void {
    const market = this.markets.get(userOrder.marketId);
    if (!market) return;
    
    // Add user order to market
    market.orders.push(userOrder);
    
    // Match orders
    this.matchOrders(userOrder.marketId);
    
    // Send order book update through WebSocket
    this.sendOrderBookUpdate(userOrder.marketId);
  }

  // Send order book update via WebSocket
  private sendOrderBookUpdate(marketId: string): void {
    const market = this.markets.get(marketId);
    if (!market) return;
    
    console.log(`Preparing order book update for market ${marketId}`);
    
    // Get all buy orders (bids)
    const bids = market.orders
      .filter(order => order.type === OrderType.BUY && order.side === OrderSide.YES)
      .sort((a, b) => b.price - a.price) // Sort by price descending (highest bid first)
      .reduce((acc: any[], order) => {
        // Group by price level
        const existingLevel = acc.find(level => level.price === order.price);
        if (existingLevel) {
          existingLevel.quantity += order.quantity;
          existingLevel.orders += 1;
        } else {
          acc.push({
            price: order.price.toFixed(2),
            quantity: order.quantity,
            orders: 1
          });
        }
        return acc;
      }, [])
      .slice(0, 10); // Only take top 10 levels
    
    // Get all sell orders (asks)
    const asks = market.orders
      .filter(order => order.type === OrderType.SELL && order.side === OrderSide.YES)
      .sort((a, b) => a.price - b.price) // Sort by price ascending (lowest ask first)
      .reduce((acc: any[], order) => {
        // Group by price level
        const existingLevel = acc.find(level => level.price === order.price);
        if (existingLevel) {
          existingLevel.quantity += order.quantity;
          existingLevel.orders += 1;
        } else {
          acc.push({
            price: order.price.toFixed(2),
            quantity: order.quantity,
            orders: 1
          });
        }
        return acc;
      }, [])
      .slice(0, 10); // Only take top 10 levels
    
    // Make sure we always have at least one level in each side to avoid UI issues
    if (bids.length === 0) {
      bids.push({
        price: Math.max(0.01, (market.currentPrice - 0.05)).toFixed(2),
        quantity: 10,
        orders: 1
      });
    }
    
    if (asks.length === 0) {
      asks.push({
        price: Math.min(0.99, (market.currentPrice + 0.05)).toFixed(2),
        quantity: 10,
        orders: 1
      });
    }
    
    // Prepare the order book data
    const orderBookData = {
      marketId,
      bids,
      asks,
      lastPrice: market.currentPrice.toFixed(2),
      lastTradePrice: market.lastTradePrice ? market.lastTradePrice.toFixed(2) : null,
      lastTradeQuantity: null,
      lastUpdated: Date.now()
    };
    
    console.log(`Sending order book update for market ${marketId}: ${bids.length} bids, ${asks.length} asks`);
    
    try {
      // Check if we're in a Node.js environment with global io
      if (typeof global !== 'undefined' && global.io) {
        // Use the global Socket.IO instance
        const io = global.io as any;
        io.to(`market:${marketId}`).emit('orderbook:update', orderBookData);
      } else {
        console.warn('WebSocket server not initialized');
      }
    } catch (error) {
      console.error('Error sending order book update:', error);
    }
    
    // Also send a simplified price update for charting
    try {
      if (typeof global !== 'undefined' && global.io) {
        const io = global.io as any;
        io.to(`market:${marketId}`).emit('price:update', {
          marketId,
          lastPrice: market.currentPrice.toFixed(2),
          lastUpdated: Date.now()
        });
      }
    } catch (error) {
      console.error('Error sending price update:', error);
    }
  }

  // Send trade update via WebSocket
  private sendTradeUpdate(marketId: string, tradeData: any): void {
    try {
      // Check if we're in a Node.js environment
      if (typeof global !== 'undefined' && global.io) {
        // Use the global Socket.IO instance
        const io = global.io as any;
        io.to(`market:${marketId}`).emit('trade:update', tradeData);
      } else {
        console.warn('WebSocket server not initialized for trade update');
      }
    } catch (error) {
      console.error('Error sending trade update:', error);
    }
  }

  // Get a random interval for bot activity
  private getRandomInterval(): number {
    return ORDER_INTERVAL_MIN + Math.random() * (ORDER_INTERVAL_MAX - ORDER_INTERVAL_MIN);
  }

  // Get market data
  public getMarketData(marketId: string): any {
    const market = this.markets.get(marketId);
    if (!market) return null;
    
    return {
      id: market.id,
      name: market.name,
      description: market.description,
      currentPrice: market.currentPrice,
      orderBook: {
        bids: market.orders
          .filter(order => order.type === OrderType.BUY)
          .sort((a, b) => b.price - a.price)
          .map(order => ({
            price: order.price,
            quantity: order.quantity
          })),
        asks: market.orders
          .filter(order => order.type === OrderType.SELL)
          .sort((a, b) => a.price - b.price)
          .map(order => ({
            price: order.price,
            quantity: order.quantity
          }))
      }
    };
  }

  // Start all liquidity generation
  public start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.markets.forEach((_, marketId) => {
      this.startLiquidityGeneration(marketId);
    });
    
    console.log('Bot service started');
  }

  // Stop all liquidity generation
  public stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    this.orderIntervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.orderIntervals.clear();
    
    console.log('Bot service stopped');
  }
}

// Export singleton instance
export const botService = BotService.getInstance(); 