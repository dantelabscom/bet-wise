/**
 * Order Entry component for placing Yes/No trades on cricket markets
 */
'use client';

import React, { useState, useEffect } from 'react';
import { useSocket } from '@/lib/hooks/useSocket';
import { useSession } from 'next-auth/react';

interface OrderBookLevel {
  price: number | string;
  quantity: number;
  orders?: number;
}

interface OrderBook {
  yes?: OrderBookLevel[];
  no?: OrderBookLevel[];
  bids?: OrderBookLevel[];
  asks?: OrderBookLevel[];
  lastPrice: number | string;
  lastTradePrice?: number | string;
  lastTradeQuantity?: number;
  lastUpdated?: number;
  marketId?: string;
}

interface OrderEntryProps {
  matchId: string;
  marketId: string;
  marketName: string;
}

export default function OrderEntry({ matchId, marketId, marketName }: OrderEntryProps) {
  const { data: session } = useSession();
  const { socket, isConnected } = useSocket();
  
  // Order state
  const [side, setSide] = useState<'yes' | 'no'>('yes');
  const [price, setPrice] = useState<number>(0.5);
  const [quantity, setQuantity] = useState<number>(10);
  const [wallet, setWallet] = useState<number>(1000); // Mock wallet balance
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  
  // Market order book data (from WebSocket)
  const [orderBook, setOrderBook] = useState<OrderBook>({
    yes: [],
    no: [],
    bids: [],
    asks: [],
    lastPrice: 0.5
  });
  
  // Connect to market updates via WebSocket
  useEffect(() => {
    if (!socket || !isConnected || !marketId) return;
    
    console.log(`OrderEntry connecting to market ${marketId} via WebSocket`);
    
    // Join this market's room
    socket.emit('join:market', marketId);
    
    // Listen for order book updates
    socket.on('orderbook:update', (data: OrderBook) => {
      console.log(`OrderEntry received orderbook update for market ${data.marketId}:`, data);
      
      if (data.marketId === marketId) {
        // Transform data if needed - convert bids/asks to yes/no if yes/no is missing
        const transformedData = { ...data };
        
        if (data.bids && data.asks && (!data.yes || !data.no)) {
          console.log('Converting bids/asks to yes/no format');
          transformedData.yes = data.bids.map((bid: OrderBookLevel) => ({
            price: typeof bid.price === 'string' ? parseFloat(bid.price) : bid.price,
            quantity: bid.quantity,
            orders: bid.orders
          }));
          
          transformedData.no = data.asks.map((ask: OrderBookLevel) => ({
            price: typeof ask.price === 'string' ? parseFloat(ask.price) : ask.price,
            quantity: ask.quantity,
            orders: ask.orders
          }));
        }
        
        setOrderBook(transformedData);
        
        // Update price if needed based on best bid/ask
        if (side === 'yes' && transformedData.yes && transformedData.yes.length > 0) {
          setPrice(typeof transformedData.yes[0].price === 'string' 
            ? parseFloat(transformedData.yes[0].price) 
            : transformedData.yes[0].price);
        } else if (side === 'no' && transformedData.no && transformedData.no.length > 0) {
          setPrice(typeof transformedData.no[0].price === 'string' 
            ? parseFloat(transformedData.no[0].price) 
            : transformedData.no[0].price);
        }
      }
    });
    
    // Listen for price updates
    socket.on('price:update', (data: any) => {
      console.log(`OrderEntry received price update for market ${data.marketId}:`, data);
      
      if (data.marketId === marketId && data.lastPrice) {
        // Update order book last price
        setOrderBook((prev: OrderBook) => ({
          ...prev,
          lastPrice: typeof data.lastPrice === 'string' ? parseFloat(data.lastPrice) : data.lastPrice
        }));
        
        // Update form price
        if (side === 'yes') {
          setPrice(data.bestYesPrice || data.lastPrice || 0.5);
        } else {
          setPrice(data.bestNoPrice || (1 - (data.lastPrice || 0.5)));
        }
      }
    });
    
    // Listen for errors
    socket.on('error', (error: any) => {
      setError(error.message || 'An error occurred');
      setSubmitting(false);
    });
    
    // Clean up
    return () => {
      socket.off('orderbook:update', () => {});
      socket.off('price:update', () => {});
      socket.off('error', () => {});
    };
  }, [socket, isConnected, marketId, side]);
  
  // Handle order submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!session?.user) {
      setError('You must be logged in to place orders');
      return;
    }
    
    // Validate inputs
    if (price <= 0 || price >= 1) {
      setError('Price must be between 0 and 1');
      return;
    }
    
    if (quantity <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }
    
    // Calculate risk (potential loss)
    const risk = side === 'yes' 
      ? quantity * price 
      : quantity * (1 - price);
    
    if (risk > wallet) {
      setError('Insufficient funds in wallet');
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      // Send order via WebSocket
      if (socket && isConnected) {
        socket.emit('place:order', {
          marketId,
          side,
          price,
          quantity,
          userId: session.user.id
        });
        
        // Show success message
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        
        // Reset form
        setQuantity(10);
        
        // Update mock wallet (in a real app, this would be done by the server)
        setWallet(prev => prev - risk);
      } else {
        setError('Socket connection not available');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Extract yes/no data safely, handling both formats
  const yesData = orderBook.yes || [];
  const noData = orderBook.no || [];
  
  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">{marketName}</h3>
      
      {/* Order book display */}
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
          <h4 className="text-sm font-medium text-green-600 dark:text-green-400 mb-2">YES</h4>
          <div className="space-y-1">
            {yesData.length > 0 ? (
              yesData.map((level: any, idx: number) => (
                <div key={`yes-${idx}`} className="text-sm grid grid-cols-2">
                  <span>{typeof level.price === 'number' ? level.price.toFixed(2) : level.price}</span>
                  <span className="text-right">{level.quantity}</span>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500">No orders</div>
            )}
          </div>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
          <h4 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">NO</h4>
          <div className="space-y-1">
            {noData.length > 0 ? (
              noData.map((level: any, idx: number) => (
                <div key={`no-${idx}`} className="text-sm grid grid-cols-2">
                  <span>{typeof level.price === 'number' ? level.price.toFixed(2) : level.price}</span>
                  <span className="text-right">{level.quantity}</span>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500">No orders</div>
            )}
          </div>
        </div>
      </div>
      
      {/* Last price display */}
      <div className="mb-4 text-center">
        <span className="text-sm text-gray-500">Last Price:</span>
        <span className="ml-2 font-semibold">
          {typeof orderBook.lastPrice === 'number' 
            ? orderBook.lastPrice.toFixed(2) 
            : orderBook.lastPrice || '0.50'}
        </span>
      </div>
      
      {/* Order entry form */}
      <form onSubmit={handleSubmit}>
        {/* Side selection */}
        <div className="mb-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`py-2 px-4 rounded-md ${
                side === 'yes' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
              }`}
              onClick={() => setSide('yes')}
            >
              YES
            </button>
            <button
              type="button"
              className={`py-2 px-4 rounded-md ${
                side === 'no' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
              }`}
              onClick={() => setSide('no')}
            >
              NO
            </button>
          </div>
        </div>
        
        {/* Price input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Price (0-1)
          </label>
          <input
            type="number"
            min="0.01"
            max="0.99"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(parseFloat(e.target.value))}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
            required
          />
        </div>
        
        {/* Quantity input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Quantity
          </label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value))}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
            required
          />
        </div>
        
        {/* Risk/reward calculation */}
        <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Max Risk:</span>
            <span className="ml-2 font-medium">
              ${(side === 'yes' ? quantity * price : quantity * (1 - price)).toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Max Reward:</span>
            <span className="ml-2 font-medium">
              ${(side === 'yes' ? quantity * (1 - price) : quantity * price).toFixed(2)}
            </span>
          </div>
        </div>
        
        {/* Error display */}
        {error && (
          <div className="mb-4 p-2 bg-red-100 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}
        
        {/* Success message */}
        {success && (
          <div className="mb-4 p-2 bg-green-100 text-green-700 rounded-md text-sm">
            Order placed successfully!
          </div>
        )}
        
        {/* Wallet display */}
        <div className="mb-4 text-sm">
          <span className="text-gray-500">Wallet Balance:</span>
          <span className="ml-2 font-medium">${wallet.toFixed(2)}</span>
        </div>
        
        {/* Submit button */}
        <button
          type="submit"
          disabled={submitting || !isConnected}
          className={`w-full py-2 px-4 rounded-md 
            ${submitting || !isConnected 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700'} 
            text-white font-medium`}
        >
          {submitting ? 'Placing Order...' : 'Place Order'}
        </button>
      </form>
    </div>
  );
} 