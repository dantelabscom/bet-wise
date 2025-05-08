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
  const [latestPrice, setLatestPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Listen for price updates via WebSocket
  useEffect(() => {
    if (!socket || !isConnected) return;
    
    console.log(`PriceChart: Connecting to market ${marketId}`);
    
    // Join the market's room
    socket.emit('join:market', marketId);
    
    // Request initial price history
    socket.emit('get:price_history', { marketId });
    
    // Handler for price history
    const handlePriceHistory = (data: { marketId: string, history: Array<{ timestamp: number, price: number }> }) => {
      if (data.marketId !== marketId) return;
      
      console.log(`PriceChart: Received price history for market ${marketId}`);
      
      if (data.history && data.history.length > 0) {
        setPriceHistory(data.history);
        setLatestPrice(data.history[data.history.length - 1].price);
        setLoading(false);
      }
    };
    
    // Handler for real-time price updates
    const handlePriceUpdate = (data: any) => {
      if (data.marketId !== marketId) return;
      
      console.log(`PriceChart: Received price update for market ${marketId}:`, data);
      
      let newPrice: number | null = null;
      
      // Extract price from different data formats
      if (data.lastPrice !== undefined) {
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
      
      if (newPrice !== null && !isNaN(newPrice)) {
        console.log(`PriceChart: Setting new price ${newPrice} for market ${marketId}`);
        
        // Update latest price
        setLatestPrice(newPrice);
        
        // Add new price point with current timestamp
        setPriceHistory(prev => {
          const timestamp = data.timestamp || Date.now();
          const newPoint = { 
            timestamp, 
            price: Number(newPrice!.toFixed(3))
          };
          
          // Only add if different from last price or if it's been more than 5 seconds
          const lastPoint = prev.length > 0 ? prev[prev.length - 1] : null;
          if (!lastPoint || 
              Math.abs(lastPoint.price - newPrice!) > 0.001 || 
              timestamp - lastPoint.timestamp > 5000) {
            return [...prev, newPoint].slice(-200);
          }
          return prev;
        });
        
        setLoading(false);
      }
    };
    
    // Handler for orderbook updates
    const handleOrderBookUpdate = (data: any) => {
      if (data.marketId !== marketId) return;
      
      console.log(`PriceChart: Received orderbook update for market ${marketId}`);
      
      if (data.bids && data.bids.length > 0 && data.asks && data.asks.length > 0) {
        // Calculate midpoint price from best bid and ask
        const bestBid = typeof data.bids[0].price === 'string' 
          ? parseFloat(data.bids[0].price) 
          : data.bids[0].price;
          
        const bestAsk = typeof data.asks[0].price === 'string' 
          ? parseFloat(data.asks[0].price) 
          : data.asks[0].price;
          
        const midPrice = (bestBid + bestAsk) / 2;
        
        console.log(`PriceChart: Calculated midpoint price ${midPrice} from orderbook`);
        
        // Update latest price
        setLatestPrice(midPrice);
        
        // Add new price point
        setPriceHistory(prev => {
          const timestamp = data.lastUpdated || Date.now();
          const newPoint = { 
            timestamp, 
            price: Number(midPrice.toFixed(3))
          };
          
          // Only add if different from last price or if it's been more than 5 seconds
          const lastPoint = prev.length > 0 ? prev[prev.length - 1] : null;
          if (!lastPoint || 
              Math.abs(lastPoint.price - midPrice) > 0.001 || 
              timestamp - lastPoint.timestamp > 5000) {
            return [...prev, newPoint].slice(-200);
          }
          return prev;
        });
        
        setLoading(false);
      }
    };
    
    // Listen for price history, orderbook updates and direct price updates
    socket.on('price:history', handlePriceHistory);
    socket.on('orderbook:update', handleOrderBookUpdate); // Use dedicated handler for orderbook
    socket.on('price:update', handlePriceUpdate);
    socket.on('trade:executed', handlePriceUpdate);
    
    // If we have no data after 2 seconds, initialize with current time and default price
    const initTimer = setTimeout(() => {
      if (priceHistory.length === 0) {
        console.log('PriceChart: No data received, initializing with default values');
        const now = Date.now();
        const defaultPrice = 0.5;
        setPriceHistory([
          { timestamp: now, price: defaultPrice }
        ]);
        setLatestPrice(defaultPrice);
        setLoading(false);
      }
    }, 2000);
    
    // Clean up event listeners
    return () => {
      clearTimeout(initTimer);
      socket.off('price:history', handlePriceHistory);
      socket.off('orderbook:update', handleOrderBookUpdate);
      socket.off('price:update', handlePriceUpdate);
      socket.off('trade:executed', handlePriceUpdate);
      socket.emit('leave:market', marketId);
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
  const ensureMultipleDataPoints = (points: PricePoint[]): PricePoint[] => {
    if (points.length <= 1 && points.length > 0) {
      // If we only have one point, add another slightly different point
      const point = points[0];
      const slightlyDifferentPrice = point.price * (1 + (Math.random() * 0.02 - 0.01));
      return [
        point,
        { timestamp: point.timestamp + 1000, price: slightlyDifferentPrice }
      ];
    }
    return points;
  };
  
  const chartData = {
    datasets: [
      {
        label: 'Price',
        data: ensureMultipleDataPoints(filteredPriceHistory).map(p => ({
          x: p.timestamp,
          y: p.price
        })),
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
        tension: 0.1,
        fill: false,
        pointRadius: filteredPriceHistory.length < 10 ? 3 : 0,
        pointHoverRadius: 5,
        spanGaps: true
      }
    ]
  };
  
  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 0 // Disable animations for better performance
    },
    parsing: false,
    normalized: true,
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'minute',
          displayFormats: {
            minute: 'HH:mm'
          }
        },
        title: {
          display: false
        },
        grid: {
          display: true
        }
      },
      y: {
        beginAtZero: false,
        // Dynamically set min/max based on actual price range
        min: filteredPriceHistory.length > 0 
          ? Math.max(0, Math.min(...filteredPriceHistory.map(p => p.price)) - 0.05) 
          : 0.4,
        max: filteredPriceHistory.length > 0 
          ? Math.max(...filteredPriceHistory.map(p => p.price)) + 0.05
          : 0.6,
        ticks: {
          callback: function(value) {
            return typeof value === 'number' ? value.toFixed(2) : value;
          }
        },
        grid: {
          display: true
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
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
    elements: {
      point: {
        radius: 0,
        hitRadius: 5,
        hoverRadius: 5
      },
      line: {
        tension: 0.2,
        borderWidth: 2
      }
    }
  };
  
  if (loading || !latestPrice) {
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