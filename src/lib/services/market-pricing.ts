import { Market, MarketOption, calculateImpliedProbability } from '@/lib/models/market';
import { db } from '@/lib/db';
import { marketOptions, marketPriceHistory, markets } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Constants for pricing models
const MIN_PRICE = 1.01; // Minimum price (highest probability ~99%)
const MAX_PRICE = 1000.0; // Maximum price (lowest probability ~0.1%)
const DEFAULT_MARKET_OVERROUND = 1.05; // 5% house edge

/**
 * Calculate new price based on market activity
 * @param option The market option to update
 * @param orderSide Buy or sell
 * @param quantity Quantity of the order
 * @param currentLiquidity Estimated market liquidity
 * @returns The new price
 */
export const calculateNewPrice = (
  option: MarketOption,
  orderSide: 'buy' | 'sell',
  quantity: number,
  currentLiquidity: number
): number => {
  // Current implied probability
  const currentProb = calculateImpliedProbability(parseFloat(option.currentPrice));
  
  // Calculate impact factor based on order size relative to liquidity
  const impactFactor = Math.min(1, quantity / currentLiquidity);
  
  // Buy orders increase price (decrease probability), sell orders decrease price (increase probability)
  const probChange = orderSide === 'buy' 
    ? -currentProb * 0.1 * impactFactor 
    : currentProb * 0.1 * impactFactor;
  
  // New implied probability with limits
  const newProb = Math.min(0.99, Math.max(0.001, currentProb + probChange));
  
  // Convert back to decimal odds
  const newPrice = 1 / newProb;
  
  // Ensure price is within limits
  return Math.min(MAX_PRICE, Math.max(MIN_PRICE, newPrice));
};

/**
 * Re-balance all option prices in a market to ensure they add up to the desired overround
 * @param market The market to rebalance
 * @param options All options in the market
 * @param overround The desired overround (e.g., 1.05 for 5% house edge)
 * @returns The rebalanced option prices
 */
export const rebalanceMarket = (
  market: Market,
  options: MarketOption[],
  overround: number = DEFAULT_MARKET_OVERROUND
): MarketOption[] => {
  // Calculate current implied probabilities
  const probabilities = options.map(option => {
    return {
      id: option.id,
      probability: calculateImpliedProbability(parseFloat(option.currentPrice))
    };
  });
  
  // Calculate total probability
  const totalProb = probabilities.reduce((sum, item) => sum + item.probability, 0);
  
  // Rebalance to desired overround
  return options.map((option, index) => {
    // Normalize the probability and apply the overround
    const normalizedProb = (probabilities[index].probability / totalProb) * overround;
    
    // Calculate new price (decimal odds) from probability
    const newPrice = Math.min(MAX_PRICE, Math.max(MIN_PRICE, 1 / normalizedProb));
    
    return {
      ...option,
      currentPrice: newPrice.toFixed(2)
    };
  });
};

/**
 * Updates a market option price and records the price history
 * @param optionId The option ID to update
 * @param newPrice The new price
 * @returns The updated option
 */
export const updateOptionPrice = async (
  optionId: number,
  newPrice: number
): Promise<MarketOption | null> => {
  try {
    // Round price to 2 decimal places
    const formattedPrice = parseFloat(newPrice.toFixed(2));
    
    // Update the option price
    const [updatedOption] = await db
      .update(marketOptions)
      .set({
        lastPrice: marketOptions.currentPrice,
        currentPrice: formattedPrice.toString(),
        updatedAt: new Date(),
      })
      .where(eq(marketOptions.id, optionId))
      .returning();
    
    if (!updatedOption) {
      return null;
    }
    
    // Convert DB result to MarketOption interface
    const result: MarketOption = {
      id: updatedOption.id,
      marketId: updatedOption.marketId,
      name: updatedOption.name,
      initialPrice: updatedOption.initialPrice,
      currentPrice: updatedOption.currentPrice,
      lastPrice: updatedOption.lastPrice?.toString(),
      minPrice: updatedOption.minPrice?.toString(),
      maxPrice: updatedOption.maxPrice?.toString(),
      metadata: updatedOption.metadata as Record<string, any> | undefined,
      weight: updatedOption.weight,
      createdAt: updatedOption.createdAt,
      updatedAt: updatedOption.updatedAt,
    };
    
    // Record price history
    await db.insert(marketPriceHistory).values({
      marketOptionId: optionId,
      price: formattedPrice.toString(),
      timestamp: new Date(),
    });
    
    return result;
  } catch (error) {
    console.error('Error updating option price:', error);
    return null;
  }
};

