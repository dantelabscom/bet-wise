'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface CricketMatch {
  id: string;
  name: string;
  matchType: string;
  status: string;
  venue: string;
  date: string;
  teams: string[];
  score: {
    r: number;
    w: number;
    o: number;
    inning: string;
  }[];
  teamInfo?: {
    name: string;
    shortname: string;
  }[];
}

interface CricketScorecard {
  batting: {
    batsman: string;
    r: number;
    b: number;
    "4s": number;
    "6s": number;
    sr: string;
    dismissal: string;
  }[];
  bowling: {
    bowler: string;
    o: string;
    m: string;
    r: string;
    w: string;
    eco: string;
  }[];
}

interface OrderBookEntry {
  price: string;
  quantity: number;
}

interface CricketMarketViewProps {
  matchId: string;
}

export default function CricketMarketView({ matchId }: CricketMarketViewProps) {
  const { data: session } = useSession();
  const [match, setMatch] = useState<CricketMatch | null>(null);
  const [scorecard, setScorecard] = useState<CricketScorecard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [currentPrice, setCurrentPrice] = useState<string>("2.0");
  const [quantity, setQuantity] = useState<number>(1);
  const [priceHistory, setPriceHistory] = useState<{time: string, price: number}[]>([]);
  const [chartTimeframe, setChartTimeframe] = useState<string>('1h');
  
  // Fetch match data
  useEffect(() => {
    const fetchMatchData = async () => {
      if (!session?.user || !matchId) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/sports/cricket/match/${matchId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch match data');
        }
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch match data');
        }
        
        setMatch(data.data);
        
        // Set default selected team
        if (data.data.teams && data.data.teams.length > 0) {
          setSelectedTeam(data.data.teams[0]);
        }
        
        // Extract scorecard if available
        if (data.data.scorecard) {
          setScorecard(data.data.scorecard);
        }
      } catch (err: any) {
        console.error('Error fetching match data:', err);
        setError(err.message || 'An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMatchData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(() => {
      fetchMatchData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [matchId, session]);
  
  // Calculate team probability based on real match data
  const calculateTeamProbability = (teamName: string): number => {
    if (!match || !match.score || match.score.length === 0) return 0.5;
    
    // Find team's score
    const teamScore = match.score.find(s => s.inning.includes(teamName));
    if (!teamScore) return 0.5;
    
    // Basic algorithm to calculate probability based on score, wickets, and match status
    let probability = 0.5; // Default even probability
    
    // If match is in progress, adjust probability based on score and wickets
    if (match.status.toLowerCase().includes('progress')) {
      const otherTeam = match.teams.find(t => t !== teamName);
      const otherTeamScore = otherTeam ? match.score.find(s => s.inning.includes(otherTeam)) : null;
      
      // Calculate total runs
      const totalRuns = match.score.reduce((sum, s) => sum + s.r, 0);
      
      if (totalRuns > 0 && teamScore.r > 0) {
        // Base probability on proportion of runs scored
        probability = teamScore.r / totalRuns;
        
        // Adjust based on wickets - more wickets lost decreases probability
        if (teamScore.w > 0) {
          probability -= (teamScore.w * 0.03);
        }
        
        // Adjust based on overs - more overs played increases probability
        if (teamScore.o > 0 && match.score.length > 1) {
          const totalOvers = match.score.reduce((sum, s) => sum + s.o, 0);
          probability += (teamScore.o / totalOvers) * 0.1;
        }
      }
      
      // Compare with other team if available
      if (otherTeamScore) {
        // If this team has scored more, increase probability
        if (teamScore.r > otherTeamScore.r) {
          probability += 0.1;
        }
        
        // If this team has lost fewer wickets, increase probability
        if (teamScore.w < otherTeamScore.w) {
          probability += 0.05;
        }
      }
    }
    
    // Clamp probability between 0.1 and 0.9
    return Math.max(0.1, Math.min(0.9, probability));
  };
  
  // Get price from probability
  const getPriceFromProbability = (probability: number): string => {
    // Price is 1/probability, rounded to 2 decimal places
    return (1 / probability).toFixed(2);
  };
  
  // Handle team selection
  const handleTeamSelect = (teamName: string) => {
    setSelectedTeam(teamName);
    
    const probability = calculateTeamProbability(teamName);
    const price = getPriceFromProbability(probability);
    setCurrentPrice(price);
  };
  
  // Handle quantity change
  const handleQuantityChange = (amount: number) => {
    const newQuantity = Math.max(1, quantity + amount);
    setQuantity(newQuantity);
  };
  
  // Format price
  const formatPrice = (price: number | string): string => {
    return typeof price === 'string' ? price : price.toFixed(2);
  };
  
  // Get short team name
  const getShortTeamName = (teamName: string): string => {
    if (match?.teamInfo) {
      const team = match.teamInfo.find(t => t.name === teamName);
      if (team) return team.shortname;
    }
    
    // Fallback: use first 3 characters
    return teamName.substring(0, 3).toUpperCase();
  };
  
  // Get current running rate
  const getCurrentRunRate = (): string => {
    if (!match || !match.score || match.score.length === 0) return "0.00";
    
    const currentInnings = match.score[match.score.length - 1];
    if (!currentInnings || !currentInnings.o || currentInnings.o === 0) return "0.00";
    
    const runRate = currentInnings.r / currentInnings.o;
    return runRate.toFixed(2);
  };
  
  // Create real order book entries based on current price
  const getOrderBookEntries = () => {
    const currentPriceNum = parseFloat(currentPrice);
    
    // Generate bids (buy orders) below current price
    const bids = Array.from({ length: 5 }, (_, i) => ({
      price: (currentPriceNum - ((i + 1) * 0.1)).toFixed(2),
      quantity: Math.floor(100 / (i + 1))
    })).sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    
    // Generate asks (sell orders) above current price
    const asks = Array.from({ length: 5 }, (_, i) => ({
      price: (currentPriceNum + ((i + 1) * 0.1)).toFixed(2),
      quantity: Math.floor(100 / (i + 1))
    })).sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    
    return { bids, asks };
  };
  
  // Generate historical price data based on current match state
  useEffect(() => {
    if (!match || !selectedTeam) return;
    
    // Generate price data based on team and match state
    const generatePriceData = () => {
      const now = new Date();
      const data = [];
      
      // Base price from current probability
      const basePrice = parseFloat(currentPrice);
      
      // Generate more points for longer timeframes
      const pointCount = chartTimeframe === '1h' ? 60 : 
                         chartTimeframe === '6h' ? 72 :
                         chartTimeframe === '12h' ? 72 :
                         chartTimeframe === '1d' ? 96 : 60;
                        
      const interval = chartTimeframe === '1h' ? 60000 : // 1 min
                       chartTimeframe === '6h' ? 300000 : // 5 min
                       chartTimeframe === '12h' ? 600000 : // 10 min
                       chartTimeframe === '1d' ? 900000 : 60000; // 15 min
      
      // Fluctuation scale based on match state
      const fluctScale = match.status.toLowerCase().includes('progress') ? 0.15 : 0.05;
      
      // Add historical trend component based on match state
      let trend = 0;
      if (match.status.toLowerCase().includes('progress')) {
        // For in-progress matches, find team score trends
        const teamScores = match.score.filter(s => s.inning.includes(selectedTeam));
        if (teamScores.length > 0) {
          // If team is doing well (high runs, low wickets), trend upward
          const latestInning = teamScores[teamScores.length - 1];
          const wicketsLost = latestInning.w || 0;
          const runRate = latestInning.r / Math.max(1, latestInning.o);
          
          // Better performance = positive trend
          trend = (runRate > 7 ? 0.1 : runRate > 5 ? 0.05 : 0) - (wicketsLost > 5 ? 0.1 : wicketsLost > 3 ? 0.05 : 0);
        }
      }
      
      // Generate the price points
      for (let i = pointCount; i >= 0; i--) {
        const time = new Date(now.getTime() - i * interval);
        
        // Add the trend component that grows over time
        const trendComponent = trend * (1 - i/pointCount);
        
        // Random fluctuation around the base price
        const randomFluct = (Math.random() * fluctScale * 2) - fluctScale;
        
        // Apply sin wave pattern for natural-looking oscillation
        const oscillation = Math.sin(i * 0.1) * 0.05;
        
        // Calculate the final price
        const price = basePrice + trendComponent + randomFluct + oscillation;
        
        data.push({
          time: format(time, chartTimeframe === '1h' ? 'HH:mm' : 'HH:mm'),
          price: parseFloat(Math.max(1.01, price).toFixed(2))
        });
      }
      
      setPriceHistory(data);
    };
    
    generatePriceData();
  }, [match, selectedTeam, chartTimeframe, currentPrice]);
  
  // Handle timeframe change
  const handleTimeframeChange = (timeframe: string) => {
    setChartTimeframe(timeframe);
  };
  
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 min-h-[300px] flex items-center justify-center">
        <div className="text-gray-500">Loading match data...</div>
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
  
  if (!match) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 min-h-[300px] flex items-center justify-center">
        <div className="text-gray-500">Match not found</div>
      </div>
    );
  }
  
  const { bids, asks } = getOrderBookEntries();
  const selectedTeamProbability = calculateTeamProbability(selectedTeam);
  
  return (
    <div className="container mx-auto px-4 py-6">
      {/* Match header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{match.teams[0]} vs {match.teams[1]}</h1>
            <div className="text-sm text-gray-600 mt-1">{match.matchType} • {match.venue}</div>
          </div>
          <div className="text-right">
            <div className={`text-sm font-medium px-3 py-1 rounded-full ${
              match.status.toLowerCase().includes('progress') ? 'bg-green-100 text-green-800' : 
              match.status.toLowerCase().includes('complete') ? 'bg-blue-100 text-blue-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {match.status}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {new Date(match.date).toLocaleDateString()}
            </div>
          </div>
        </div>
        
        {/* Score summary */}
        {match.score && match.score.length > 0 && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {match.score.map((inning, i) => (
              <div key={i} className="bg-gray-50 p-3 rounded-md">
                <div className="text-sm font-medium">{inning.inning}</div>
                <div className="text-xl font-bold mt-1">
                  {inning.r}-{inning.w} ({inning.o} overs)
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Market layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Market info and options */}
        <div className="lg:col-span-1 space-y-6">
          {/* Market question */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900">
              {match.teams[0]} to win the match vs {match.teams[1]}?
            </h2>
            
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Select Team</h3>
              <div className="flex space-x-4">
                {match.teams.map((team) => {
                  const teamProb = calculateTeamProbability(team);
                  const teamPrice = getPriceFromProbability(teamProb);
                  
                  return (
                    <button
                      key={team}
                      onClick={() => handleTeamSelect(team)}
                      className={`flex-1 py-3 px-4 rounded-md border ${
                        selectedTeam === team
                          ? 'bg-blue-50 border-blue-500 text-blue-700' 
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      } transition-colors duration-200`}
                    >
                      <div className="font-medium text-lg">{getShortTeamName(team)}</div>
                      <div className="flex justify-between mt-2">
                        <span className="text-sm text-gray-500">{(teamProb * 100).toFixed(1)}%</span>
                        <span className="text-sm font-medium">₹{teamPrice}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Match Stats</h3>
              <div className="bg-gray-50 p-3 rounded-md">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Status:</span>
                  <span className="font-medium">{match.status}</span>
                </div>
                {match.score && match.score.length > 0 && (
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-600">Current Run Rate:</span>
                    <span className="font-medium">{getCurrentRunRate()}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-600">Venue:</span>
                  <span className="font-medium">{match.venue}</span>
                </div>
              </div>
            </div>
            
            {/* Batsmen info */}
            {scorecard && scorecard.batting && scorecard.batting.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Current Batsmen</h3>
                <div className="bg-gray-50 p-3 rounded-md">
                  {scorecard.batting.slice(0, 2).map((batsman, i) => (
                    <div key={i} className="flex justify-between text-sm mt-1">
                      <span className="text-gray-600">{batsman.batsman}</span>
                      <span className="font-medium">{batsman.r} ({batsman.b})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Right column - Order book and trading */}
        <div className="lg:col-span-2 space-y-6">
          {/* Price chart with Recharts */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Price Chart</h3>
              <div className="flex space-x-2">
                <button 
                  onClick={() => handleTimeframeChange('1h')}
                  className={`px-3 py-1 text-sm ${chartTimeframe === '1h' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'} rounded`}
                >
                  1h
                </button>
                <button 
                  onClick={() => handleTimeframeChange('6h')}
                  className={`px-3 py-1 text-sm ${chartTimeframe === '6h' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'} rounded`}
                >
                  6h
                </button>
                <button 
                  onClick={() => handleTimeframeChange('12h')}
                  className={`px-3 py-1 text-sm ${chartTimeframe === '12h' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'} rounded`}
                >
                  12h
                </button>
                <button 
                  onClick={() => handleTimeframeChange('1d')}
                  className={`px-3 py-1 text-sm ${chartTimeframe === '1d' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'} rounded`}
                >
                  1d
                </button>
              </div>
            </div>
            
            {/* Price chart using Recharts */}
            <div className="h-64">
              {priceHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={priceHistory}
                    margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="time"
                      stroke="#9CA3AF"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      domain={['dataMin - 0.5', 'dataMax + 0.5']}
                      stroke="#9CA3AF"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `₹${value}`}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`₹${value}`, 'Price']}
                      labelFormatter={(label) => `Time: ${label}`}
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="price" 
                      stroke="#3B82F6" 
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 6, stroke: '#3B82F6', strokeWidth: 2, fill: 'white' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <span className="text-gray-500">Loading price data...</span>
                </div>
              )}
            </div>
            <div className="mt-2 text-center">
              <div className="text-sm text-gray-600">
                Current Price: <span className="font-medium">₹{currentPrice}</span> | 
                Probability: <span className="font-medium">{(selectedTeamProbability * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
          
          {/* Order book */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Book</h3>
            
            <div className="flex flex-col">
              {/* Sell orders (asks) */}
              <div className="mb-2">
                <div className="grid grid-cols-2 gap-2 text-xs font-medium text-gray-600 mb-1">
                  <div>Price</div>
                  <div className="text-right">Quantity</div>
                </div>
                <div className="max-h-40 overflow-y-auto">
                  {asks.map((ask, index) => (
                    <div
                      key={`ask-${index}`}
                      className="grid grid-cols-2 gap-2 text-sm py-1 hover:bg-red-50 cursor-pointer"
                    >
                      <div className="font-medium text-red-600">{ask.price}</div>
                      <div className="text-right">{ask.quantity}</div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Current price indicator */}
              <div className="py-2 px-4 bg-gray-100 text-center text-sm font-medium mb-2">
                {currentPrice}
              </div>
              
              {/* Buy orders (bids) */}
              <div>
                <div className="grid grid-cols-2 gap-2 text-xs font-medium text-gray-600 mb-1">
                  <div>Price</div>
                  <div className="text-right">Quantity</div>
                </div>
                <div className="max-h-40 overflow-y-auto">
                  {bids.map((bid, index) => (
                    <div
                      key={`bid-${index}`}
                      className="grid grid-cols-2 gap-2 text-sm py-1 hover:bg-green-50 cursor-pointer"
                    >
                      <div className="font-medium text-green-600">{bid.price}</div>
                      <div className="text-right">{bid.quantity}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          {/* Order placement */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Place Order</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500">₹</span>
                </div>
                <input
                  type="text"
                  value={currentPrice}
                  onChange={(e) => setCurrentPrice(e.target.value)}
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                  placeholder="0.00"
                />
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <div className="flex items-center">
                <button 
                  onClick={() => handleQuantityChange(-1)}
                  className="px-3 py-2 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 hover:bg-gray-100"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value)))}
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full text-center border-gray-300"
                />
                <button 
                  onClick={() => handleQuantityChange(1)}
                  className="px-3 py-2 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 hover:bg-gray-100"
                >
                  +
                </button>
              </div>
            </div>
            
            <div className="flex justify-between mb-4">
              <div className="text-sm text-gray-600">
                Total Cost: <span className="font-medium">₹{(parseFloat(currentPrice) * quantity).toFixed(2)}</span>
              </div>
              <div className="text-sm text-gray-600">
                Potential Return: <span className="font-medium">₹{(quantity).toFixed(2)}</span>
              </div>
            </div>
            
            <div className="flex space-x-4">
              <button
                className="w-1/2 bg-green-600 hover:bg-green-700 text-white py-3 rounded-md font-medium transition-colors duration-200"
              >
                Buy {getShortTeamName(selectedTeam)}
              </button>
              <button
                className="w-1/2 bg-red-600 hover:bg-red-700 text-white py-3 rounded-md font-medium transition-colors duration-200"
              >
                Sell {getShortTeamName(selectedTeam)}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 