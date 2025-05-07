'use client';

import React, { useState, useEffect } from 'react';
import { useSocket } from '@/lib/hooks/useSocket';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  ChartOptions
} from 'chart.js';
import 'chartjs-adapter-date-fns';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

interface PriceChartProps {
  marketId: string;
  marketName: string;
}

// Price data point interface
interface PricePoint {
  timestamp: number;
  price: number;
}

export default function PriceChart({ marketId, marketName }: PriceChartProps) {
  const { socket, isConnected } = useSocket();
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [timeRange, setTimeRange] = useState<'5m' | '15m' | '1h' | 'all'>('15m');
  const [latestPrice, setLatestPrice] = useState<number>(0.5);
  const [loading, setLoading] = useState(true);
  
  // Initialize with a starting price point
  useEffect(() => {
    const now = Date.now();
    setPriceHistory([
      { timestamp: now - 1000 * 60 * 15, price: 0.5 }, // 15 minutes ago
    ]);
  }, [marketId]);
  
  // Listen for price updates via WebSocket
  useEffect(() => {
    if (!socket || !isConnected) return;
    
    console.log(`PriceChart: Connecting to market ${marketId}`);
    setLoading(true);
    
    // Join the market's room
    socket.emit('join:market', marketId);
    
    // Handler for price updates from both sources
    const handlePriceUpdate = (data: any) => {
      console.log(`PriceChart: Received update for market ${data.marketId}:`, data);
      
      if (data.marketId !== marketId) return;
      
      let newPrice: number | null = null;
      
      // Extract price from different data formats
      if (data.lastPrice) {
        // Direct price update
        newPrice = typeof data.lastPrice === 'string' 
          ? parseFloat(data.lastPrice) 
          : data.lastPrice;
      } else if (data.bids && data.bids.length > 0 && data.asks && data.asks.length > 0) {
        // Calculate midpoint from orderbook
        const bestBid = typeof data.bids[0].price === 'string' 
          ? parseFloat(data.bids[0].price) 
          : data.bids[0].price;
          
        const bestAsk = typeof data.asks[0].price === 'string' 
          ? parseFloat(data.asks[0].price) 
          : data.asks[0].price;
          
        newPrice = (bestBid + bestAsk) / 2;
      }
      
      if (newPrice !== null) {
        console.log(`PriceChart: Adding price point: ${newPrice}`);
        setLatestPrice(newPrice);
        
        const timestamp = data.lastUpdated || Date.now();
        setPriceHistory(prev => {
          // Add the new price point
          const newPoint = { timestamp, price: newPrice as number };
          // Keep only the last 1000 points to avoid performance issues
          return [...prev, newPoint].slice(-1000);
        });
        
        setLoading(false);
      }
    };
    
    // Listen for both orderbook updates and direct price updates
    socket.on('orderbook:update', handlePriceUpdate);
    socket.on('price:update', handlePriceUpdate);
    
    // Clean up event listeners
    return () => {
      socket.off('orderbook:update', handlePriceUpdate);
      socket.off('price:update', handlePriceUpdate);
    };
  }, [socket, isConnected, marketId]);
  
  // Filter price history based on selected time range
  const getFilteredPriceHistory = () => {
    const now = Date.now();
    
    switch (timeRange) {
      case '5m':
        return priceHistory.filter(p => p.timestamp > now - 5 * 60 * 1000);
      case '15m':
        return priceHistory.filter(p => p.timestamp > now - 15 * 60 * 1000);
      case '1h':
        return priceHistory.filter(p => p.timestamp > now - 60 * 60 * 1000);
      case 'all':
      default:
        return priceHistory;
    }
  };
  
  // Get filtered price history
  const filteredPriceHistory = getFilteredPriceHistory();
  
  // Ensure at least two data points for proper charting
  const chartData = {
    labels: filteredPriceHistory.map(p => new Date(p.timestamp)),
    datasets: [
      {
        label: 'Price',
        data: filteredPriceHistory.map(p => p.price),
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
        tension: 0.3,
        fill: false,
        pointRadius: filteredPriceHistory.length < 10 ? 3 : 0,
        pointHoverRadius: 5
      }
    ]
  };
  
  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 250
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: timeRange === '5m' ? 'minute' : timeRange === '15m' ? 'minute' : 'minute',
          tooltipFormat: 'HH:mm:ss',
          displayFormats: {
            minute: 'HH:mm'
          }
        },
        title: {
          display: false
        }
      },
      y: {
        min: 0,
        max: 1,
        ticks: {
          callback: function(value) {
            return typeof value === 'number' ? value.toFixed(2) : value;
          }
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `Price: ${context.parsed.y.toFixed(2)}`;
          },
          title: function(tooltipItems) {
            const date = new Date(tooltipItems[0].parsed.x);
            return date.toLocaleTimeString();
          }
        }
      }
    },
    interaction: {
      mode: 'index',
      intersect: false
    }
  };
  
  if (loading && priceHistory.length <= 1) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex justify-center items-center h-60">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }
  
  // Format number for display
  const formatNumber = (num: number) => {
    return num.toFixed(2);
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">{marketName}</h3>
        <div className="flex space-x-1">
          {(['5m', '15m', '1h', 'all'] as const).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-2 py-1 text-xs rounded ${
                timeRange === range 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-gray-500">
          Current price: <span className="font-semibold text-lg">{formatNumber(latestPrice)}</span>
        </div>
        <div className="text-sm text-gray-500">
          {filteredPriceHistory.length > 1 ? (
            <span>
              Range: {formatNumber(Math.min(...filteredPriceHistory.map(p => p.price)))} - {formatNumber(Math.max(...filteredPriceHistory.map(p => p.price)))}
            </span>
          ) : ''}
        </div>
      </div>
      
      <div className="h-60">
        <Line data={chartData} options={chartOptions} />
      </div>
      
      <div className="mt-4 text-xs text-gray-500 flex justify-between">
        <div>Points: {filteredPriceHistory.length}</div>
        <div>Last update: {filteredPriceHistory.length > 0 ? new Date(filteredPriceHistory[filteredPriceHistory.length-1].timestamp).toLocaleTimeString() : 'N/A'}</div>
      </div>
    </div>
  );
} 