/**
 * Process a market order and update prices accordingly
 * @param marketId The market ID
 * @param optionId The option ID being traded
 * @param side Buy or sell
 * @param quantity The quantity of the order
 */
export const processMarketOrder = async (
  marketId: number,
  optionId: number,
  side: 'buy' | 'sell',
  quantity: number
): Promise<boolean> => {
  try {
    // Fetch the market and its options
    const market = await fetchMarketWithOptions(marketId);
    if (!market) {
      throw new Error('Market not found');
    }
    
    // Find the option being traded
    const option = market.options?.find(opt => opt.id === optionId);
    if (!option) {
      throw new Error('Option not found');
    }
    
    // Estimate market liquidity based on trading volume
    const marketLiquidity = Math.max(1000, parseFloat(market.tradingVolume));
    
    // Calculate new price based on the order
    const newPrice = calculateNewPrice(option, side, quantity, marketLiquidity);
    
    // Update the option price
    await updateOptionPrice(optionId, newPrice);
    
    // Rebalance the other options in the market
    const otherOptions = market.options?.filter(opt => opt.id !== optionId) || [];
    
    if (otherOptions.length > 0) {
      const allOptions = [...otherOptions, { ...option, currentPrice: newPrice.toString() }];
      const rebalancedOptions = rebalanceMarket(market, allOptions);
      
      // Update all other options with rebalanced prices
      for (const rebalancedOption of rebalancedOptions) {
        if (rebalancedOption.id !== optionId) { // Skip the main option which we've already updated
          await updateOptionPrice(
            rebalancedOption.id,
            parseFloat(rebalancedOption.currentPrice)
          );
        }
      }
    }
    
    // Update market trading volume
    await updateMarketVolume(marketId, quantity);
    
    return true;
  } catch (error) {
    console.error('Error processing market order:', error);
    return false;
  }
};

/**
 * Update market trading volume
 * @param marketId The market ID
 * @param additionalVolume The additional volume
 */
export const updateMarketVolume = async (
  marketId: number,
  additionalVolume: number
): Promise<void> => {
  try {
    // First get the current volume
    const marketData = await db.query.markets.findFirst({
      where: eq(markets.id, marketId),
      columns: { tradingVolume: true }
    });
    
    if (!marketData) return;
    
    // Calculate new volume
    const currentVolume = parseFloat(marketData.tradingVolume);
    const newVolume = currentVolume + additionalVolume;
    
    // Update with new volume
    await db
      .update(markets)
      .set({
        tradingVolume: newVolume.toString(),
        updatedAt: new Date(),
      })
      .where(eq(markets.id, marketId));
  } catch (error) {
    console.error('Error updating market volume:', error);
  }
};

/**
 * Fetch a market with its options
 * @param marketId The market ID
 * @returns The market with options
 */
export const fetchMarketWithOptions = async (marketId: number): Promise<Market | null> => {
  try {
    const result = await db.query.markets.findFirst({
      where: eq(markets.id, marketId),
      with: {
        options: true,
        event: {
          with: {
            sport: true,
          },
        },
      },
    });
    
    if (!result) {
      return null;
    }
    
    // Convert DB result to Market interface
    const market: Market = {
      id: result.id,
      eventId: result.eventId,
      name: result.name,
      description: result.description || undefined,
      type: result.type,
      status: result.status,
      metadata: result.metadata as Record<string, any> | undefined,
      settledOption: result.settledOption || undefined,
      settledAt: result.settledAt || undefined,
      suspendedReason: result.suspendedReason || undefined,
      tradingVolume: result.tradingVolume,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      options: result.options.map(opt => ({
        id: opt.id,
        marketId: opt.marketId,
        name: opt.name,
        initialPrice: opt.initialPrice,
        currentPrice: opt.currentPrice,
        lastPrice: opt.lastPrice?.toString(),
        minPrice: opt.minPrice?.toString(),
        maxPrice: opt.maxPrice?.toString(),
        metadata: opt.metadata as Record<string, any> | undefined,
        weight: opt.weight,
        createdAt: opt.createdAt,
        updatedAt: opt.updatedAt,
      })),
      event: result.event ? {
        id: result.event.id,
        name: result.event.name,
        homeTeam: result.event.homeTeam || undefined,
        awayTeam: result.event.awayTeam || undefined,
        startTime: result.event.startTime,
        endTime: result.event.endTime || undefined,
        result: result.event.result as Record<string, any> | undefined,
        sport: result.event.sport ? {
          id: result.event.sport.id,
          name: result.event.sport.name,
          type: result.event.sport.type,
        } : undefined,
      } : undefined,
    };
    
    return market;
  } catch (error) {
    console.error('Error fetching market with options:', error);
    return null;
  }
}; 