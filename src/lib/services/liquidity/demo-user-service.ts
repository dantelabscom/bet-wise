import { v4 as uuidv4 } from 'uuid';
import { botService, Order, OrderType, OrderSide } from './bot-service';

// Demo user configuration
const INITIAL_BALANCE = 1000;

// Demo user structure
export interface DemoUser {
  id: string;
  name: string;
  balance: number;
  portfolio: {
    [marketId: string]: {
      yesShares: number;
      noShares: number;
      avgYesPrice: number;
      avgNoPrice: number;
    };
  };
  orders: Order[];
  trades: any[];
}

// Singleton class for demo user service
export class DemoUserService {
  private static instance: DemoUserService;
  private demoUsers: Map<string, DemoUser> = new Map();
  
  // Private constructor for singleton pattern
  private constructor() {}
  
  // Get singleton instance
  public static getInstance(): DemoUserService {
    if (!DemoUserService.instance) {
      DemoUserService.instance = new DemoUserService();
    }
    return DemoUserService.instance;
  }
  
  // Create a new demo user
  public createDemoUser(name: string = 'Demo User'): DemoUser {
    const userId = `demo-${uuidv4()}`;
    const demoUser: DemoUser = {
      id: userId,
      name: `${name}`,
      balance: INITIAL_BALANCE,
      portfolio: {},
      orders: [],
      trades: []
    };
    
    this.demoUsers.set(userId, demoUser);
    console.log(`Created demo user: ${userId}`);
    
    return demoUser;
  }
  
  // Get a demo user by ID
  public getDemoUser(userId: string): DemoUser | undefined {
    return this.demoUsers.get(userId);
  }
  
  // Place an order for a demo user
  public placeOrder(
    userId: string,
    marketId: string,
    type: OrderType,
    side: OrderSide,
    price: number,
    quantity: number
  ): Order | null {
    const demoUser = this.demoUsers.get(userId);
    if (!demoUser) {
      console.error(`Demo user ${userId} not found`);
      return null;
    }
    
    // Check if user has enough balance for buy orders
    if (type === OrderType.BUY) {
      const orderCost = price * quantity;
      if (demoUser.balance < orderCost) {
        console.error(`Demo user ${userId} has insufficient balance for order`);
        return null;
      }
      
      // Reserve funds for the order
      demoUser.balance -= orderCost;
    } else {
      // For sell orders, check if user has enough shares
      const portfolio = demoUser.portfolio[marketId];
      if (!portfolio) {
        console.error(`Demo user ${userId} has no position in market ${marketId}`);
        return null;
      }
      
      if (side === OrderSide.YES && portfolio.yesShares < quantity) {
        console.error(`Demo user ${userId} has insufficient YES shares for order`);
        return null;
      }
      
      if (side === OrderSide.NO && portfolio.noShares < quantity) {
        console.error(`Demo user ${userId} has insufficient NO shares for order`);
        return null;
      }
    }
    
    // Create the order
    const order: Order = {
      id: uuidv4(),
      userId,
      marketId,
      type,
      side,
      price,
      quantity,
      timestamp: Date.now(),
      isBot: false
    };
    
    // Add order to user's orders
    demoUser.orders.push(order);
    
    // Process the order through the bot service
    botService.processUserOrder(order);
    
    console.log(`Demo user ${userId} placed ${type} order for ${quantity} shares at ${price}`);
    
    return order;
  }
  
  // Cancel an order for a demo user
  public cancelOrder(userId: string, orderId: string): boolean {
    const demoUser = this.demoUsers.get(userId);
    if (!demoUser) {
      console.error(`Demo user ${userId} not found`);
      return false;
    }
    
    // Find the order
    const orderIndex = demoUser.orders.findIndex(order => order.id === orderId);
    if (orderIndex === -1) {
      console.error(`Order ${orderId} not found for demo user ${userId}`);
      return false;
    }
    
    const order = demoUser.orders[orderIndex];
    
    // Refund balance for buy orders
    if (order.type === OrderType.BUY) {
      const refundAmount = order.price * order.quantity;
      demoUser.balance += refundAmount;
    }
    
    // Remove the order
    demoUser.orders.splice(orderIndex, 1);
    
    console.log(`Demo user ${userId} canceled order ${orderId}`);
    
    return true;
  }
  
  // Process a trade for a demo user
  public processTrade(
    userId: string,
    marketId: string,
    type: OrderType,
    side: OrderSide,
    price: number,
    quantity: number,
    counterpartyId: string
  ): void {
    const demoUser = this.demoUsers.get(userId);
    if (!demoUser) {
      console.error(`Demo user ${userId} not found`);
      return;
    }
    
    // Initialize portfolio for this market if it doesn't exist
    if (!demoUser.portfolio[marketId]) {
      demoUser.portfolio[marketId] = {
        yesShares: 0,
        noShares: 0,
        avgYesPrice: 0,
        avgNoPrice: 0
      };
    }
    
    const portfolio = demoUser.portfolio[marketId];
    
    // Process the trade
    if (type === OrderType.BUY) {
      if (side === OrderSide.YES) {
        // Calculate new average price
        const totalShares = portfolio.yesShares + quantity;
        const totalCost = (portfolio.yesShares * portfolio.avgYesPrice) + (quantity * price);
        portfolio.avgYesPrice = totalCost / totalShares;
        portfolio.yesShares = totalShares;
      } else {
        // Calculate new average price
        const totalShares = portfolio.noShares + quantity;
        const totalCost = (portfolio.noShares * portfolio.avgNoPrice) + (quantity * price);
        portfolio.avgNoPrice = totalCost / totalShares;
        portfolio.noShares = totalShares;
      }
    } else {
      // For sell orders, reduce shares and update balance
      if (side === OrderSide.YES) {
        portfolio.yesShares -= quantity;
        demoUser.balance += price * quantity;
      } else {
        portfolio.noShares -= quantity;
        demoUser.balance += price * quantity;
      }
    }
    
    // Record the trade
    const trade = {
      id: uuidv4(),
      marketId,
      type,
      side,
      price,
      quantity,
      timestamp: Date.now(),
      counterpartyId
    };
    
    demoUser.trades.push(trade);
    
    console.log(`Demo user ${userId} executed ${type} trade for ${quantity} shares at ${price}`);
  }
  
  // Get portfolio for a demo user
  public getPortfolio(userId: string): any {
    const demoUser = this.demoUsers.get(userId);
    if (!demoUser) {
      console.error(`Demo user ${userId} not found`);
      return null;
    }
    
    return {
      userId: demoUser.id,
      name: demoUser.name,
      balance: demoUser.balance,
      portfolio: demoUser.portfolio,
      orders: demoUser.orders,
      trades: demoUser.trades
    };
  }
  
  // Reset a demo user's state
  public resetDemoUser(userId: string): boolean {
    const demoUser = this.demoUsers.get(userId);
    if (!demoUser) {
      console.error(`Demo user ${userId} not found`);
      return false;
    }
    
    // Reset to initial state
    demoUser.balance = INITIAL_BALANCE;
    demoUser.portfolio = {};
    demoUser.orders = [];
    demoUser.trades = [];
    
    console.log(`Reset demo user ${userId}`);
    
    return true;
  }
  
  // Delete a demo user
  public deleteDemoUser(userId: string): boolean {
    if (!this.demoUsers.has(userId)) {
      console.error(`Demo user ${userId} not found`);
      return false;
    }
    
    this.demoUsers.delete(userId);
    console.log(`Deleted demo user ${userId}`);
    
    return true;
  }
}

// Export singleton instance
export const demoUserService = DemoUserService.getInstance(); 