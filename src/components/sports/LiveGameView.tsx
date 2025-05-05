import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { format } from 'date-fns';
import { LiveDataService } from '@/lib/services/sports-data/live-data';

// Game data interface matching our SportRadar service
interface LiveGame {
  gameId: string;
  sport: string;
  status: string;
  homeTeam: {
    teamId: string;
    name: string;
    abbreviation: string;
  };
  awayTeam: {
    teamId: string;
    name: string;
    abbreviation: string;
  };
  scores: {
    homeScore: number;
    awayScore: number;
    period: number;
    timeRemaining?: string;
  };
  clock?: string;
  possession?: string;
  lastPlay?: string;
  momentum?: number;
  venue: string;
  inning?: number;
  balls?: number;
  striker?: string;
  nonStriker?: string;
  bowler?: string;
  runRate?: number;
  requiredRunRate?: number;
}

interface LiveGameViewProps {
  gameId: string;
  sport?: string;
}

export default function LiveGameView({ gameId, sport = 'nba' }: LiveGameViewProps) {
  const { data: session } = useSession();
  const [game, setGame] = useState<LiveGame | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Initialize the LiveDataService
  const liveDataService = LiveDataService.getInstance();
  
  // Fetch initial game data
  useEffect(() => {
    const fetchGameData = async () => {
      if (!session?.user || !gameId) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/sports/live?gameId=${gameId}&sport=${sport}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch game data');
        }
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch game data');
        }
        
        setGame(data.data);
      } catch (err: any) {
        console.error('Error fetching game data:', err);
        setError(err.message || 'An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchGameData();
  }, [session?.user, gameId, sport]);
  
  // Connect to WebSocket for live updates
  useEffect(() => {
    if (!game) return;
    
    const connectToLiveData = async () => {
      try {
        // Connect to WebSocket
        await liveDataService.connect();
        setIsConnected(true);
        
        // Subscribe to score updates
        liveDataService.subscribe('score_update', handleScoreUpdate);
        
        // Subscribe to market updates
        liveDataService.subscribe('market_update', handleMarketUpdate);
        
        // Subscribe to game status updates
        liveDataService.subscribe('game_status', handleGameStatusUpdate);
      } catch (err: any) {
        console.error('Error connecting to live data:', err);
        setIsConnected(false);
      }
    };
    
    connectToLiveData();
    
    // Cleanup function
    return () => {
      liveDataService.unsubscribe('score_update', handleScoreUpdate);
      liveDataService.unsubscribe('market_update', handleMarketUpdate);
      liveDataService.unsubscribe('game_status', handleGameStatusUpdate);
      liveDataService.disconnect();
    };
  }, [game]);
  
  // Handle score updates
  const handleScoreUpdate = (data: any) => {
    if (data.gameId !== gameId) return;
    
    setGame(prevGame => {
      if (!prevGame) return null;
      
      const updatedGame = { ...prevGame };
      
      // Update scores
      updatedGame.scores = {
        ...prevGame.scores,
        homeScore: data.homeScore,
        awayScore: data.awayScore,
        period: data.period,
        timeRemaining: data.timeRemaining
      };
      
      // Update momentum
      updatedGame.momentum = data.momentum;
      
      // Update cricket specific fields if applicable
      if (sport.toLowerCase() === 'cricket' && data.cricket) {
        updatedGame.inning = data.cricket.inning;
        updatedGame.balls = data.cricket.balls;
        updatedGame.striker = data.cricket.striker;
        updatedGame.nonStriker = data.cricket.nonStriker;
        updatedGame.bowler = data.cricket.bowler;
        updatedGame.runRate = data.cricket.runRate;
        updatedGame.requiredRunRate = data.cricket.requiredRunRate;
      }
      
      return updatedGame;
    });
  };
  
  // Handle market updates
  const handleMarketUpdate = (data: any) => {
    // Handle market updates
    console.log('Market update:', data);
  };
  
  // Handle game status updates
  const handleGameStatusUpdate = (data: any) => {
    if (data.gameId !== gameId) return;
    
    setGame(prevGame => {
      if (!prevGame) return null;
      
      return {
        ...prevGame,
        status: data.status,
        clock: data.clock,
        possession: data.possession,
        lastPlay: data.lastPlay
      };
    });
  };
  
  // Format date strings
  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    return format(new Date(dateString), 'h:mm a');
  };
  
  // Render momentum indicator
  const renderMomentum = (momentum?: number) => {
    if (momentum === undefined) return null;
    
    const width = Math.abs(momentum) * 100;
    const position = momentum > 0 ? 'right' : 'left';
    const color = momentum > 0 ? 'bg-green-500' : 'bg-purple-500';
    
    return (
      <div className="mt-6">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Momentum</h3>
        <div className="h-4 bg-gray-200 rounded-full relative overflow-hidden">
          <div 
            className={`h-full ${color} absolute ${position}-0`}
            style={{ width: `${width}%` }}
          ></div>
          <div className="absolute inset-0 flex justify-between items-center px-3">
            <span className="text-xs text-white font-bold">{game?.awayTeam.abbreviation}</span>
            <span className="text-xs text-white font-bold">{game?.homeTeam.abbreviation}</span>
          </div>
        </div>
      </div>
    );
  };
  
  // Render cricket-specific information
  const renderCricketInfo = () => {
    if (!game || game.sport.toLowerCase() !== 'cricket') return null;
    
    return (
      <div className="bg-gray-50 p-4 rounded-lg mt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Cricket Match Info</h3>
        <div className="space-y-2">
          {game.inning !== undefined && (
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Inning:</span>
              <span className="text-sm font-medium">{game.inning}</span>
            </div>
          )}
          
          {game.balls !== undefined && (
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Balls:</span>
              <span className="text-sm font-medium">{game.balls}</span>
            </div>
          )}
          
          {game.runRate !== undefined && (
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Run Rate:</span>
              <span className="text-sm font-medium">{game.runRate.toFixed(2)}</span>
            </div>
          )}
          
          {game.requiredRunRate !== undefined && (
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Required Run Rate:</span>
              <span className={`text-sm font-medium ${
                (game.requiredRunRate > (game.runRate || 0)) ? 'text-red-600' : 'text-green-600'
              }`}>
                {game.requiredRunRate.toFixed(2)}
              </span>
            </div>
          )}
          
          {game.striker && (
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Striker:</span>
              <span className="text-sm font-medium">{game.striker}</span>
            </div>
          )}
          
          {game.nonStriker && (
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Non-Striker:</span>
              <span className="text-sm font-medium">{game.nonStriker}</span>
            </div>
          )}
          
          {game.bowler && (
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Bowler:</span>
              <span className="text-sm font-medium">{game.bowler}</span>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 min-h-[300px] flex items-center justify-center">
        <div className="text-gray-500">Loading game data...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 min-h-[300px] flex items-center justify-center">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }
  
  if (!game) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 min-h-[300px] flex items-center justify-center">
        <div className="text-gray-500">Game not found</div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            Live {game.sport.charAt(0).toUpperCase() + game.sport.slice(1)} Game
          </h2>
          <div className="flex items-center">
            <span className={`relative flex h-3 w-3 mr-2 ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-current"></span>
            </span>
            <span className="text-sm font-medium text-gray-600">
              {isConnected ? 'Live' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>
      
      <div className="p-6">
        {/* Score board */}
        <div className="flex justify-between items-center mb-6">
          <div className="text-center flex-1">
            <div className="text-lg font-semibold text-gray-800">{game.awayTeam.name}</div>
            <div className="text-4xl font-bold text-gray-900 mt-1">{game.scores.awayScore}</div>
            {game.sport.toLowerCase() === 'cricket' && (
              <div className="text-xs text-gray-500 mt-1">
                {game.inning === 1 ? 'Batting' : 'Bowling'}
              </div>
            )}
          </div>
          
          <div className="text-center mx-4">
            <div className="text-lg font-medium text-gray-600">
              {game.status === 'in_progress' ? 'LIVE' : game.status.toUpperCase()}
            </div>
            {game.status === 'in_progress' && (
              <div className="mt-1">
                <div className="text-sm font-bold bg-red-600 text-white rounded-md px-3 py-1">
                  {game.scores.timeRemaining 
                    ? game.scores.timeRemaining 
                    : game.sport.toLowerCase() === 'cricket'
                      ? `Inning ${game.scores.period}`
                      : 'LIVE'
                  }
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {game.sport.toLowerCase() === 'cricket' 
                    ? `${Math.floor((game.balls || 0) / 6)}.${(game.balls || 0) % 6} overs` 
                    : `Period ${game.scores.period}`
                  }
                </div>
              </div>
            )}
          </div>
          
          <div className="text-center flex-1">
            <div className="text-lg font-semibold text-gray-800">{game.homeTeam.name}</div>
            <div className="text-4xl font-bold text-gray-900 mt-1">{game.scores.homeScore}</div>
            {game.sport.toLowerCase() === 'cricket' && (
              <div className="text-xs text-gray-500 mt-1">
                {game.inning === 2 ? 'Batting' : 'Bowling'}
              </div>
            )}
          </div>
        </div>
        
        {/* Game information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Game Info</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Venue:</span>
                <span className="text-sm font-medium">{game.venue}</span>
              </div>
              {game.possession && game.sport.toLowerCase() !== 'cricket' && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Possession:</span>
                  <span className="text-sm font-medium">
                    {game.possession === game.homeTeam.teamId ? game.homeTeam.name : game.awayTeam.name}
                  </span>
                </div>
              )}
              {game.lastPlay && (
                <div className="mt-2">
                  <span className="text-sm text-gray-600">Last Play:</span>
                  <p className="text-sm mt-1">{game.lastPlay}</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Cricket-specific information */}
          {renderCricketInfo()}
        </div>
        
        {/* Momentum indicator */}
        {renderMomentum(game.momentum)}
      </div>
    </div>
  );
} 