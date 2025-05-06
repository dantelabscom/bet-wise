'use client';

import React, { useState, useEffect } from 'react';
import { useSocket } from '@/lib/hooks/useSocket';

interface OrderBookLevel {
  price: number;
  quantity: number;
}

interface OrderBookData {
  marketId: string;
  yes: OrderBookLevel[];
  no: OrderBookLevel[];
  lastPrice: number;
  lastUpdated: number;
}

interface OrderBookDetailedProps {
  marketId: string;
}

export default function OrderBookDetailed({ marketId }: OrderBookDetailedProps) {
  const { socket, isConnected } = useSocket();
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  const [selectedSide, setSelectedSide] = useState<'yes' | 'no'>('yes');
  const [loading, setLoading] = useState(true);
  
  // Connect to market updates via WebSocket
  useEffect(() => {
    if (!socket || !isConnected) return;
    
    // Join this market's room
    socket.emit('join:market', marketId);
    
    // Listen for order book updates
    const handleOrderBookUpdate = (data: OrderBookData) => {
      if (data.marketId === marketId) {
        setOrderBook(data);
        setLoading(false);
      }
    };
    
    socket.on('orderbook:update', handleOrderBookUpdate);
    
    // Clean up
    return () => {
      socket.off('orderbook:update', handleOrderBookUpdate);
    };
  }, [socket, isConnected, marketId]);
  
  // Calculate maximum quantity for scaling
  const getMaxQuantity = () => {
    if (!orderBook) return 1;
    
    const yesMax = Math.max(...orderBook.yes.map(level => level.quantity), 1);
    const noMax = Math.max(...orderBook.no.map(level => level.quantity), 1);
    
    return Math.max(yesMax, noMax);
  };
  
  const maxQuantity = getMaxQuantity();
  
  // Calculate depth visualization width
  const getDepthWidth = (quantity: number) => {
    return `${(quantity / maxQuantity) * 100}%`;
  };
  
  // Format price to 2 decimal places
  const formatPrice = (price: number) => {
    return price.toFixed(2);
  };
  
  // Format timestamp to readable time
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };
  
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Order Book</h3>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Order Book</h3>
        <div className="flex rounded-md overflow-hidden">
          <button
            onClick={() => setSelectedSide('yes')}
            className={`px-3 py-1 text-sm ${
              selectedSide === 'yes'
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
            }`}
          >
            YES
          </button>
          <button
            onClick={() => setSelectedSide('no')}
            className={`px-3 py-1 text-sm ${
              selectedSide === 'no'
                ? 'bg-red-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
            }`}
          >
            NO
          </button>
        </div>
      </div>
      
      {/* Last price display */}
      {orderBook && (
        <div className="mb-4 text-center">
          <div className="text-sm text-gray-500 dark:text-gray-400">Last Price</div>
          <div className="text-2xl font-bold">{formatPrice(orderBook.lastPrice)}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Updated: {formatTime(orderBook.lastUpdated)}
          </div>
        </div>
      )}
      
      {/* Order book table */}
      <div className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
              <th className="py-2 text-left">Price</th>
              <th className="py-2 text-right">Quantity</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {orderBook && selectedSide === 'yes' && orderBook.yes.map((level, idx) => (
              <tr key={`yes-${idx}`} className="border-b dark:border-gray-700 relative">
                <td className="py-2 text-green-600 dark:text-green-400 font-medium">
                  {formatPrice(level.price)}
                </td>
                <td className="py-2 text-right">{level.quantity}</td>
                <td className="py-2 text-right">{(level.price * level.quantity).toFixed(2)}</td>
                <td className="absolute left-0 top-0 h-full z-0">
                  <div 
                    className="h-full bg-green-100 dark:bg-green-900 opacity-20"
                    style={{ width: getDepthWidth(level.quantity) }}
                  />
                </td>
              </tr>
            ))}
            
            {orderBook && selectedSide === 'no' && orderBook.no.map((level, idx) => (
              <tr key={`no-${idx}`} className="border-b dark:border-gray-700 relative">
                <td className="py-2 text-red-600 dark:text-red-400 font-medium">
                  {formatPrice(level.price)}
                </td>
                <td className="py-2 text-right">{level.quantity}</td>
                <td className="py-2 text-right">{(level.price * level.quantity).toFixed(2)}</td>
                <td className="absolute left-0 top-0 h-full z-0">
                  <div 
                    className="h-full bg-red-100 dark:bg-red-900 opacity-20"
                    style={{ width: getDepthWidth(level.quantity) }}
                  />
                </td>
              </tr>
            ))}
            
            {(!orderBook || 
              (selectedSide === 'yes' && orderBook.yes.length === 0) || 
              (selectedSide === 'no' && orderBook.no.length === 0)) && (
              <tr>
                <td colSpan={3} className="py-8 text-center text-gray-500 dark:text-gray-400">
                  No orders available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Market summary */}
      {orderBook && (
        <div className="mt-4 pt-4 border-t dark:border-gray-700">
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400">
            <div>
              <span>Best YES price:</span>
              <span className="ml-1 font-medium text-green-600 dark:text-green-400">
                {orderBook.yes.length > 0 ? formatPrice(orderBook.yes[0].price) : 'N/A'}
              </span>
            </div>
            <div>
              <span>Best NO price:</span>
              <span className="ml-1 font-medium text-red-600 dark:text-red-400">
                {orderBook.no.length > 0 ? formatPrice(orderBook.no[0].price) : 'N/A'}
              </span>
            </div>
            <div>
              <span>YES volume:</span>
              <span className="ml-1 font-medium">
                {orderBook.yes.reduce((sum, level) => sum + level.quantity, 0)}
              </span>
            </div>
            <div>
              <span>NO volume:</span>
              <span className="ml-1 font-medium">
                {orderBook.no.reduce((sum, level) => sum + level.quantity, 0)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 