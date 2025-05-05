'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import DashboardHeader from '@/components/dashboard/Header';
import { Market, MarketOption, getMarketStatusDisplay, calculateImpliedProbability, getMarketDescription, formatPrice } from '@/lib/models/market';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

// Chart data type definitions
interface ChartDataPoint {
  name: string;
  value: number;
}

interface PriceHistoryPoint {
  name: string;
  time: string;
  price: number;
}

export default function MarketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryPoint[]>([]);
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
  
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);
  
  useEffect(() => {
    const fetchMarket = async () => {
      if (!params.id) return;
      
      try {
        const response = await fetch(`/api/markets/${params.id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch market');
        }
        
        const data = await response.json();
        setMarket(data);
        
        // Prepare pie chart data
        if (data.options) {
          const chartData = data.options.map((option: MarketOption) => ({
            name: option.name,
            value: parseFloat((100 / parseFloat(option.currentPrice)).toFixed(2)), // Convert odds to probability %
          }));
          setChartData(chartData);
          
          // Prepare price history chart data (mock data for now, would be fetched in a real app)
          const now = new Date();
          const mockPriceHistory = data.options.flatMap((option: MarketOption) => {
            return Array.from({ length: 10 }, (_, i) => {
              const time = new Date(now.getTime() - (9 - i) * 3600000); // Last 10 hours
              return {
                name: option.name,
                time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                price: parseFloat(option.currentPrice) + (Math.random() * 0.4 - 0.2),
              };
            });
          });
          setPriceHistory(mockPriceHistory);
        }
      } catch (error) {
        console.error('Error fetching market:', error);
        toast.error('Failed to load market data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchMarket();
  }, [params.id]);
  
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
  
  if (!market) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col justify-center items-center min-h-[60vh]">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Market Not Found</h2>
            <p className="text-gray-600 mb-6">The market you're looking for doesn't exist or has been removed.</p>
            <Link href="/markets" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Back to Markets
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  // Get market metadata based on type
  const getMarketMetadata = () => {
    if (!market.metadata) return null;
    
    switch (market.type) {
      case 'over_under':
        return (
          <div className="mt-2 text-sm text-gray-600">
            <span className="font-medium">Line:</span> {market.metadata.line} {market.metadata.unit || 'points'}
          </div>
        );
      case 'spread':
        return (
          <div className="mt-2 text-sm text-gray-600">
            <span className="font-medium">Spread:</span> {market.metadata.spread} points
            <br />
            <span className="font-medium">Favorite:</span> {market.metadata.favorite === 'home' ? market.event?.homeTeam : market.event?.awayTeam}
          </div>
        );
      case 'prop':
        return (
          <div className="mt-2 text-sm text-gray-600">
            <span className="font-medium">Prop Type:</span> {market.metadata.propType?.replace('_', ' ')}
            {market.metadata.player && (
              <div><span className="font-medium">Player:</span> {market.metadata.player}</div>
            )}
            {market.metadata.team && (
              <div><span className="font-medium">Team:</span> {market.metadata.team}</div>
            )}
          </div>
        );
      case 'handicap':
        return (
          <div className="mt-2 text-sm text-gray-600">
            <span className="font-medium">Handicap:</span> {market.metadata.handicap}
            <br />
            <span className="font-medium">Team:</span> {market.metadata.team === 'home' ? market.event?.homeTeam : market.event?.awayTeam}
          </div>
        );
      default:
        return null;
    }
  };
  
  const getOptionMetadata = (option: MarketOption) => {
    if (!option.metadata) return null;
    
    switch (market.type) {
      case 'over_under':
        return option.metadata.type === 'over' ? 'Over' : 'Under';
      case 'spread':
        return option.metadata.type === 'favorite' ? 'Cover' : 'Not Cover';
      default:
        return null;
    }
  };
  
  // Calculate market fairness percentage
  const getFairnessPercentage = () => {
    if (!market.options || market.options.length === 0) return 100;
    
    const totalImpliedProbability = market.options.reduce((sum, option) => {
      return sum + calculateImpliedProbability(parseFloat(option.currentPrice));
    }, 0);
    
    // Return market fairness (100% = perfectly fair, < 100% = house edge)
    return (100 / (totalImpliedProbability * 100)).toFixed(2);
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {/* Market Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">{market.name}</h1>
                <p className="text-gray-600 mb-2">{market.description || getMarketDescription(market)}</p>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <div className="flex items-center">
                    <span className="font-medium">Event:</span>
                    <span className="ml-1">{market.event?.name}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium">Type:</span>
                    <span className="ml-1 capitalize">{market.type.replace('_', ' ')}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium">Status:</span>
                    <span className={`ml-1 ${market.status === 'open' ? 'text-green-600' : 'text-amber-600'}`}>
                      {getMarketStatusDisplay(market.status)}
                    </span>
                  </div>
                </div>
                {market.event?.homeTeam && market.event?.awayTeam && (
                  <div className="mt-2 text-sm text-gray-600">
                    <span className="font-medium">Teams:</span> {market.event.homeTeam} vs {market.event.awayTeam}
                  </div>
                )}
                {getMarketMetadata()}
                <div className="mt-2 text-sm text-gray-600">
                  <span className="font-medium">Trading Volume:</span> ${parseInt(market.tradingVolume).toLocaleString()}
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  <span className="font-medium">Market Fairness:</span> {getFairnessPercentage()}%
                </div>
              </div>
              
              <div className="flex">
                <Link
                  href={`/markets/${market.id}/trade`}
                  className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 ${
                    market.status !== 'open' ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  onClick={(e) => {
                    if (market.status !== 'open') {
                      e.preventDefault();
                      toast.error('This market is not available for trading');
                    }
                  }}
                >
                  Trade
                </Link>
              </div>
            </div>
          </div>
          
          {/* Charts Section */}
          <div className="grid md:grid-cols-2 gap-6 p-6 border-b border-gray-200">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Implied Probabilities</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      fill="#8884d8"
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }: { name: string; value: number }) => `${name}: ${value.toFixed(1)}%`}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `${value}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Price History</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={priceHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis domain={['auto', 'auto']} />
                    <Tooltip />
                    <Legend />
                    {market.options?.map((option, index) => (
                      <Line
                        key={option.id}
                        type="monotone"
                        dataKey="price"
                        data={priceHistory.filter(item => item.name === option.name)}
                        name={option.name}
                        stroke={COLORS[index % COLORS.length]}
                        activeDot={{ r: 8 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          
          {/* Market Options */}
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Options</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {market.options?.map((option) => (
                <div key={option.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-blue-300 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900">{option.name}</h3>
                      {getOptionMetadata(option) && (
                        <div className="text-sm text-gray-600">{getOptionMetadata(option)}</div>
                      )}
                      <div className="text-sm text-gray-500 mt-1">
                        Implied probability: {(100 / parseFloat(option.currentPrice)).toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-xl font-bold text-blue-600">
                      {formatPrice(option.currentPrice)}
                    </div>
                  </div>
                  
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link 
                      href={`/markets/${market.id}/trade?option=${option.id}&side=buy`}
                      className="px-3 py-1.5 bg-green-100 text-green-800 rounded text-center text-sm font-medium hover:bg-green-200"
                    >
                      Buy
                    </Link>
                    <Link 
                      href={`/markets/${market.id}/trade?option=${option.id}&side=sell`}
                      className="px-3 py-1.5 bg-red-100 text-red-800 rounded text-center text-sm font-medium hover:bg-red-200"
                    >
                      Sell
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 