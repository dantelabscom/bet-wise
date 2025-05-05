'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { GameData } from '@/lib/services/sports-data/sportradar';
import { format } from 'date-fns';
import Link from 'next/link';

// Sport selection options
const SPORTS = [
  { id: 'nba', name: 'Basketball' },
  { id: 'nfl', name: 'Football' },
  { id: 'mlb', name: 'Baseball' },
  { id: 'soccer', name: 'Soccer' },
  { id: 'cricket', name: 'Cricket' },
];

export default function UpcomingGames() {
  const { data: session } = useSession();
  const [selectedSport, setSelectedSport] = useState('nba');
  const [timeFrame, setTimeFrame] = useState(7);
  const [games, setGames] = useState<GameData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUpcomingGames = async () => {
      if (!session?.user) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(
          `/api/sports/upcoming?sport=${selectedSport}&days=${timeFrame}`
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch upcoming games');
        }
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch upcoming games');
        }
        
        setGames(data.data);
      } catch (err: any) {
        console.error('Error fetching upcoming games:', err);
        setError(err.message || 'An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUpcomingGames();
  }, [session?.user, selectedSport, timeFrame]);
  
  // Format date for display
  const formatGameTime = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'MMM d, yyyy h:mm a');
  };

  // Render game status badge
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
            Scheduled
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
            Live
          </span>
        );
      case 'halftime':
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">
            Break
          </span>
        );
      case 'complete':
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
            Complete
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };
  
  // Get the appropriate route for viewing a game
  const getGameRoute = (game: GameData) => {
    return `/sports/${game.gameId}?sport=${game.sport}`;
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Upcoming Games</h2>
          
          <div className="mt-3 sm:mt-0 flex space-x-2">
            {/* Sport selector */}
            <select
              className="bg-white border border-gray-300 rounded-md px-3 py-1 text-sm"
              value={selectedSport}
              onChange={(e) => setSelectedSport(e.target.value)}
            >
              {SPORTS.map((sport) => (
                <option key={sport.id} value={sport.id}>
                  {sport.name}
                </option>
              ))}
            </select>
            
            {/* Time frame selector */}
            <select
              className="bg-white border border-gray-300 rounded-md px-3 py-1 text-sm"
              value={timeFrame}
              onChange={(e) => setTimeFrame(Number(e.target.value))}
            >
              <option value={3}>Next 3 days</option>
              <option value={7}>Next 7 days</option>
              <option value={14}>Next 14 days</option>
              <option value={30}>Next 30 days</option>
            </select>
          </div>
        </div>
      </div>
      
      {isLoading ? (
        <div className="p-6 text-center text-gray-500">Loading games...</div>
      ) : error ? (
        <div className="p-6 text-center text-red-500">{error}</div>
      ) : games.length === 0 ? (
        <div className="p-6 text-center text-gray-500">No upcoming games found.</div>
      ) : (
        <div className="divide-y divide-gray-200">
          {games.map((game) => (
            <div key={game.gameId} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center">
                    <div className="mr-2 font-medium text-gray-900">
                      {game.homeTeam.name} vs {game.awayTeam.name}
                    </div>
                    {renderStatusBadge(game.status)}
                  </div>
                  <div className="mt-1 text-sm text-gray-500">
                    {formatGameTime(game.startTime)} • {game.venue}
                  </div>
                </div>
                
                <div className="mt-2 sm:mt-0 flex items-center">
                  {game.status === 'in_progress' && game.scores && (
                    <div className="mr-4 text-center">
                      <div className="text-lg font-semibold">
                        {game.scores.homeScore} - {game.scores.awayScore}
                      </div>
                      <div className="text-xs text-gray-500">
                        {game.sport === 'cricket' ? 'Inning' : 'Period'} {game.scores.period} 
                        {game.scores.timeRemaining && ` • ${game.scores.timeRemaining}`}
                      </div>
                    </div>
                  )}
                  
                  <Link href={getGameRoute(game)}>
                    <span className="px-3 py-1 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 cursor-pointer inline-block">
                      {game.status === 'in_progress' ? 'Watch Live' : 'View Markets'}
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 