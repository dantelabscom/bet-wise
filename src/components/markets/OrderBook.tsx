import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { OrderBook as OrderBookType, OrderBookEntry } from '@/lib/models/order';

interface OrderBookProps {
  marketId: number;
  marketOptionId: number;
  optionName: string;
  currentPrice: string;
  onPlaceOrder?: (price: string) => void;
}

export default function OrderBook({ 
  marketId, 
  marketOptionId, 
  optionName, 
  currentPrice,
  onPlaceOrder 
}: OrderBookProps) {
  const { data: session } = useSession();
  const [orderBook, setOrderBook] = useState<OrderBookType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch order book data
  const fetchOrderBook = async () => {
    if (!session) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/markets/${marketId}/orderbook?optionId=${marketOptionId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch order book');
      }
      
      const data = await response.json();
      setOrderBook(data);
    } catch (err) {
      console.error('Error fetching order book:', err);
      setError('Failed to load order book');
      toast.error('Failed to load order book');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch on initial load and every 10 seconds
  useEffect(() => {
    fetchOrderBook();
    
    const interval = setInterval(() => {
      fetchOrderBook();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [marketId, marketOptionId, session]);
  
  const handlePriceClick = (price: string) => {
    if (onPlaceOrder) {
      onPlaceOrder(price);
    }
  };
  
  if (loading && !orderBook) {
    return (
      <div className="rounded-lg bg-white p-4 shadow-md">
        <div className="mb-2 text-lg font-semibold text-gray-900">Order Book</div>
        <div className="flex h-40 items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="rounded-lg bg-white p-4 shadow-md">
        <div className="mb-2 text-lg font-semibold text-gray-900">Order Book</div>
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
      <div className="mb-2 text-lg font-semibold text-gray-900">
        Order Book: {optionName}
      </div>
      
      <div className="mb-4 flex justify-between items-center text-sm">
        <span className="text-gray-500">Current Price: <span className="font-medium text-blue-600">{currentPrice}</span></span>
        {orderBook?.lastTradePrice && (
          <span className="text-gray-500">
            Last Trade: <span className="font-medium">{orderBook.lastTradePrice}</span>
            <span className="ml-1 text-xs text-gray-400">
              ({orderBook.lastTradeQuantity}) {orderBook.lastTradeTime && new Date(orderBook.lastTradeTime).toLocaleTimeString()}
            </span>
          </span>
        )}
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
                  onClick={() => handlePriceClick(ask.price)}
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
          {currentPrice}
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
                  onClick={() => handlePriceClick(bid.price)}
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
      
      <div className="mt-4 text-xs text-gray-500 text-right">
        Click on a price to place an order
      </div>
    </div>
  );
} 