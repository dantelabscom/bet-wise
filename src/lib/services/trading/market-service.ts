import { OrderMatcher } from '../orderbook/order-matcher';
import { webSocketService } from '../websocket/socket-service';
import { v4 as uuidv4 } from 'uuid';

// Create an instance of the order matcher
const orderMatcher = new OrderMatcher();

/**
 * Market types for cricket
 */
export enum MarketType {
  // Match markets
  MATCH_WINNER = 'match_winner',
  
  // Innings markets
  RUNS_IN_OVER = 'runs_in_over',
  WICKET_IN_OVER = 'wicket_in_over',
  BOUNDARY_IN_OVER = 'boundary_in_over',
  
  // Player markets
  PLAYER_RUNS = 'player_runs',
  PLAYER_WICKETS = 'player_wickets',
}

/**
 * Market status enum
 */
export enum MarketStatus {
  OPEN = 'open',
  SUSPENDED = 'suspended',
  CLOSED = 'closed',
  SETTLED = 'settled',
}

/**
 * Market interface for cricket markets
 */
export interface Market {
  id: string;
  matchId: string;
  type: MarketType;
  name: string;
  description: string;
  status: MarketStatus;
  createdAt: number;
  updatedAt: number;
  settledAt?: number;
  result?: 'yes' | 'no' | null;
  parameters?: any; // Additional parameters specific to the market type
}

/**
 * Service for managing cricket markets
 */
export class MarketService {
  private static instance: MarketService;
  private markets: Map<string, Market> = new Map();
  
  // Private constructor for singleton pattern
  private constructor() {}
  
  // Get singleton instance
  public static getInstance(): MarketService {
    if (!MarketService.instance) {
      MarketService.instance = new MarketService();
    }
    return MarketService.instance;
  }
  
  /**
   * Create a new market
   * @param matchId Match ID
   * @param type Market type
   * @param name Market name
   * @param description Market description
   * @param parameters Additional parameters
   */
  public createMarket(
    matchId: string,
    type: MarketType,
    name: string,
    description: string,
    parameters?: any
  ): Market {
    // Use the match ID directly as the market ID for the main market
    // For secondary markets, append the type
    let id: string;
    
    if (type === MarketType.MATCH_WINNER) {
      // Main market - use the match ID directly
      id = matchId;
    } else {
      // Secondary market - append the type for uniqueness
      id = `${matchId}-${type}`;
    }
    
    const now = Date.now();
    
    const market: Market = {
      id,
      matchId,
      type,
      name,
      description,
      status: MarketStatus.OPEN,
      createdAt: now,
      updatedAt: now,
      parameters
    };
    
    // Store the market
    this.markets.set(id, market);
    
    console.log(`Created market: ${name} (${id}) for match ${matchId}`);
    
    return market;
  }
  
  /**
   * Get a market by ID
   * @param marketId Market ID
   */
  public getMarket(marketId: string): Market | null {
    return this.markets.get(marketId) || null;
  }
  
  /**
   * Get all markets for a match
   * @param matchId Match ID
   */
  public getMarketsForMatch(matchId: string): Market[] {
    return Array.from(this.markets.values())
      .filter(market => market.matchId === matchId);
  }
  
  /**
   * Update a market's status
   * @param marketId Market ID
   * @param status New status
   */
  public updateMarketStatus(marketId: string, status: MarketStatus): Market | null {
    const market = this.markets.get(marketId);
    if (!market) return null;
    
    market.status = status;
    market.updatedAt = Date.now();
    
    // If closed or settled, update the settledAt time
    if (status === MarketStatus.CLOSED || status === MarketStatus.SETTLED) {
      market.settledAt = Date.now();
    }
    
    // Store the updated market
    this.markets.set(marketId, market);
    
    console.log(`Updated market ${marketId} status to ${status}`);
    
    return market;
  }
  
  /**
   * Settle a market with a result
   * @param marketId Market ID
   * @param result Market result ('yes' or 'no')
   */
  public settleMarket(marketId: string, result: 'yes' | 'no'): Market | null {
    const market = this.markets.get(marketId);
    if (!market) return null;
    
    market.status = MarketStatus.SETTLED;
    market.result = result;
    market.updatedAt = Date.now();
    market.settledAt = Date.now();
    
    // Store the updated market
    this.markets.set(marketId, market);
    
    console.log(`Settled market ${marketId} with result: ${result}`);
    
    // Notify through WebSocket
    webSocketService.sendMatchUpdate(market.matchId, {
      type: 'market_settled',
      marketId,
      result
    });
    
    return market;
  }
  
