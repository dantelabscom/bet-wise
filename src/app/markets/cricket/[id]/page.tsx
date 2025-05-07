'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import OrderEntry from './components/OrderEntry';
import BallByBallCommentary from './components/BallByBallCommentary';
import PriceChart from './components/PriceChart';
import OrderBookDetailed from './components/OrderBookDetailed';
import MatchStats from './components/MatchStats';
import UpcomingFixtures from './components/UpcomingFixtures';

interface MatchInfo {
  matchId: string;
  name: string;
  status: string;
  format: string;
  current_innings: number;
  venue: string;
  date: string;
  teams: string[];
  batting_team: {
    name: string;
    score: number;
    wickets: number;
    overs: number;
    run_rate: number;
  };
  bowling_team: {
    name: string;
    score: number;
    wickets: number;
    overs: number;
    run_rate: number;
  };
}

interface MarketInfo {
  id: string;
  name: string;
  description: string;
  type: string;
  status: string;
}

export default function CricketMarketPage() {
  const params = useParams();
  const matchId = params.id as string;
  
  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const [markets, setMarkets] = useState<MarketInfo[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<MarketInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Add a state for the active tab in the right panel
  const [activeTab, setActiveTab] = useState<'order' | 'orderbook' | 'stats' | 'news'>('order');
  
  // Fetch match data
  useEffect(() => {
    if (!matchId) return;
    
    const fetchMatchData = async () => {
      try {
        // Fetch match details
        const matchResponse = await fetch(`/api/sports/cricket/match/${matchId}`);
        const matchData = await matchResponse.json();
        
        if (!matchData.success) {
          throw new Error(matchData.error || 'Failed to fetch match data');
        }
        
        setMatchInfo(matchData.data);
        
        // Fetch markets for this match
        const marketsResponse = await fetch(`/api/markets/cricket/${matchId}`);
        const marketsData = await marketsResponse.json();
        
        if (!marketsData.success) {
          throw new Error(marketsData.error || 'Failed to fetch markets data');
        }
        
        setMarkets(marketsData.data);
        
        // Select the first market by default
        if (marketsData.data.length > 0) {
          setSelectedMarket(marketsData.data[0]);
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error('Error loading market data:', err);
        setError(err.message || 'An error occurred while loading the data');
        setLoading(false);
      }
    };
    
    fetchMatchData();
    
    // Poll for updates every 30 seconds
    const intervalId = setInterval(fetchMatchData, 30000);
    
    return () => clearInterval(intervalId);
  }, [matchId]);
  
  // Format date for display
  const formatMatchDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  // Add this after the formatMatchDate function
  const isMatchLive = (matchInfo: MatchInfo): boolean => {
    return matchInfo.status === 'In Progress' || matchInfo.status === 'Live';
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }
  
  if (error || !matchInfo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error || 'Match not found'}</p>
        </div>
        <Link href="/markets/cricket" className="text-blue-600 hover:underline">
          Back to Cricket Markets
        </Link>
      </div>
    );
  }
  
  // For mock data, generate random markets if none exist
  if (markets.length === 0) {
    // Create mock markets
    const mockMarkets = [
      {
        id: 'market-1',
        name: 'Match Winner',
        description: `Will ${matchInfo.teams[0]} win the match?`,
        type: 'match_winner',
        status: 'open'
      },
      {
        id: 'market-2',
        name: '6+ Runs in Next Over',
        description: 'Will there be 6 or more runs in the next over?',
        type: 'runs_in_over',
        status: 'open'
      },
      {
        id: 'market-3',
        name: 'Wicket in Next Over',
        description: 'Will there be a wicket in the next over?',
        type: 'wicket_in_over',
        status: 'open'
      }
    ];
    
    setMarkets(mockMarkets);
    setSelectedMarket(mockMarkets[0]);
  }
  
  // Current score display helper
  const getScoreDisplay = (team: typeof matchInfo.batting_team) => {
    return `${team.score}/${team.wickets} (${team.overs} overs, RR: ${team.run_rate})`;
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Match Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold mb-2">{matchInfo.name}</h1>
        <div className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          {matchInfo.venue} • {formatMatchDate(matchInfo.date)}
        </div>
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div className="mb-4 sm:mb-0">
            <div className="text-sm font-semibold text-gray-500 dark:text-gray-400">
              {matchInfo.format} • {matchInfo.status}
            </div>
          </div>
          
          <div className={`px-3 py-1 rounded-full text-sm ${
            isMatchLive(matchInfo) 
              ? 'bg-green-50 dark:bg-green-900 text-green-800 dark:text-green-100' 
              : 'bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100'
          }`}>
            {matchInfo.status === 'In Progress' ? 'LIVE' : matchInfo.status}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column - Main content */}
        <div className="lg:col-span-8 space-y-6">
          {/* Price chart component */}
          <PriceChart 
            marketId={selectedMarket?.id || ''} 
            marketName={selectedMarket?.name || 'Market'} 
          />
          
          {/* Score card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4">Match Score</h2>
            
            {!isMatchLive(matchInfo) ? (
              <div className="p-6 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  {matchInfo.status === 'Upcoming' || matchInfo.status === 'Not Started' 
                    ? 'Match has not started yet. Check back later for live scores.' 
                    : 'Match has ended.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Batting team */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div className="font-semibold">{matchInfo.batting_team.name}</div>
                    <div className="text-lg font-bold">{getScoreDisplay(matchInfo.batting_team)}</div>
                  </div>
                </div>
                
                {/* Bowling team */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div className="font-semibold">{matchInfo.bowling_team.name}</div>
                    <div>{getScoreDisplay(matchInfo.bowling_team)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Stats component */}
          {isMatchLive(matchInfo) && (
            <MatchStats matchId={matchId} />
          )}
          
          {/* Ball-by-ball commentary */}
          {isMatchLive(matchInfo) ? (
            <BallByBallCommentary matchId={matchId} />
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold mb-4">Ball-by-Ball Commentary</h2>
              <div className="p-6 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  {matchInfo.status === 'Upcoming' || matchInfo.status === 'Not Started'
                    ? 'Commentary will be available once the match starts.'
                    : 'Match has ended. No live commentary available.'}
                </p>
              </div>
            </div>
          )}
          
          {/* News & Updates component */}
          <UpcomingFixtures matchId={matchId} />
        </div>
        
        {/* Right column - Market and trading */}
        <div className="lg:col-span-4 space-y-6">
          {/* Market selector */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4">Markets</h2>
            
            <div className="space-y-2">
              {markets.map(market => (
                <button
                  key={market.id}
                  className={`w-full text-left p-3 rounded-md ${
                    selectedMarket?.id === market.id
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  onClick={() => setSelectedMarket(market)}
                >
                  <div className="font-medium">{market.name}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    {market.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
          
          {/* Trading panel (tabs for order entry, orderbook, stats) */}
          {selectedMarket && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
              {/* Tab navigation */}
              <div className="flex border-b border-gray-200 dark:border-gray-700">
                <button
                  className={`flex-1 py-3 px-4 text-sm font-medium ${
                    activeTab === 'order' 
                      ? 'bg-white dark:bg-gray-800 border-b-2 border-blue-500 text-blue-600' 
                      : 'bg-gray-50 dark:bg-gray-700 text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => setActiveTab('order')}
                >
                  Place Order
                </button>
                <button
                  className={`flex-1 py-3 px-4 text-sm font-medium ${
                    activeTab === 'orderbook' 
                      ? 'bg-white dark:bg-gray-800 border-b-2 border-blue-500 text-blue-600' 
                      : 'bg-gray-50 dark:bg-gray-700 text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => setActiveTab('orderbook')}
                >
                  Order Book
                </button>
              </div>
              
              {/* Tab content */}
              <div className="p-0">
                {activeTab === 'order' && selectedMarket && (
                  <OrderEntry 
                    matchId={matchId} 
                    marketId={selectedMarket.id} 
                    marketName={selectedMarket.name} 
                  />
                )}
                
                {activeTab === 'orderbook' && selectedMarket && (
                  <OrderBookDetailed marketId={selectedMarket.id} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 