'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import DashboardHeader from '@/components/dashboard/Header';
import OrderBook from '@/components/markets/OrderBook';
import OrderForm from '@/components/markets/OrderForm';
import { Market, MarketOption } from '@/lib/models/market';
import { Order } from '@/lib/models/order';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, 
  AreaChart, Area, BarChart, Bar
} from 'recharts';

// Chart time range options
const TIME_RANGES = [
  { label: '1H', value: '1h' },
  { label: '6H', value: '6h' },
  { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
  { label: '1M', value: '1m' },
  { label: 'ALL', value: 'all' },
];

// Chart types
type ChartType = 'line' | 'area' | 'candle' | 'bar';

interface PriceDataPoint {
  time: string;
  price: number;
  volume?: number;
  timestamp: number;
}

interface AdvancedTradeClientProps {
  marketId: string;
  initialOptionId?: string;
  initialSide?: 'buy' | 'sell';
}

export default function AdvancedTradeClient({ marketId, initialOptionId, initialSide }: AdvancedTradeClientProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [market, setMarket] = useState<Market | null>(null);
  const [selectedOption, setSelectedOption] = useState<MarketOption | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [priceData, setPriceData] = useState<PriceDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('1d');
  const [chartType, setChartType] = useState<ChartType>('area');
  const [riskAmount, setRiskAmount] = useState('10.00');
  const [positionSize, setPositionSize] = useState(0);
  const [stopPrice, setStopPrice] = useState('');
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
  
  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);
  
  // Fetch market data
  useEffect(() => {
    const fetchMarket = async () => {
      if (!marketId) return;
      
      try {
        const response = await fetch(`/api/markets/${marketId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch market');
        }
        
        const data = await response.json();
        setMarket(data);
        
        // Set selected option based on initialOptionId or default to first option
        if (data.options && data.options.length > 0) {
          if (initialOptionId) {
            const option = data.options.find((opt: MarketOption) => String(opt.id) === initialOptionId);
            if (option) {
              setSelectedOption(option);
            } else {
              setSelectedOption(data.options[0]);
            }
          } else {
            setSelectedOption(data.options[0]);
          }
        }
      } catch (error) {
        console.error('Error fetching market:', error);
        toast.error('Failed to load market data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchMarket();
  }, [marketId, initialOptionId]);
  
  // Fetch user's open orders for this market
  useEffect(() => {
    const fetchOrders = async () => {
      if (!marketId || status !== 'authenticated') return;
      
      try {
        const response = await fetch(`/api/orders?marketId=${marketId}&status=open`);
        if (!response.ok) {
          throw new Error('Failed to fetch orders');
        }
        
        const data = await response.json();
        setOrders(data.orders || []);
      } catch (error) {
        console.error('Error fetching orders:', error);
      }
    };
    
    fetchOrders();
  }, [marketId, status]);
  
  // Generate mock price data for the selected option
  useEffect(() => {
    if (!selectedOption) return;
    
    const now = new Date().getTime();
    let timeStep = 3600000; // 1 hour in ms
    let dataPoints = 24;
    
    switch (timeRange) {
      case '1h':
        timeStep = 60000; // 1 minute
        dataPoints = 60;
        break;
      case '6h':
        timeStep = 360000; // 6 minutes
        dataPoints = 60;
        break;
      case '1d':
        timeStep = 3600000; // 1 hour
        dataPoints = 24;
        break;
      case '1w':
        timeStep = 86400000 / 4; // 6 hours
        dataPoints = 28;
        break;
      case '1m':
        timeStep = 86400000; // 1 day
        dataPoints = 30;
        break;
      case 'all':
        timeStep = 86400000; // 1 day
        dataPoints = 60;
        break;
    }
    
    const basePrice = parseFloat(selectedOption.currentPrice);
    const volatility = 0.05; // 5% volatility for mock data
    
    const mockData: PriceDataPoint[] = Array.from({ length: dataPoints }, (_, i) => {
      // Generate a pseudo-random walk around the base price
      const timestamp = now - (dataPoints - i) * timeStep;
      const date = new Date(timestamp);
      const time = timeRange === '1h' || timeRange === '6h'
        ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      
      // Random walk with mean reversion
      const randomChange = (Math.random() - 0.5) * volatility * basePrice;
      const price = basePrice * (1 + 0.01 * Math.sin(i / 10) + randomChange / (dataPoints - i + 1));
      
      // Add some random volume
      const volume = Math.round(1000 + Math.random() * 5000);
      
      return {
        time,
        price: parseFloat(price.toFixed(2)),
        volume,
        timestamp
      };
    });
    
    setPriceData(mockData);
  }, [selectedOption, timeRange]);
  
  // Calculate position size based on risk and stop price
  useEffect(() => {
    if (!selectedOption || !stopPrice) {
      setPositionSize(0);
      return;
    }
    
    const currentPrice = parseFloat(selectedOption.currentPrice);
    const stopPriceValue = parseFloat(stopPrice);
    const riskAmountValue = parseFloat(riskAmount);
    
    if (isNaN(currentPrice) || isNaN(stopPriceValue) || isNaN(riskAmountValue) || stopPriceValue === currentPrice) {
      setPositionSize(0);
      return;
    }
    
    // Calculate position size: Risk amount / (Entry price - Stop price)
    const priceDiff = Math.abs(currentPrice - stopPriceValue);
    const calculatedPositionSize = riskAmountValue / priceDiff;
    
    setPositionSize(calculatedPositionSize);
  }, [selectedOption, stopPrice, riskAmount]);
  
  const handleOptionChange = (option: MarketOption) => {
    setSelectedOption(option);
  };
  
  const handleCancelOrder = async (orderId: number) => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to cancel order');
      }
      
      toast.success('Order cancelled successfully');
      
      // Update orders list
      setOrders(orders.filter(order => order.id !== orderId));
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast.error('Failed to cancel order');
    }
  };
  
  const handleOrderPlaced = () => {
    // Refresh orders after a new order is placed
    const fetchOrders = async () => {
      if (!marketId) return;
      
      try {
        const response = await fetch(`/api/orders?marketId=${marketId}&status=open`);
        if (!response.ok) {
          throw new Error('Failed to fetch orders');
        }
        
        const data = await response.json();
        setOrders(data.orders || []);
      } catch (error) {
        console.error('Error fetching orders:', error);
      }
    };
    
    fetchOrders();
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!market || !selectedOption) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="bg-white p-8 rounded-lg shadow-md text-center">
            <h1 className="text-2xl font-bold text-red-500 mb-4">Market Not Found</h1>
            <p className="text-gray-600 mb-6">The market you are looking for does not exist or is no longer available.</p>
            <Link href="/markets" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Browse Markets
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{market.name}</h1>
            <p className="text-gray-600">{market.description}</p>
          </div>
          <Link 
            href={`/markets/${market.id}`} 
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
          >
            Back to Market
          </Link>
        </div>
        
        {/* Trading Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main chart panel */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-md overflow-hidden">
            {/* Market option tabs */}
            <div className="border-b border-gray-200 bg-gray-50">
              <div className="flex overflow-x-auto">
                {market.options?.map((option) => (
                  <button
                    key={option.id}
                    className={`px-4 py-3 text-sm font-medium ${
                      selectedOption?.id === option.id 
                        ? 'bg-white text-blue-600 border-b-2 border-blue-500' 
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => handleOptionChange(option)}
                  >
                    {option.name}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Chart controls */}
            <div className="flex justify-between items-center px-4 py-2 border-b border-gray-200">
              <div className="flex space-x-1">
                {TIME_RANGES.map((range) => (
                  <button
                    key={range.value}
                    className={`px-3 py-1 text-xs font-medium rounded ${
                      timeRange === range.value 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                    onClick={() => setTimeRange(range.value)}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
              
              <div className="flex space-x-1">
                <button
                  className={`p-2 text-xs rounded ${
                    chartType === 'line' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                  onClick={() => setChartType('line')}
                >
                  Line
                </button>
                <button
                  className={`p-2 text-xs rounded ${
                    chartType === 'area' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                  onClick={() => setChartType('area')}
                >
                  Area
                </button>
                <button
                  className={`p-2 text-xs rounded ${
                    chartType === 'bar' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                  onClick={() => setChartType('bar')}
                >
                  Bar
                </button>
              </div>
            </div>
            
            {/* Price chart */}
            <div className="p-4 h-96">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'line' ? (
                  <LineChart data={priceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis domain={['auto', 'auto']} />
                    <Tooltip 
                      formatter={(value: any) => [`$${value}`, 'Price']}
                      labelFormatter={(label) => `Time: ${label}`}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="price" 
                      name={selectedOption.name} 
                      stroke="#0088FE" 
                      activeDot={{ r: 8 }} 
                    />
                  </LineChart>
                ) : chartType === 'area' ? (
                  <AreaChart data={priceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis domain={['auto', 'auto']} />
                    <Tooltip 
                      formatter={(value: any) => [`$${value}`, 'Price']}
                      labelFormatter={(label) => `Time: ${label}`}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="price"
                      name={selectedOption.name}
                      stroke="#0088FE"
                      fill="#0088FE"
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                ) : (
                  <BarChart data={priceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="volume" name="Volume" fill="#8884d8" />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
            
            {/* Order history */}
            <div className="p-4 border-t border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Open Orders</h2>
              {orders.length === 0 ? (
                <div className="text-gray-500 text-center py-4">
                  No open orders for this market
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Option
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Side
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Price
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quantity
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {orders.map((order) => (
                        <tr key={order.id}>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                            {order.marketOption?.name}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 capitalize">
                            {order.type}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              order.side === 'buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {order.side.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                            {order.type === 'market' ? 'Market' : `$${parseFloat(order.price).toFixed(2)}`}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                            {parseFloat(order.quantity).toFixed(2)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => handleCancelOrder(order.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Cancel
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
          
          {/* Order book and trading panel */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <OrderBook
                marketId={market.id}
                marketOptionId={selectedOption.id}
                optionName={selectedOption.name}
                currentPrice={selectedOption.currentPrice}
              />
            </div>
            
            <div className="bg-white rounded-lg shadow-md overflow-hidden p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Position Sizing Tool</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Risk Amount ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={riskAmount}
                    onChange={(e) => setRiskAmount(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stop Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={stopPrice}
                    onChange={(e) => setStopPrice(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Enter your stop price"
                  />
                </div>
                
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center text-sm mb-2">
                    <span className="text-gray-700">Current Price:</span>
                    <span className="font-medium">${selectedOption.currentPrice}</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm mb-2">
                    <span className="text-gray-700">Recommended Position Size:</span>
                    <span className="font-medium">{positionSize.toFixed(2)} shares</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm mb-4">
                    <span className="text-gray-700">Total Cost:</span>
                    <span className="font-medium">
                      ${(positionSize * parseFloat(selectedOption.currentPrice)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <OrderForm
              marketId={market.id}
              marketOptionId={selectedOption.id}
              optionName={selectedOption.name}
              currentPrice={selectedOption.currentPrice}
              initialSide={initialSide}
              onOrderPlaced={handleOrderPlaced}
            />
          </div>
        </div>
      </main>
    </div>
  );
} 