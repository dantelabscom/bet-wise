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
  
  // Initialize with a starting price point
  useEffect(() => {
    const now = Date.now();
    setPriceHistory([
      { timestamp: now - 1000 * 60 * 15, price: 0.5 }, // 15 minutes ago
    ]);
  }, [marketId]);
  
  // Listen for price updates
  useEffect(() => {
    if (!socket || !isConnected) return;
    
    // Join the market room
    socket.emit('join:market', marketId);
    
    // Listen for price updates
    const handlePriceUpdate = (data: any) => {
      if (data.marketId === marketId && data.lastPrice) {
        setPriceHistory(prev => {
          // Add new price point
          const newPoint = {
            timestamp: data.lastUpdated || Date.now(),
            price: data.lastPrice
          };
          
          // Keep up to 1000 points to avoid performance issues
          const updatedHistory = [...prev, newPoint].slice(-1000);
          return updatedHistory;
        });
      }
    };
    
    // Listen for orderbook updates which include price
    socket.on('orderbook:update', handlePriceUpdate);
    
    // Listen for direct price updates
    socket.on('price:update', handlePriceUpdate);
    
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
  
  // Prepare chart data
  const filteredPriceHistory = getFilteredPriceHistory();
  const chartData = {
    labels: filteredPriceHistory.map(p => new Date(p.timestamp)),
    datasets: [
      {
        label: 'Yes Price',
        data: filteredPriceHistory.map(p => p.price),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        tension: 0.1,
        pointRadius: 0,
        pointHitRadius: 10,
        borderWidth: 2,
      },
      {
        label: 'No Price',
        data: filteredPriceHistory.map(p => 1 - p.price),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        tension: 0.1,
        pointRadius: 0,
        pointHitRadius: 10,
        borderWidth: 2,
      }
    ]
  };
  
  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
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
          display: true,
          text: 'Time'
        }
      },
      y: {
        min: 0,
        max: 1,
        title: {
          display: true,
          text: 'Price'
        },
        ticks: {
          callback: function(value) {
            if (typeof value === 'number') {
              return value.toFixed(2);
            }
            return value;
          }
        }
      }
    },
    plugins: {
      legend: {
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: ${parseFloat(context.parsed.y.toString()).toFixed(2)}`;
          }
        }
      }
    }
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">{marketName} - Price History</h3>
        <div className="flex space-x-2">
          {(['5m', '15m', '1h', 'all'] as const).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-2 py-1 text-xs rounded ${
                timeRange === range
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>
      
      <div className="h-64">
        <Line data={chartData} options={chartOptions} />
      </div>
      
      <div className="mt-4 flex justify-between text-sm text-gray-500 dark:text-gray-400">
        <div>
          Last price: <span className="font-semibold">
            {filteredPriceHistory.length > 0 
              ? filteredPriceHistory[filteredPriceHistory.length - 1].price.toFixed(2)
              : '0.50'}
          </span>
        </div>
        <div>
          Price range: <span className="font-semibold">
            {filteredPriceHistory.length > 1
              ? `${Math.min(...filteredPriceHistory.map(p => p.price)).toFixed(2)} - ${Math.max(...filteredPriceHistory.map(p => p.price)).toFixed(2)}`
              : '0.50 - 0.50'}
          </span>
        </div>
      </div>
    </div>
  );
} 