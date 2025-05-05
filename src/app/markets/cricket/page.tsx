'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';

interface CricketMatch {
  id: string;
  name: string;
  matchType: string;
  status: string;
  venue: string;
  date: string;
  teams: string[];
  score?: {
    r: number;
    w: number;
    o: number;
    inning: string;
  }[];
}

export default function CricketMarketsPage() {
  const { data: session } = useSession();
  const [matches, setMatches] = useState<CricketMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  
  // Fetch cricket matches
  useEffect(() => {
    const fetchMatches = async () => {
      if (!session?.user) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch('/api/sports/cricket/matches');
        
        if (!response.ok) {
          throw new Error('Failed to fetch cricket matches');
        }
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch cricket matches');
        }
        
        setMatches(data.data || []);
      } catch (err: any) {
        console.error('Error fetching cricket matches:', err);
        setError(err.message || 'An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMatches();
    
    // Refresh data every 60 seconds
    const interval = setInterval(() => {
      fetchMatches();
    }, 60000);
    
    return () => clearInterval(interval);
  }, [session]);
  
  // Filter matches
  const filteredMatches = matches.filter(match => {
    if (filter === 'all') return true;
    if (filter === 'live') return match.status.toLowerCase().includes('progress');
    if (filter === 'upcoming') return match.status.toLowerCase().includes('upcoming') || match.status.toLowerCase().includes('not started');
    if (filter === 'completed') return match.status.toLowerCase().includes('complete');
    return true;
  });
  
  // Format date
  const formatMatchDate = (dateString: string) => {
    try {
      const date = parseISO(dateString);
      return format(date, 'MMM d, yyyy h:mm a');
    } catch (e) {
      return dateString;
    }
  };
  
  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold mb-6">Cricket Markets</h1>
        <div className="bg-white rounded-lg shadow-md p-6 min-h-[300px] flex items-center justify-center">
          <div className="text-gray-500">Loading cricket matches...</div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold mb-6">Cricket Markets</h1>
        <div className="bg-white rounded-lg shadow-md p-6 min-h-[300px] flex items-center justify-center">
          <div className="text-red-500">{error}</div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Cricket Markets</h1>
        <div className="flex space-x-2">
          <button 
            onClick={() => setFilter('all')}
            className={`px-4 py-2 text-sm rounded-md ${
              filter === 'all' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All
          </button>
          <button 
            onClick={() => setFilter('live')}
            className={`px-4 py-2 text-sm rounded-md ${
              filter === 'live' 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Live
          </button>
          <button 
            onClick={() => setFilter('upcoming')}
            className={`px-4 py-2 text-sm rounded-md ${
              filter === 'upcoming' 
                ? 'bg-yellow-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Upcoming
          </button>
          <button 
            onClick={() => setFilter('completed')}
            className={`px-4 py-2 text-sm rounded-md ${
              filter === 'completed' 
                ? 'bg-gray-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Completed
          </button>
        </div>
      </div>
      
      {filteredMatches.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <p className="text-gray-500">No {filter !== 'all' ? filter : ''} cricket matches found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMatches.map((match) => (
            <Link 
              key={match.id} 
              href={`/markets/cricket/${match.id}`}
              className="block bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-200"
            >
              <div className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center">
                    <span className={`w-3 h-3 rounded-full mr-2 ${
                      match.status.toLowerCase().includes('progress') ? 'bg-green-500' : 
                      match.status.toLowerCase().includes('complete') ? 'bg-blue-500' :
                      'bg-yellow-500'
                    }`}></span>
                    <span className="text-sm text-gray-600">{match.matchType}</span>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded-full ${
                    match.status.toLowerCase().includes('progress') ? 'bg-green-100 text-green-800' : 
                    match.status.toLowerCase().includes('complete') ? 'bg-blue-100 text-blue-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {match.status}
                  </div>
                </div>
                
                <h2 className="text-lg font-bold text-gray-900 mb-2">
                  {match.teams[0]} vs {match.teams[1]}
                </h2>
                
                <div className="text-sm text-gray-600 mb-3">
                  {match.venue}
                </div>
                
                <div className="text-sm text-gray-600 mb-4">
                  {formatMatchDate(match.date)}
                </div>
                
                {match.score && match.score.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {match.score.map((inning, i) => (
                      <div key={i} className="bg-gray-50 p-2 rounded-md">
                        <div className="text-xs text-gray-500">{inning.inning.split(' ')[0]}</div>
                        <div className="text-sm font-medium">
                          {inning.r}-{inning.w} ({inning.o})
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm text-gray-600">
                    {match.status.toLowerCase().includes('progress') ? (
                      <span className="font-medium text-green-600">Trading Live</span>
                    ) : match.status.toLowerCase().includes('complete') ? (
                      <span className="font-medium text-blue-600">Settled</span>
                    ) : (
                      <span className="font-medium text-yellow-600">Open for Trading</span>
                    )}
                  </div>
                  <div className="flex items-center text-blue-600 hover:text-blue-800">
                    <span className="text-sm font-medium">View Markets</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
} 