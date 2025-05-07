'use client';

import React, { useState, useEffect } from 'react';
import { useSocket } from '@/lib/hooks/useSocket';

interface NewsItem {
  id: string;
  title: string;
  content: string;
  source?: string;
  timestamp: number;
  type: 'news' | 'update' | 'alert';
}

interface NewsUpdatesProps {
  matchId: string;
}

export default function NewsUpdates({ matchId }: NewsUpdatesProps) {
  const { socket, isConnected } = useSocket();
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Fetch news on component mount
  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await fetch(`/api/sports/cricket/match/${matchId}/news`);
        if (!response.ok) throw new Error('Failed to fetch news');
        
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          setNewsItems(data.data);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching news:', error);
        // Use mock data if API fails
        setMockNews();
        setLoading(false);
      }
    };
    
    fetchNews();
    
    // Listen for live updates
    if (socket && isConnected) {
      socket.emit('join:match', matchId);
      
      socket.on('news:update', (data: { matchId: string; news: NewsItem }) => {
        if (data.matchId === matchId && data.news) {
          setNewsItems(prev => [data.news, ...prev].slice(0, 20)); // Keep last 20 news items
        }
      });
      
      return () => {
        socket.off('news:update', (data: any) => {
          // Empty callback to match the event listener
        });
      };
    }
  }, [matchId, socket, isConnected]);
  
  // Set mock news if API fails
  const setMockNews = () => {
    const now = Date.now();
    setNewsItems([
      {
        id: '1',
        title: 'Team A wins the toss',
        content: 'Team A has won the toss and elected to bat first.',
        timestamp: now - 1000 * 60 * 30, // 30 minutes ago
        type: 'update'
      },
      {
        id: '2',
        title: 'Player Injury Update',
        content: 'Star batsman from Team B is nursing a hamstring injury but is expected to play.',
        source: 'Cricket News Network',
        timestamp: now - 1000 * 60 * 60, // 1 hour ago
        type: 'news'
      },
      {
        id: '3',
        title: 'Weather Update',
        content: 'Clear skies expected throughout the match with no chance of rain.',
        timestamp: now - 1000 * 60 * 90, // 1.5 hours ago
        type: 'update'
      },
      {
        id: '4',
        title: 'Match Preview',
        content: 'Both teams come into this match with strong recent performances. Team A has won their last 3 matches while Team B is looking to bounce back from a narrow defeat.',
        source: 'Cricket Analysis',
        timestamp: now - 1000 * 60 * 120, // 2 hours ago
        type: 'news'
      }
    ]);
  };
  
  // Format timestamp to readable time
  const formatTime = (timestamp: number): string => {
    const now = Date.now();
    const diffMinutes = Math.floor((now - timestamp) / (1000 * 60));
    
    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffMinutes < 24 * 60) {
      const hours = Math.floor(diffMinutes / 60);
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    } else {
      return new Date(timestamp).toLocaleString();
    }
  };
  
  // Get CSS class based on news type
  const getNewsTypeClass = (type: string): string => {
    switch (type) {
      case 'alert':
        return 'bg-red-50 dark:bg-red-900 border-red-200 dark:border-red-800';
      case 'update':
        return 'bg-blue-50 dark:bg-blue-900 border-blue-200 dark:border-blue-800';
      case 'news':
      default:
        return 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600';
    }
  };
  
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">News & Updates</h3>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">News & Updates</h3>
      
      {newsItems.length === 0 ? (
        <div className="py-8 text-center text-gray-500 dark:text-gray-400">
          No news or updates available
        </div>
      ) : (
        <div className="space-y-4">
          {newsItems.map((item) => (
            <div 
              key={item.id} 
              className={`p-4 border rounded-lg ${getNewsTypeClass(item.type)}`}
            >
              <div className="flex justify-between items-start">
                <h4 className="font-medium">{item.title}</h4>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatTime(item.timestamp)}
                </span>
              </div>
              
              <p className="mt-2 text-sm">{item.content}</p>
              
              {item.source && (
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Source: {item.source}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 