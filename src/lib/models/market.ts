import { markets, marketOptions, marketPriceHistory } from '@/lib/db/schema';

export type MarketStatus = typeof markets.$inferSelect.status;
export type MarketType = typeof markets.$inferSelect.type;

export interface MarketOption {
  id: number;
  marketId: number;
  name: string;
  initialPrice: string;
  currentPrice: string;
  lastPrice?: string;
  minPrice?: string;
  maxPrice?: string;
  metadata?: Record<string, any>;
  weight: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Market {
  id: number;
  eventId: number;
  name: string;
  description?: string;
  type: MarketType;
  status: MarketStatus;
  metadata?: Record<string, any>;
  settledOption?: string;
  settledAt?: Date;
  suspendedReason?: string;
  tradingVolume: string;
  createdAt: Date;
  updatedAt: Date;
  options?: MarketOption[];
  event?: {
    id: number;
    name: string;
    homeTeam?: string;
    awayTeam?: string;
    startTime: Date;
    endTime?: Date;
    result?: Record<string, any>;
    sport?: {
      id: number;
      name: string;
      type: string;
    };
  };
}

export interface PricePoint {
  price: string;
  timestamp: Date;
}

// Market type-specific metadata interfaces
export interface WinnerMarketMetadata {
  // No specific metadata for winner markets
}

export interface OverUnderMarketMetadata {
  line: number; // The total to go over/under
  unit: string; // e.g., "points", "goals", "runs"
}

export interface SpreadMarketMetadata {
  spread: number; // The point spread 
  favorite: 'home' | 'away'; // Which team is the favorite
}

export interface PropMarketMetadata {
  propType: string; // e.g., "player_points", "first_touchdown", etc.
  player?: string; // Player name if it's a player prop
  team?: string; // Team name if it's a team prop
}

export interface HandicapMarketMetadata {
  handicap: number;
  team: 'home' | 'away';
}

// Option metadata interfaces
export interface OverUnderOptionMetadata {
  type: 'over' | 'under';
  line: number;
}

export interface SpreadOptionMetadata {
  type: 'favorite' | 'underdog';
  points: number;
}

// Helper functions for market calculations
export const calculateImpliedProbability = (decimalOdds: number): number => {
  return 1 / decimalOdds;
};

export const calculateMarketFairness = (options: MarketOption[]): number => {
  const totalImpliedProbability = options.reduce((sum, option) => {
    return sum + calculateImpliedProbability(parseFloat(option.currentPrice));
  }, 0);
  
  // Return market fairness as a percentage (100% = perfectly fair)
  return 100 / totalImpliedProbability;
};

export const formatPrice = (price: string | number): string => {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  return numPrice.toFixed(2);
};

export const getMarketDescription = (market: Market): string => {
  switch (market.type) {
    case 'winner':
      return `Predict the winner of ${market.event?.name || 'the event'}`;
    
    case 'over_under':
      if (market.metadata && 'line' in market.metadata) {
        const { line, unit = 'points' } = market.metadata as OverUnderMarketMetadata;
        return `Predict whether the total ${unit} will be over or under ${line}`;
      }
      return 'Predict whether the total will be over or under the line';
    
    case 'spread':
      if (market.metadata && 'spread' in market.metadata && 'favorite' in market.metadata) {
        const { spread, favorite } = market.metadata as SpreadMarketMetadata;
        const favoriteTeam = favorite === 'home' ? market.event?.homeTeam : market.event?.awayTeam;
        return `${favoriteTeam} to win by more than ${spread} points`;
      }
      return 'Predict whether the favorite will cover the spread';
    
    case 'prop':
      if (market.metadata && 'propType' in market.metadata) {
        const { propType, player, team } = market.metadata as PropMarketMetadata;
        if (player) {
          return `Predict ${player}'s ${propType.replace('_', ' ')}`;
        } else if (team) {
          return `Predict ${team}'s ${propType.replace('_', ' ')}`;
        }
        return `Predict the ${propType.replace('_', ' ')}`;
      }
      return 'Proposition bet on a specific occurrence';
    
    case 'handicap':
      if (market.metadata && 'handicap' in market.metadata && 'team' in market.metadata) {
        const { handicap, team } = market.metadata as HandicapMarketMetadata;
        const handicapTeam = team === 'home' ? market.event?.homeTeam : market.event?.awayTeam;
        return `${handicapTeam} with a ${handicap} handicap`;
      }
      return 'Predict the outcome with a handicap applied';
    
    case 'custom':
      return market.description || 'Custom market';
    
    default:
      return market.description || 'Predict the outcome of this market';
  }
};

// Function to get display text for market status
export const getMarketStatusDisplay = (status: MarketStatus): string => {
  switch (status) {
    case 'open':
      return 'Open';
    case 'suspended':
      return 'Suspended';
    case 'closed':
      return 'Closed';
    case 'settled':
      return 'Settled';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
};

// Function to check if a market allows trading
export const canTradeMarket = (market: Market): boolean => {
  return market.status === 'open';
}; 