import { Decimal } from 'decimal.js';
import { OrderSide } from './types';

/**
 * Market option data for pricing calculations
 */
export interface MarketOption {
  id: number;
  marketId: number;
  name: string;
  initialPrice: string;
  currentPrice: string;
  lastPrice?: string;
  minPrice?: string;
  maxPrice?: string;
  weight?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Price update result
 */
export interface PriceUpdateResult {
  marketOptionId: number;
  oldPrice: string;
  newPrice: string;
  lastPrice: string;
}

/**
 * MarketPricer class handles price discovery and updates
 */
export class MarketPricer {
  /**
   * Process a market order and update prices
   * @param marketId The market ID
   * @param marketOptionId The market option ID
   * @param side Order side (buy/sell)
   * @param quantity Order quantity
   * @param marketOptions All options in the market
   * @returns Price update results
   */
  processMarketOrder(
    marketId: number, 
    marketOptionId: number, 
    side: OrderSide, 
    quantity: string,
    marketOptions: MarketOption[]
  ): PriceUpdateResult[] {
    // Find the affected market option
    const option = marketOptions.find(o => o.id === marketOptionId && o.marketId === marketId);
    if (!option) {
      throw new Error(`Market option not found: ${marketOptionId}`);
    }
    
    // Calculate price impact based on order size and direction
    const quantityDecimal = new Decimal(quantity);
    const currentPrice = new Decimal(option.currentPrice);
    
    // Simple price impact model (can be refined based on market depth)
    const impactFactor = this.calculateImpactFactor(quantityDecimal);
    const priceChange = side === 'buy' 
      ? currentPrice.mul(impactFactor) 
      : currentPrice.mul(impactFactor).negated();
    
    // Calculate new price with limits
    let newPrice = currentPrice.plus(priceChange);
    
    // Apply min/max price constraints if defined
    if (option.minPrice) {
      const minPrice = new Decimal(option.minPrice);
      newPrice = Decimal.max(newPrice, minPrice);
    }
    
    if (option.maxPrice) {
      const maxPrice = new Decimal(option.maxPrice);
      newPrice = Decimal.min(newPrice, maxPrice);
    }
    
    // For binary markets, ensure the sum of probabilities is 1
    const isBinaryMarket = marketOptions.length === 2;
    const results: PriceUpdateResult[] = [];
    
    if (isBinaryMarket) {
      // Get the other option in the binary market
      const otherOption = marketOptions.find(o => o.id !== marketOptionId && o.marketId === marketId);
      if (otherOption) {
        // Ensure probabilities sum to 1 (assuming prices represent probabilities)
        const otherPrice = new Decimal(1).minus(newPrice);
        
        // Apply min/max constraints to other option
        let adjustedOtherPrice = otherPrice;
        if (otherOption.minPrice) {
          const minPrice = new Decimal(otherOption.minPrice);
          adjustedOtherPrice = Decimal.max(adjustedOtherPrice, minPrice);
        }
        
        if (otherOption.maxPrice) {
          const maxPrice = new Decimal(otherOption.maxPrice);
          adjustedOtherPrice = Decimal.min(adjustedOtherPrice, maxPrice);
        }
        
        // If other price was adjusted, we need to readjust the main price
        if (!adjustedOtherPrice.equals(otherPrice)) {
          newPrice = new Decimal(1).minus(adjustedOtherPrice);
        }
        
        // Add other option to results
        results.push({
          marketOptionId: otherOption.id,
          oldPrice: otherOption.currentPrice,
          newPrice: adjustedOtherPrice.toFixed(2),
          lastPrice: otherOption.lastPrice || otherOption.currentPrice,
        });
      }
    }
    
    // Add main option to results
    results.push({
      marketOptionId: option.id,
      oldPrice: option.currentPrice,
      newPrice: newPrice.toFixed(2),
      lastPrice: option.lastPrice || option.currentPrice,
    });
    
    return results;
  }
  
  /**
   * Calculate price impact factor based on order size
   * @param quantity Order quantity
   * @returns Impact factor (0-1)
   */
  private calculateImpactFactor(quantity: Decimal): Decimal {
    // Simple impact model - can be refined based on market liquidity
    // Small orders: 0-1% impact
    // Medium orders: 1-3% impact
    // Large orders: 3-5% impact
    
    if (quantity.lt(10)) {
      return new Decimal(0.005); // 0.5% impact
    } else if (quantity.lt(50)) {
      return new Decimal(0.02); // 2% impact
    } else {
      return new Decimal(0.04); // 4% impact
    }
  }
  
  /**
   * Update market prices based on trade activity
   * @param marketId Market ID
   * @param marketOptions Market options
   * @param orderBook Order book data
   * @returns Updated market options
   */
  updateMarketPrices(
    marketId: number,
    marketOptions: MarketOption[],
    orderBooks: { marketOptionId: number; bids: any[]; asks: any[] }[]
  ): MarketOption[] {
    const updatedOptions = [...marketOptions];
    
    // Process each market option
    for (const option of updatedOptions) {
      if (option.marketId !== marketId) continue;
      
      // Find order book for this option
      const orderBook = orderBooks.find(ob => ob.marketOptionId === option.id);
      if (!orderBook) continue;
      
      // Get best bid and ask
      const bestBid = orderBook.bids[0]?.price ? new Decimal(orderBook.bids[0].price) : null;
      const bestAsk = orderBook.asks[0]?.price ? new Decimal(orderBook.asks[0].price) : null;
      
      // If we have both bid and ask, use mid price
      if (bestBid && bestAsk) {
        const midPrice = bestBid.plus(bestAsk).div(2);
        option.currentPrice = midPrice.toFixed(2);
      }
      // Otherwise use the best available price
      else if (bestBid) {
        option.currentPrice = bestBid.toFixed(2);
      }
      else if (bestAsk) {
        option.currentPrice = bestAsk.toFixed(2);
      }
    }
    
    // For binary markets, ensure probabilities sum to 1
    if (updatedOptions.length === 2) {
      const sum = updatedOptions.reduce(
        (total, option) => total.plus(new Decimal(option.currentPrice)), 
        new Decimal(0)
      );
      
      // If sum is not 1, adjust prices proportionally
      if (!sum.equals(1)) {
        for (const option of updatedOptions) {
          option.currentPrice = new Decimal(option.currentPrice).div(sum).toFixed(2);
        }
      }
    }
    
    return updatedOptions;
  }
} 