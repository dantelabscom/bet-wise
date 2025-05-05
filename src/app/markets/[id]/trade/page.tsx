'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import DashboardHeader from '@/components/dashboard/Header';
import toast from 'react-hot-toast';

interface MarketOption {
  id: number;
  name: string;
  currentPrice: string;
}

interface Market {
  id: number;
  name: string;
  status: string;
  event: {
    name: string;
  };
  sport: {
    name: string;
  };
  options: MarketOption[];
}

interface TradePageProps {
  params: {
    id: string;
  };
}

export default function TradePage({ params }: TradePageProps) {
  const marketId = params.id;
  const searchParams = useSearchParams();
  const optionId = searchParams.get('option');
  
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [market, setMarket] = useState<Market | null>(null);
  const [option, setOption] = useState<MarketOption | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('limit');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [total, setTotal] = useState(0);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [walletBalance, setWalletBalance] = useState('1000.00');

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  // Fetch market and option data
  useEffect(() => {
    const fetchData = async () => {
      if (status === 'authenticated') {
        try {
          // In a real implementation, we would fetch from the API
          // const marketResponse = await fetch(`/api/markets/${marketId}`);
          // const marketData = await marketResponse.json();
          
          // Mock data
          const mockMarket: Market = {
            id: Number(marketId),
            name: 'Super Bowl Winner 2025',
            status: 'open',
            event: {
              name: 'Super Bowl LIX',
            },
            sport: {
              name: 'Football',
            },
            options: [
              { id: 1, name: 'Kansas City Chiefs', currentPrice: '5.50' },
              { id: 2, name: 'San Francisco 49ers', currentPrice: '6.20' },
              { id: 3, name: 'Buffalo Bills', currentPrice: '9.00' },
              { id: 4, name: 'Baltimore Ravens', currentPrice: '10.00' },
              { id: 5, name: 'Detroit Lions', currentPrice: '12.00' },
              { id: 6, name: 'Dallas Cowboys', currentPrice: '15.00' },
            ],
          };
          
          setMarket(mockMarket);
          
          // Find the selected option
          const selectedOption = mockMarket.options.find(
            opt => opt.id === Number(optionId)
          );
          
          if (!selectedOption) {
            throw new Error('Option not found');
          }
          
          setOption(selectedOption);
          setPrice(selectedOption.currentPrice);
          
          // Fetch wallet balance
          // const walletResponse = await fetch('/api/wallet');
          // const walletData = await walletResponse.json();
          // setWalletBalance(walletData.balance);
          
        } catch (error) {
          console.error('Error fetching data:', error);
          toast.error('Failed to load trading data');
          router.push(`/markets/${marketId}`);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchData();
  }, [status, marketId, optionId, router]);

  // Calculate total cost/proceeds
  useEffect(() => {
    if (price && quantity) {
      const calculatedTotal = parseFloat(price) * parseFloat(quantity);
      setTotal(calculatedTotal);
    } else {
      setTotal(0);
    }
  }, [price, quantity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!option || !price || !quantity) {
      toast.error('Please fill in all fields');
      return;
    }
    
    if (isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      toast.error('Please enter a valid price');
      return;
    }
    
    if (isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }
    
    // Check if user has enough balance for buy order
    if (orderSide === 'buy' && parseFloat(walletBalance) < total) {
      toast.error('Insufficient balance to place this order');
      return;
    }
    
    setPlacingOrder(true);
    
    try {
      // In a real implementation, we would submit to the API
      // const response = await fetch('/api/orders', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     marketId: market?.id,
      //     marketOptionId: option.id,
      //     type: orderType,
      //     side: orderSide,
      //     price: parseFloat(price),
      //     quantity: parseFloat(quantity),
      //   }),
      // });
      
      // if (!response.ok) {
      //   throw new Error('Failed to place order');
      // }
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success(`Order placed successfully`);
      
      // Redirect to order history page
      router.push('/orders');
      
    } catch (error: any) {
      console.error('Error placing order:', error);
      toast.error(error.message || 'Failed to place order');
    } finally {
      setPlacingOrder(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Loading...</h2>
          <p className="text-gray-500">Please wait while we load trading data</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null; // Will redirect in the useEffect
  }

  if (!market || !option) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader user={session.user} />
        <div className="container mx-auto px-4 py-12 text-center">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">Trading Option Not Found</h1>
          <p className="text-gray-600">The trading option you selected does not exist or has been removed.</p>
          <Link 
            href={`/markets/${marketId}`} 
            className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Back to Market
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader user={session.user} />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link 
            href={`/markets/${marketId}`} 
            className="inline-flex items-center text-sm text-blue-600 hover:underline"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="mr-1 h-4 w-4" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Market
          </Link>
        </div>
        
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Trading Form */}
          <div className="md:col-span-2">
            <div className="rounded-lg bg-white p-6 shadow-md">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Place an Order</h1>
                <p className="text-gray-600">
                  {market.name} - {market.event.name}
                </p>
              </div>
              
              <div className="mb-6 rounded-md bg-blue-50 p-4">
                <div className="mb-1 text-sm text-gray-600">Selected Option</div>
                <div className="flex items-center justify-between">
                  <div className="font-medium">{option.name}</div>
                  <div className="text-lg font-semibold">{parseFloat(option.currentPrice).toFixed(2)}</div>
                </div>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Order Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Order Type
                  </label>
                  <div className="mt-2 flex space-x-2">
                    <button
                      type="button"
                      className={`rounded-md px-4 py-2 ${
                        orderType === 'limit'
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-300 text-gray-700'
                      }`}
                      onClick={() => setOrderType('limit')}
                    >
                      Limit Order
                    </button>
                    <button
                      type="button"
                      className={`rounded-md px-4 py-2 ${
                        orderType === 'market'
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-300 text-gray-700'
                      }`}
                      onClick={() => setOrderType('market')}
                    >
                      Market Order
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {orderType === 'limit'
                      ? 'Limit orders execute at your specified price or better.'
                      : 'Market orders execute immediately at the best available price.'}
                  </p>
                </div>
                
                {/* Buy/Sell Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Action
                  </label>
                  <div className="mt-2 flex space-x-2">
                    <button
                      type="button"
                      className={`rounded-md px-4 py-2 ${
                        orderSide === 'buy'
                          ? 'bg-green-600 text-white'
                          : 'border border-gray-300 text-gray-700'
                      }`}
                      onClick={() => setOrderSide('buy')}
                    >
                      Buy
                    </button>
                    <button
                      type="button"
                      className={`rounded-md px-4 py-2 ${
                        orderSide === 'sell'
                          ? 'bg-red-600 text-white'
                          : 'border border-gray-300 text-gray-700'
                      }`}
                      onClick={() => setOrderSide('sell')}
                    >
                      Sell
                    </button>
                  </div>
                </div>
                
                {/* Price Input */}
                <div>
                  <label htmlFor="price" className="block text-sm font-medium text-gray-700">
                    Price
                  </label>
                  <div className="relative mt-1 rounded-md shadow-sm">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <span className="text-gray-500">$</span>
                    </div>
                    <input
                      type="number"
                      name="price"
                      id="price"
                      className="block w-full rounded-md border-gray-300 pl-7 pr-12 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="0.00"
                      step="0.01"
                      min="0.01"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      disabled={orderType === 'market'}
                      required={orderType === 'limit'}
                    />
                  </div>
                </div>
                
                {/* Quantity Input */}
                <div>
                  <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">
                    Quantity
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    id="quantity"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Enter quantity"
                    min="0.01"
                    step="0.01"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    required
                  />
                </div>
                
                {/* Order Summary */}
                <div className="rounded-md bg-gray-50 p-4">
                  <h3 className="mb-2 font-medium">Order Summary</h3>
                  <div className="flex justify-between">
                    <span>Price per Unit:</span>
                    <span>${orderType === 'market' ? option.currentPrice : price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Quantity:</span>
                    <span>{quantity}</span>
                  </div>
                  <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 font-medium">
                    <span>Total {orderSide === 'buy' ? 'Cost' : 'Proceeds'}:</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>
                
                <button
                  type="submit"
                  disabled={placingOrder}
                  className={`w-full rounded-md px-4 py-2 text-white ${
                    orderSide === 'buy'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50`}
                >
                  {placingOrder
                    ? 'Processing...'
                    : `${orderSide === 'buy' ? 'Buy' : 'Sell'} ${option.name}`}
                </button>
              </form>
            </div>
          </div>
          
          {/* Wallet Info */}
          <div>
            <div className="sticky top-4 rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-4 text-lg font-semibold">Your Wallet</h2>
              
              <div className="mb-6">
                <div className="text-sm text-gray-600">Available Balance</div>
                <div className="text-2xl font-bold text-green-600">
                  ${parseFloat(walletBalance).toFixed(2)}
                </div>
              </div>
              
              {orderSide === 'buy' && (
                <div className={`rounded-md p-3 ${
                  parseFloat(walletBalance) >= total
                    ? 'bg-green-50 text-green-800'
                    : 'bg-red-50 text-red-800'
                }`}>
                  {parseFloat(walletBalance) >= total
                    ? 'You have sufficient balance for this order'
                    : 'Insufficient balance for this order'}
                </div>
              )}
              
              <div className="mt-4">
                <Link
                  href="/wallet"
                  className="block rounded-md border border-blue-600 px-4 py-2 text-center text-blue-600 hover:bg-blue-50"
                >
                  Manage Wallet
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 