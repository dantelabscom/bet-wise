"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { Market, MarketOption } from '@/lib/models/market';
import { OrderBook as OrderBookType, OrderBookEntry } from '@/lib/models/order';

interface CricketOrderBookProps {
  marketId: number;
  marketOption: MarketOption;
  marketType: string;
  matchData?: any; // Cricket match data
  onPlaceOrder?: (price: string, side: 'buy' | 'sell') => void;
}

export default function CricketOrderBook({ 
  marketId, 
  marketOption, 
  marketType,
  matchData,
  onPlaceOrder 
}: CricketOrderBookProps) {
  const { data: session } = useSession();
  const [orderBook, setOrderBook] = useState<OrderBookType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Market specific data
  const [probability, setProbability] = useState<number>(0);
  const [lastTrade, setLastTrade] = useState<{price: string, quantity: string, time: string} | null>(null);
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | 'stable'>('stable');
  
  // Fetch order book data
  const fetchOrderBook = async () => {
    if (!session) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/markets/${marketId}/orderbook?optionId=${marketOption.id}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch order book');
      }
      
      const data = await response.json();
      
      // Update price direction based on last trade vs current price
      if (orderBook && orderBook.lastTradePrice) {
        const prevPrice = parseFloat(orderBook.lastTradePrice);
        const currPrice = parseFloat(data.lastTradePrice || marketOption.currentPrice);
        
        if (currPrice > prevPrice) {
          setPriceDirection('up');
        } else if (currPrice < prevPrice) {
          setPriceDirection('down');
        } else {
          setPriceDirection('stable');
        }
      }
      
      setOrderBook(data);
      
      // Calculate implied probability from current price
      const currentPrice = parseFloat(data.lastTradePrice || marketOption.currentPrice);
      const calculatedProbability = (1 / currentPrice) * 100;
      setProbability(calculatedProbability);
      
      // Set last trade info
      if (data.lastTradePrice) {
        setLastTrade({
          price: data.lastTradePrice,
          quantity: data.lastTradeQuantity || '0',
          time: data.lastTradeTime || new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('Error fetching order book:', err);
      setError('Failed to load order book');
      toast.error('Failed to load order book');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch on initial load and every 5 seconds
  useEffect(() => {
    fetchOrderBook();
    
    const interval = setInterval(() => {
      fetchOrderBook();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [marketId, marketOption.id, session]);
  
  const handlePriceClick = (price: string, side: 'buy' | 'sell') => {
    if (onPlaceOrder) {
      onPlaceOrder(price, side);
    }
  };
  
  // Get context-specific display information based on market type
  const getMarketContext = () => {
    if (!matchData) {
      return null;
    }
    
    switch (marketType) {
      case 'match_winner':
        return (
          <div className="text-xs text-gray-600 mt-2 space-y-1">
            <div>
              <span className="font-medium">{matchData.batting_team?.name}: </span>
              <span>{matchData.batting_team?.score}-{matchData.batting_team?.wickets} ({matchData.batting_team?.overs} overs)</span>
            </div>
            {matchData.previous_innings && matchData.previous_innings.length > 0 && (
              <div>
                <span className="font-medium">{matchData.previous_innings[0].team_name}: </span>
                <span>
                  {matchData.previous_innings[0].score}-{matchData.previous_innings[0].wickets} 
                  ({matchData.previous_innings[0].overs} overs)
                </span>
              </div>
            )}
          </div>
        );
      
      case 'total_runs':
        // Show current run rate and projected score
        const overs = matchData.batting_team?.overs || 0;
        const maxOvers = matchData.format === 'T20' ? 20 : (matchData.format === 'ODI' ? 50 : 90);
        const remainingOvers = Math.max(0, maxOvers - overs);
        const currentRunRate = matchData.batting_team?.run_rate || 0;
        const projectedScore = matchData.batting_team?.score + Math.round(currentRunRate * remainingOvers);
        
        return (
          <div className="text-xs text-gray-600 mt-2">
            <div>
              <span className="font-medium">Current score: </span>
              <span>{matchData.batting_team?.score}-{matchData.batting_team?.wickets}</span>
            </div>
            <div>
              <span className="font-medium">Run rate: </span>
              <span>{currentRunRate.toFixed(2)}</span>
            </div>
            <div>
              <span className="font-medium">Projected: </span>
              <span>{projectedScore} ({overs}/{maxOvers} overs)</span>
            </div>
          </div>
        );
      
      case 'player_performance':
        // For player performance markets
        return (
          <div className="text-xs text-gray-600 mt-2">
            <div>
              <span className="font-medium">{marketOption.name}</span>
            </div>
            <div>
              <span className="font-medium">Current: </span>
              <span>0</span> {/* This would need to be fetched from player stats */}
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };
  
  if (loading && !orderBook) {
    return (
      <div className="rounded-lg bg-white p-4 shadow-md">
        <div className="mb-2 text-lg font-semibold text-gray-900">Cricket Order Book</div>
        <div className="flex h-40 items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="rounded-lg bg-white p-4 shadow-md">
        <div className="mb-2 text-lg font-semibold text-gray-900">Cricket Order Book</div>
        <div className="text-red-500">{error}</div>
        <button 
          onClick={fetchOrderBook}
          className="mt-2 rounded bg-blue-500 px-3 py-1 text-white hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }
  
  return (
    <div className="rounded-lg bg-white p-4 shadow-md">
      <div className="mb-2 text-lg font-semibold text-gray-900 flex justify-between items-center">
        <div>
          {marketOption.name}
          <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
            {probability.toFixed(1)}%
          </span>
        </div>
        <div className={`text-base font-medium ${
          priceDirection === 'up' ? 'text-green-600' : 
          priceDirection === 'down' ? 'text-red-600' : 'text-gray-800'
        }`}>
          {marketOption.currentPrice}
          {priceDirection === 'up' && <span className="ml-1">↑</span>}
          {priceDirection === 'down' && <span className="ml-1">↓</span>}
        </div>
      </div>
      
      {/* Market context information */}
      {getMarketContext()}
      
      <div className="mb-4 flex justify-between items-center text-sm mt-4">
        <span className="text-gray-500">
          Last Trade: <span className="font-medium">{lastTrade?.price || '-'}</span>
          {lastTrade && (
            <span className="ml-1 text-xs text-gray-400">
              ({lastTrade.quantity}) {new Date(lastTrade.time).toLocaleTimeString()}
            </span>
          )}
        </span>
      </div>
      
      <div className="flex flex-col">
        {/* Sell orders (asks) - sorted from highest to lowest */}
        <div className="mb-2">
          <div className="grid grid-cols-3 gap-2 text-xs font-medium text-gray-600 mb-1">
            <div>Price</div>
            <div className="text-right">Quantity</div>
            <div className="text-right">Orders</div>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {orderBook?.asks && orderBook.asks.length > 0 ? (
              // Display asks in reverse order (highest price at top)
              [...orderBook.asks].reverse().map((ask, index) => (
                <div
                  key={`ask-${index}`}
                  className="grid grid-cols-3 gap-2 text-sm py-1 hover:bg-red-50 cursor-pointer"
                  onClick={() => handlePriceClick(ask.price, 'buy')}
                >
                  <div className="font-medium text-red-600">{ask.price}</div>
                  <div className="text-right">{ask.quantity}</div>
                  <div className="text-right text-gray-500">{ask.orders}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500 py-2">No sell orders</div>
            )}
          </div>
        </div>
        
        {/* Market price indicator */}
        <div className="py-2 px-4 bg-gray-100 text-center text-sm font-medium mb-2">
          {marketOption.currentPrice}
        </div>
        
        {/* Buy orders (bids) - sorted from highest to lowest */}
        <div>
          <div className="grid grid-cols-3 gap-2 text-xs font-medium text-gray-600 mb-1">
            <div>Price</div>
            <div className="text-right">Quantity</div>
            <div className="text-right">Orders</div>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {orderBook?.bids && orderBook.bids.length > 0 ? (
              orderBook.bids.map((bid, index) => (
                <div
                  key={`bid-${index}`}
                  className="grid grid-cols-3 gap-2 text-sm py-1 hover:bg-green-50 cursor-pointer"
                  onClick={() => handlePriceClick(bid.price, 'sell')}
                >
                  <div className="font-medium text-green-600">{bid.price}</div>
                  <div className="text-right">{bid.quantity}</div>
                  <div className="text-right text-gray-500">{bid.orders}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500 py-2">No buy orders</div>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex justify-between mt-4">
        <button
          className="w-[48%] px-3 py-2 bg-green-600 text-white font-medium rounded hover:bg-green-700"
          onClick={() => handlePriceClick(marketOption.currentPrice, 'buy')}
        >
          Buy Yes
        </button>
        <button
          className="w-[48%] px-3 py-2 bg-red-600 text-white font-medium rounded hover:bg-red-700"
          onClick={() => handlePriceClick(marketOption.currentPrice, 'sell')}
        >
          Sell No
        </button>
      </div>
      
      <div className="mt-4 text-xs text-gray-500 text-right">
        Click on a price to place an order
      </div>
    </div>
  );
} 