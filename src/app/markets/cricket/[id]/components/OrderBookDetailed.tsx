'use client';

import React, { useState, useEffect } from 'react';
import { useSocket } from '@/lib/hooks/useSocket';

interface OrderLevel {
  price: string | number;
  quantity: number;
  orders?: number;
}

interface OrderBookData {
  marketId: string;
  bids: OrderLevel[];
  asks: OrderLevel[];
  lastPrice: string | number;
  lastTradePrice?: string | number;
  lastTradeQuantity?: number;
  lastUpdated: number;
}

interface OrderBookDetailedProps {
  marketId: string;
}

export default function OrderBookDetailed({ marketId }: OrderBookDetailedProps) {
  const { socket, isConnected } = useSocket();
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Connect to market updates via WebSocket
  useEffect(() => {
    if (!socket || !isConnected) return;
    
    console.log(`OrderBookDetailed: Connecting to market ${marketId}`);
    
    // Join this market's room
    socket.emit('join:market', marketId);
    
    // Listen for order book updates
    const handleOrderBookUpdate = (data: any) => {
      console.log(`OrderBookDetailed: Received update for market ${data.marketId}:`, data);
      
      if (data.marketId === marketId) {
        // Ensure we have bids and asks
        const updatedData = {
          ...data,
          bids: data.bids || [],
          asks: data.asks || []
        };
        
        setOrderBook(updatedData);
        setLoading(false);
      }
    };
    
    socket.on('orderbook:update', handleOrderBookUpdate);
    
    // Clean up
    return () => {
      socket.off('orderbook:update', handleOrderBookUpdate);
    };
  }, [socket, isConnected, marketId]);
  
  // Format price to 2 decimal places
  const formatPrice = (price: string | number) => {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return numPrice.toFixed(2);
  };
  
  // Format timestamp to readable time
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };
  
  // Calculate max quantity for visual scaling
  const getMaxQuantity = () => {
    if (!orderBook) return 1;
    
    const bidMax = Math.max(...orderBook.bids.map(level => level.quantity), 1);
    const askMax = Math.max(...orderBook.asks.map(level => level.quantity), 1);
    
    return Math.max(bidMax, askMax);
  };
  
  const maxQuantity = getMaxQuantity();
  
  // Calculate depth visualization width
  const getDepthWidth = (quantity: number) => {
    return `${(quantity / maxQuantity) * 100}%`;
  };
  
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex justify-center items-center h-60">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }
  
  if (!orderBook) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="text-center text-gray-500 py-10">
          No order book data available
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h3 className="text-lg font-semibold mb-2">Order Book</h3>
      
      {/* Last price display */}
      <div className="mb-4 text-center">
        <div className="text-sm text-gray-500">Last Price</div>
        <div className="text-2xl font-bold">
          {formatPrice(orderBook.lastPrice)}
        </div>
        <div className="text-xs text-gray-500">
          Updated: {formatTime(orderBook.lastUpdated)}
        </div>
      </div>
      
      {/* Order book display */}
      <div className="grid grid-cols-1 gap-0">
        {/* Asks (Sell Orders) */}
        <div className="mb-1">
          <div className="grid grid-cols-3 text-xs font-medium text-gray-500 mb-1">
            <div>Price</div>
            <div className="text-right">Quantity</div>
            <div className="text-right">Total</div>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {orderBook.asks.length > 0 ? (
              [...orderBook.asks].reverse().map((ask, idx) => {
                const price = typeof ask.price === 'string' ? parseFloat(ask.price) : ask.price;
                return (
                  <div key={`ask-${idx}`} className="grid grid-cols-3 text-sm py-1 relative">
                    <div className="text-red-600 font-medium z-10">{formatPrice(ask.price)}</div>
                    <div className="text-right z-10">{ask.quantity}</div>
                    <div className="text-right z-10">{(price * ask.quantity).toFixed(2)}</div>
                    <div className="absolute right-0 top-0 h-full">
                      <div 
                        className="h-full bg-red-50"
                        style={{ width: getDepthWidth(ask.quantity) }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-gray-500 py-2 text-center">No sell orders</div>
            )}
          </div>
        </div>
        
        {/* Spread indicator */}
        <div className="py-2 px-4 bg-gray-100 text-center text-sm font-medium my-1">
          {orderBook.lastPrice ? formatPrice(orderBook.lastPrice) : 'N/A'}
        </div>
        
        {/* Bids (Buy Orders) */}
        <div className="mt-1">
          <div className="grid grid-cols-3 text-xs font-medium text-gray-500 mb-1">
            <div>Price</div>
            <div className="text-right">Quantity</div>
            <div className="text-right">Total</div>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {orderBook.bids.length > 0 ? (
              orderBook.bids.map((bid, idx) => {
                const price = typeof bid.price === 'string' ? parseFloat(bid.price) : bid.price;
                return (
                  <div key={`bid-${idx}`} className="grid grid-cols-3 text-sm py-1 relative">
                    <div className="text-green-600 font-medium z-10">{formatPrice(bid.price)}</div>
                    <div className="text-right z-10">{bid.quantity}</div>
                    <div className="text-right z-10">{(price * bid.quantity).toFixed(2)}</div>
                    <div className="absolute right-0 top-0 h-full">
                      <div 
                        className="h-full bg-green-50"
                        style={{ width: getDepthWidth(bid.quantity) }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-gray-500 py-2 text-center">No buy orders</div>
            )}
          </div>
        </div>
      </div>
      
      {/* Order book summary */}
      <div className="mt-4 pt-3 border-t">
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
          <div>
            <span>Best bid:</span>
            <span className="ml-1 font-medium text-green-600">
              {orderBook.bids.length > 0 ? formatPrice(orderBook.bids[0].price) : 'N/A'}
            </span>
          </div>
          <div>
            <span>Best ask:</span>
            <span className="ml-1 font-medium text-red-600">
              {orderBook.asks.length > 0 ? formatPrice(orderBook.asks[0].price) : 'N/A'}
            </span>
          </div>
          <div>
            <span>Bid volume:</span>
            <span className="ml-1 font-medium">
              {orderBook.bids.reduce((sum, level) => sum + level.quantity, 0)}
            </span>
          </div>
          <div>
            <span>Ask volume:</span>
            <span className="ml-1 font-medium">
              {orderBook.asks.reduce((sum, level) => sum + level.quantity, 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
} 