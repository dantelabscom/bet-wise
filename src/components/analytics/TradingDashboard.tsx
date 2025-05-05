import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { OddsCalculator } from '@/lib/models/odds-calculator';

// Dashboard time range options
const TIME_RANGES = [
  { label: 'Today', value: '1d' },
  { label: 'Week', value: '1w' },
  { label: 'Month', value: '1m' },
  { label: '3 Months', value: '3m' },
  { label: 'Year', value: '1y' },
  { label: 'All', value: 'all' },
];

// Analytics metrics types
type MetricType = 'pnl' | 'volume' | 'win_rate' | 'roi' | 'sharp_ratio' | 'exposure';

// Dashboard visualization types
type ChartType = 'line' | 'area' | 'bar' | 'pie';

// Chart colors
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function TradingDashboard() {
  const { data: session } = useSession();
  const [timeRange, setTimeRange] = useState('1w');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dashboard data states
  const [pnlData, setPnlData] = useState<any[]>([]);
  const [volumeData, setVolumeData] = useState<any[]>([]);
  const [positionData, setPositionData] = useState<any[]>([]);
  const [marketSentimentData, setMarketSentimentData] = useState<any[]>([]);
  const [tradingMetrics, setTradingMetrics] = useState({
    totalPnL: 0,
    winRate: 0,
    roi: 0,
    sharpeRatio: 0,
    totalVolume: 0,
    openPositions: 0,
    maxDrawdown: 0,
  });
  
  // Risk metrics states
  const [currentExposure, setCurrentExposure] = useState(0);
  const [riskAllocation, setRiskAllocation] = useState<any[]>([]);
  const [kellyOptimal, setKellyOptimal] = useState(0);
  
  useEffect(() => {
    if (!session?.user?.id) return;
    
    const fetchDashboardData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch PnL data
        const pnlResponse = await fetch(`/api/analytics/pnl?timeRange=${timeRange}`);
        const pnlData = await pnlResponse.json();
        setPnlData(pnlData);
        
        // Fetch volume data
        const volumeResponse = await fetch(`/api/analytics/volume?timeRange=${timeRange}`);
        const volumeData = await volumeResponse.json();
        setVolumeData(volumeData);
        
        // Fetch position data
        const positionResponse = await fetch('/api/analytics/positions');
        const positionData = await positionResponse.json();
        setPositionData(positionData);
        
        // Fetch market sentiment data
        const sentimentResponse = await fetch('/api/analytics/market-sentiment');
        const sentimentData = await sentimentResponse.json();
        setMarketSentimentData(sentimentData);
        
        // Fetch trading metrics
        const metricsResponse = await fetch(`/api/analytics/metrics?timeRange=${timeRange}`);
        const metrics = await metricsResponse.json();
        setTradingMetrics(metrics);
        
        // Fetch risk metrics
        const riskResponse = await fetch('/api/analytics/risk');
        const riskData = await riskResponse.json();
        setCurrentExposure(riskData.currentExposure);
        setRiskAllocation(riskData.allocation);
        
        // Calculate optimal Kelly stake
        const kellyCalculation = calculateOptimalKelly(
          metrics.winRate / 100, 
          metrics.roi / 100
        );
        setKellyOptimal(kellyCalculation);
        
      } catch (err: any) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load analytics data');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchDashboardData();
  }, [session?.user?.id, timeRange]);
  
  // Calculate optimal Kelly Criterion stake
  const calculateOptimalKelly = (winRate: number, payoutRatio: number): number => {
    // Kelly formula: k* = (bp - q) / b where:
    // b = net odds received on the wager (payout ratio)
    // p = probability of winning
    // q = probability of losing (1 - p)
    const b = payoutRatio;
    const p = winRate;
    const q = 1 - p;
    
    const kelly = (b * p - q) / b;
    
    // Cap Kelly to prevent excessive risk
    return Math.max(0, Math.min(0.25, kelly));
  };
  
  // Format currency values
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };
  
  // Format percentage values
  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };
  
  if (isLoading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="text-gray-500">Loading analytics data...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Trading Analytics Dashboard</h2>
          
          <div className="mt-3 md:mt-0 flex space-x-2">
            {TIME_RANGES.map((range) => (
              <button
                key={range.value}
                className={`px-3 py-1 text-sm font-medium rounded-md ${
                  timeRange === range.value
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => setTimeRange(range.value)}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Key metrics cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-500">Total P&L</h3>
          <p className={`text-xl font-bold ${tradingMetrics.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(tradingMetrics.totalPnL)}
          </p>
        </div>
        
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-500">Win Rate</h3>
          <p className="text-xl font-bold text-gray-900">
            {formatPercent(tradingMetrics.winRate)}
          </p>
        </div>
        
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-500">ROI</h3>
          <p className={`text-xl font-bold ${tradingMetrics.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatPercent(tradingMetrics.roi)}
          </p>
        </div>
        
        <div className="bg-purple-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-500">Current Exposure</h3>
          <p className="text-xl font-bold text-gray-900">
            {formatCurrency(currentExposure)}
          </p>
        </div>
      </div>
      
      {/* P&L Chart */}
      <div className="p-6 border-t border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">P&L Performance</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={pnlData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip 
                formatter={(value: number) => [formatCurrency(value), 'P&L']}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="pnl" 
                name="Profit/Loss" 
                stroke="#0088FE" 
                fill="#0088FE"
                fillOpacity={0.3} 
              />
              <Area 
                type="monotone" 
                dataKey="cumulativePnl" 
                name="Cumulative P&L" 
                stroke="#00C49F" 
                fill="#00C49F"
                fillOpacity={0.3} 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Position Allocation Chart */}
      <div className="p-6 border-t border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Position Allocation</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={positionData}
                cx="50%"
                cy="50%"
                labelLine={true}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                nameKey="name"
                label={(entry) => `${entry.name}: ${formatPercent(entry.value)}`}
              >
                {positionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatPercent(value)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Trading Volume Chart */}
      <div className="p-6 border-t border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Trading Volume</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={volumeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip 
                formatter={(value: number) => [formatCurrency(value), 'Volume']}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Legend />
              <Bar dataKey="volume" name="Trade Volume" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Risk Management Section */}
      <div className="p-6 border-t border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Management</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Risk Allocation</h4>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskAllocation}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="exposure"
                    nameKey="category"
                  >
                    {riskAllocation.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Kelly Criterion</h4>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="mb-2 text-sm text-gray-600">
                Based on your historical performance, the optimal Kelly stake for your current trading is:
              </p>
              <div className="text-2xl font-bold text-blue-600 mb-2">
                {formatPercent(kellyOptimal * 100)}
              </div>
              <p className="text-xs text-gray-500">
                This suggests allocating {formatPercent(kellyOptimal * 100)} of your bankroll 
                per trade for optimal growth while managing risk.
              </p>
              
              <div className="mt-4">
                <div className="text-sm font-medium text-gray-700">Recommended position sizing:</div>
                <div className="flex justify-between mt-1 text-sm">
                  <span>Conservative (1/2 Kelly):</span>
                  <span className="font-medium">{formatPercent(kellyOptimal * 50)}</span>
                </div>
                <div className="flex justify-between mt-1 text-sm">
                  <span>Moderate (Full Kelly):</span>
                  <span className="font-medium">{formatPercent(kellyOptimal * 100)}</span>
                </div>
                <div className="flex justify-between mt-1 text-sm">
                  <span>Aggressive (1.5x Kelly):</span>
                  <span className="font-medium">{formatPercent(kellyOptimal * 150)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Market Sentiment Analysis */}
      <div className="p-6 border-t border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Sentiment Analysis</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Public vs. Sharp Money</h4>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={marketSentimentData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="market" type="category" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="publicMoney" name="Public Money %" fill="#8884d8" />
                  <Bar dataKey="sharpMoney" name="Sharp Money %" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Market Inefficiency Score</h4>
            <div className="space-y-4">
              {marketSentimentData.slice(0, 5).map((market, index) => (
                <div key={index} className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">{market.market}</span>
                    <span className={`text-sm font-medium ${
                      market.inefficiencyScore > 15 ? 'text-red-600' : 
                      market.inefficiencyScore > 10 ? 'text-yellow-600' : 
                      'text-green-600'
                    }`}>
                      Score: {market.inefficiencyScore}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full ${
                        market.inefficiencyScore > 15 ? 'bg-red-600' : 
                        market.inefficiencyScore > 10 ? 'bg-yellow-500' : 
                        'bg-green-600'
                      }`}
                      style={{ width: `${Math.min(market.inefficiencyScore * 2, 100)}%` }}
                    ></div>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {market.inefficiencyScore > 15 
                      ? 'High value opportunity'
                      : market.inefficiencyScore > 10
                        ? 'Potential opportunity'
                        : 'Efficient pricing'
                    }
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