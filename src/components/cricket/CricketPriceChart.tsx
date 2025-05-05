"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface PricePoint {
  price: number;
  timestamp: string;
  probability: number;
}

interface CricketPriceChartProps {
  marketId: number;
  marketOptionId: number;
  optionName: string;
  currentPrice: string;
  timeRange?: '1h' | '3h' | '6h' | '12h' | '24h' | 'all';
}

export default function CricketPriceChart({
  marketId,
  marketOptionId,
  optionName,
  currentPrice,
  timeRange = '1h',
}: CricketPriceChartProps) {
  const { data: session } = useSession();
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '3h' | '6h' | '12h' | '24h' | 'all'>(timeRange);
  const [showProbability, setShowProbability] = useState(false);
  
  // Fetch price history data
  const fetchPriceHistory = async () => {
    if (!session) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(
        `/api/markets/${marketId}/price-history?optionId=${marketOptionId}&timeRange=${selectedTimeRange}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch price history');
      }
      
      const data = await response.json();
      
      // Transform data for the chart
      const chartData = data.map((point: any) => ({
        price: parseFloat(point.price),
        timestamp: new Date(point.timestamp).toISOString(),
        // Calculate implied probability from price
        probability: (1 / parseFloat(point.price)) * 100,
      }));
      
      setPriceHistory(chartData);
    } catch (err) {
      console.error('Error fetching price history:', err);
      setError('Failed to load price history');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch on initial load and when time range changes
  useEffect(() => {
    fetchPriceHistory();
  }, [marketId, marketOptionId, selectedTimeRange, session]);
  
  // Format the X-axis tick values (timestamps)
  const formatXAxis = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Format tooltip values
  const formatTooltip = (value: number, name: string) => {
    if (name === 'price') {
      return [value.toFixed(2), 'Price'];
    }
    if (name === 'probability') {
      return [`${value.toFixed(1)}%`, 'Probability'];
    }
    return [value, name];
  };
  
  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const date = new Date(label);
      return (
        <div className="bg-white p-2 border border-gray-200 shadow-sm text-xs">
          <p className="font-medium">{date.toLocaleString()}</p>
          <p className="text-blue-600">Price: {payload[0].value.toFixed(2)}</p>
          <p className="text-green-600">Probability: {((1 / payload[0].value) * 100).toFixed(1)}%</p>
        </div>
      );
    }
    return null;
  };
  
  if (loading && priceHistory.length === 0) {
    return (
      <div className="rounded-lg bg-white p-4 shadow-md">
        <div className="mb-2 text-lg font-semibold text-gray-900">Price History</div>
        <div className="flex h-64 items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="rounded-lg bg-white p-4 shadow-md">
        <div className="mb-2 text-lg font-semibold text-gray-900">Price History</div>
        <div className="text-red-500">{error}</div>
        <button 
          onClick={fetchPriceHistory}
          className="mt-2 rounded bg-blue-500 px-3 py-1 text-white hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }
  
  return (
    <div className="rounded-lg bg-white p-4 shadow-md">
      <div className="mb-4 flex justify-between items-center">
        <div className="text-lg font-semibold text-gray-900">
          {optionName} Price Chart
        </div>
        <div className="flex items-center">
          <div className="text-sm mr-4">
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                className="form-checkbox h-4 w-4 text-blue-600"
                checked={showProbability}
                onChange={() => setShowProbability(!showProbability)}
              />
              <span className="ml-2 text-gray-700">Show Probability</span>
            </label>
          </div>
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value as any)}
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
          >
            <option value="1h">Last Hour</option>
            <option value="3h">Last 3 Hours</option>
            <option value="6h">Last 6 Hours</option>
            <option value="12h">Last 12 Hours</option>
            <option value="24h">Last 24 Hours</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>
      
      <div className="h-64">
        {priceHistory.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={priceHistory}
              margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={formatXAxis} 
                minTickGap={50}
              />
              <YAxis 
                yAxisId="left"
                domain={['auto', 'auto']}
                tickFormatter={(value) => value.toFixed(2)}
              />
              {showProbability && (
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
              )}
              <Tooltip content={<CustomTooltip />} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="price"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
                name="price"
              />
              {showProbability && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="probability"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5 }}
                  name="probability"
                />
              )}
              <ReferenceLine
                y={parseFloat(currentPrice)}
                stroke="red"
                strokeDasharray="3 3"
                label="Current"
                yAxisId="left"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-gray-500">
            No price history available for this period
          </div>
        )}
      </div>
      
      <div className="mt-4 text-xs text-gray-500 text-right">
        Last updated: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
} 