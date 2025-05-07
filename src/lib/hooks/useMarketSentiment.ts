import { useState, useEffect, useCallback } from 'react';
import { useSocket } from './useSocket';
import axios from 'axios';

// Market types
type MarketType = 'cricket' | 'politics' | 'entertainment' | 'custom';

// Sentiment levels
export enum SentimentLevel {
  STRONGLY_NEGATIVE = -2,
  NEGATIVE = -1,
  NEUTRAL = 0,
  POSITIVE = 1,
  STRONGLY_POSITIVE = 2
}

// Market event interface
interface MarketEvent {
  id: string;
  marketId: string;
  title: string;
  description: string;
  sentimentImpact: number;
  timestamp: number;
}

// Market sentiment interface
interface MarketSentiment {
  marketId: string;
  currentSentiment: SentimentLevel;
  initialSentiment: SentimentLevel;
  volatility: number;
  history: Array<{
    timestamp: number;
    sentiment: SentimentLevel;
    price: number;
  }>;
  events: MarketEvent[];
}

// Price history point interface
interface PricePoint {
  timestamp: number;
  price: number;
}

export function useMarketSentiment(marketId?: string) {
  const [sentiment, setSentiment] = useState<MarketSentiment | null>(null);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { socket, isConnected } = useSocket();

  // Create a new market
  const createMarket = useCallback(async (
    type: MarketType,
    customData?: any
  ) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await axios.post('/api/markets/sentiment', {
        type,
        customData
      });
      
      if (response.data.success) {
        return response.data.marketId;
      }
      
      return null;
    } catch (err: any) {
      setError(err.message || 'Failed to create market');
      console.error('Error creating market:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get market sentiment
  const getMarketSentiment = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await axios.get(`/api/markets/sentiment?marketId=${id}`);
      
      if (response.data.success) {
        setSentiment(response.data.data);
        return response.data.data;
      }
      
      return null;
    } catch (err: any) {
      setError(err.message || 'Failed to get market sentiment');
      console.error('Error getting market sentiment:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get price history for charts
  const getPriceHistory = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await axios.get(`/api/markets/sentiment?marketId=${id}&historyOnly=true`);
      
      if (response.data.success) {
        setPriceHistory(response.data.history);
        return response.data.history;
      }
      
      return [];
    } catch (err: any) {
      setError(err.message || 'Failed to get price history');
      console.error('Error getting price history:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Add a market event
  const addMarketEvent = useCallback(async (
    id: string,
    title: string,
    description: string,
    sentimentImpact: number
  ) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await axios.put('/api/markets/sentiment', {
        marketId: id,
        title,
        description,
        sentimentImpact
      });
      
      if (response.data.success) {
        // Refresh sentiment data
        await getMarketSentiment(id);
        return true;
      }
      
      return false;
    } catch (err: any) {
      setError(err.message || 'Failed to add market event');
      console.error('Error adding market event:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getMarketSentiment]);

  // Create a cricket market
  const createCricketMarket = useCallback(async (
    homeTeam: string,
    awayTeam: string,
    homeAdvantage: boolean = true
  ) => {
    return createMarket('cricket', {
      homeTeam,
      awayTeam,
      homeAdvantage
    });
  }, [createMarket]);

  // Create a politics market
  const createPoliticsMarket = useCallback(async (
    candidate1: string,
    candidate2: string,
    initialPolls: 'even' | 'favor1' | 'favor2' = 'even'
  ) => {
    return createMarket('politics', {
      candidate1,
      candidate2,
      initialPolls
    });
  }, [createMarket]);

  // Create an entertainment market
  const createEntertainmentMarket = useCallback(async (
    show: string,
    nominee: string,
    category: string,
    isFavorite: boolean = false
  ) => {
    return createMarket('entertainment', {
      show,
      nominee,
      category,
      isFavorite
    });
  }, [createMarket]);

  // Create a custom market
  const createCustomMarket = useCallback(async (
    name: string,
    description: string,
    sentiment: SentimentLevel = SentimentLevel.NEUTRAL,
    volatility: number = 0.2
  ) => {
    return createMarket('custom', {
      name,
      description,
      sentiment,
      volatility
    });
  }, [createMarket]);

  // Get sentiment text description
  const getSentimentDescription = useCallback((level: SentimentLevel): string => {
    switch (level) {
      case SentimentLevel.STRONGLY_NEGATIVE:
        return 'Very Unlikely';
      case SentimentLevel.NEGATIVE:
        return 'Unlikely';
      case SentimentLevel.NEUTRAL:
        return 'Even Odds';
      case SentimentLevel.POSITIVE:
        return 'Likely';
      case SentimentLevel.STRONGLY_POSITIVE:
        return 'Very Likely';
      default:
        return 'Unknown';
    }
  }, []);

  // Load initial data if marketId is provided
  useEffect(() => {
    if (marketId) {
      getMarketSentiment(marketId);
      getPriceHistory(marketId);
    }
  }, [marketId, getMarketSentiment, getPriceHistory]);

  // Listen for price updates via socket
  useEffect(() => {
    if (!socket || !isConnected || !marketId) {
      return;
    }
    
    const handlePriceUpdate = (data: any) => {
      if (data.marketId === marketId) {
        // Add new price point to history
        setPriceHistory(prev => [
          ...prev,
          {
            timestamp: data.timestamp,
            price: data.price
          }
        ]);
        
        // Refresh sentiment data
        getMarketSentiment(marketId);
      }
    };
    
    socket.on('price:update', handlePriceUpdate);
    
    return () => {
      socket.off('price:update', handlePriceUpdate);
    };
  }, [socket, isConnected, marketId, getMarketSentiment]);

  return {
    sentiment,
    priceHistory,
    isLoading,
    error,
    createMarket,
    getMarketSentiment,
    getPriceHistory,
    addMarketEvent,
    createCricketMarket,
    createPoliticsMarket,
    createEntertainmentMarket,
    createCustomMarket,
    getSentimentDescription,
    SentimentLevel
  };
} 