  /**
   * Create standard markets for a cricket match
   * This creates the default set of markets for a match
   * @param matchId Match ID
   */
  public createStandardMarketsForMatch(matchId: string): Market[] {
    const markets: Market[] = [];
    
    // Main market - Match winner
    // This will use the match ID directly
    markets.push(this.createMarket(
      matchId,
      MarketType.MATCH_WINNER,
      'Match Winner',
      'Will the home team win the match?',
      {}
    ));
    
    // Secondary markets - these will append the type to the match ID
    markets.push(this.createMarket(
      matchId,
      MarketType.RUNS_IN_OVER,
      '6+ Runs in Next Over',
      'Will there be 6 or more runs in the next over?',
      { runsThreshold: 6 }
    ));
    
    markets.push(this.createMarket(
      matchId,
      MarketType.WICKET_IN_OVER,
      'Wicket in Next Over',
      'Will there be a wicket in the next over?',
      {}
    ));
    
    markets.push(this.createMarket(
      matchId,
      MarketType.BOUNDARY_IN_OVER,
      'Boundary in Next Over',
      'Will there be a boundary (4 or 6) in the next over?',
      {}
    ));
    
    console.log(`Created ${markets.length} standard markets for match ${matchId}`);
    console.log(`Main market ID: ${matchId}`);
    
    return markets;
  }
  
  /**
   * Process a ball event to update markets
   * @param ballEvent Ball event data
   */
  public processBallEvent(ballEvent: any): void {
    try {
      const { matchId, over, runs, isWicket, isBoundary, isSix } = ballEvent;
      
      // Get all active markets for this match
      const matchMarkets = this.getMarketsForMatch(matchId)
        .filter(market => market.status === MarketStatus.OPEN);
      
      // Process each market type
      for (const market of matchMarkets) {
        switch (market.type) {
          case MarketType.RUNS_IN_OVER: {
            // Check if this completes an over
            if (ballEvent.ball === 6) {
              // Get total runs in this over (would need to aggregate from all balls)
              // For now, let's assume we can determine this
              const totalRunsInOver = Math.floor(Math.random() * 15); // Mock data
              
              // Get threshold from parameters
              const threshold = market.parameters?.runsThreshold || 6;
              
              // Settle the market
              this.settleMarket(market.id, totalRunsInOver >= threshold ? 'yes' : 'no');
              
              // Create a new market for the next over
              this.createMarket(
                matchId,
                MarketType.RUNS_IN_OVER,
                '6+ Runs in Next Over',
                'Will there be 6 or more runs in the next over?',
                { runsThreshold: 6 }
              );
            }
            break;
          }
          
          case MarketType.WICKET_IN_OVER: {
            // If wicket in this over, settle as 'yes'
            if (isWicket) {
              this.settleMarket(market.id, 'yes');
            }
            // If end of over and no wicket, settle as 'no'
            else if (ballEvent.ball === 6) {
              this.settleMarket(market.id, 'no');
              
              // Create a new market for the next over
              this.createMarket(
                matchId,
                MarketType.WICKET_IN_OVER,
                'Wicket in Next Over',
                'Will there be a wicket in the next over?',
                {}
              );
            }
            break;
          }
          
          case MarketType.BOUNDARY_IN_OVER: {
            // If boundary in this over, settle as 'yes'
            if (isBoundary || isSix) {
              this.settleMarket(market.id, 'yes');
            }
            // If end of over and no boundary, settle as 'no'
            else if (ballEvent.ball === 6) {
              this.settleMarket(market.id, 'no');
              
              // Create a new market for the next over
              this.createMarket(
                matchId,
                MarketType.BOUNDARY_IN_OVER,
                'Boundary in Next Over',
                'Will there be a boundary (4 or 6) in the next over?',
                {}
              );
            }
            break;
          }
          
          // Additional market types can be processed here
        }
      }
    } catch (error) {
      console.error('Error processing ball event for markets:', error);
    }
  }
}

// Export singleton instance
export const marketService = MarketService.getInstance(); 