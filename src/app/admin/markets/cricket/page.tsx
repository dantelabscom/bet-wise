"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';
import DashboardHeader from '@/components/dashboard/Header';

interface Match {
  id: string;
  name: string;
  scheduledTime: string;
  status: string;
  teams: {
    home: string;
    away: string;
  };
  tournament: string;
}

export default function CricketMarketsAdmin() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [marketTypes, setMarketTypes] = useState({
    match_winner: true,
    total_runs: true,
    innings_score: true,
    player_performance: false,
    wickets: false,
    next_dismissal: false,
  });
  const [creatingMarkets, setCreatingMarkets] = useState(false);
  
  // Check if user is authenticated and redirect if not
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);
  
  // Fetch upcoming cricket matches
  const fetchUpcomingMatches = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/sports/upcoming?sport=cricket&days=7');
      
      if (!response.ok) {
        throw new Error('Failed to fetch upcoming matches');
      }
      
      const { data } = await response.json();
      
      // Transform the data to our local format
      const matches = data.map((match: any) => ({
        id: match.gameId,
        name: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
        scheduledTime: match.startTime,
        status: match.status,
        teams: {
          home: match.homeTeam.name,
          away: match.awayTeam.name,
        },
        tournament: match.leagueId,
      }));
      
      setUpcomingMatches(matches);
    } catch (error) {
      console.error('Error fetching upcoming matches:', error);
      toast.error('Failed to load upcoming matches');
    } finally {
      setLoading(false);
    }
  };
  
  // Create markets for the selected match
  const createMarkets = async () => {
    if (!selectedMatch) {
      toast.error('Please select a match first');
      return;
    }
    
    try {
      setCreatingMarkets(true);
      
      // Determine which market types to create
      const selectedMarketTypes = Object.entries(marketTypes)
        .filter(([_, isSelected]) => isSelected)
        .map(([type, _]) => type);
      
      if (selectedMarketTypes.length === 0) {
        toast.error('Please select at least one market type');
        return;
      }
      
      // Call the API to create markets
      const response = await fetch('/api/markets/cricket/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matchId: selectedMatch,
          sportId: 1, // Assuming cricket is sport ID 1, adjust as needed
          createMarketTypes: selectedMarketTypes,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create markets');
      }
      
      const data = await response.json();
      
      toast.success(data.message || 'Markets created successfully');
      
      // Reset selected match after creation
      setSelectedMatch(null);
    } catch (error: any) {
      console.error('Error creating markets:', error);
      toast.error(error.message || 'Failed to create markets');
    } finally {
      setCreatingMarkets(false);
    }
  };
  
  // Toggle market type selection
  const toggleMarketType = (type: string) => {
    setMarketTypes(prev => ({
      ...prev,
      [type]: !prev[type as keyof typeof prev],
    }));
  };
  
  // Fetch upcoming matches on initial load
  useEffect(() => {
    if (session) {
      fetchUpcomingMatches();
    }
  }, [session]);
  
  if (status === 'loading' || !session) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Cricket Markets Administration</h1>
          <Link 
            href="/admin/markets/cricket/enable-all"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md"
          >
            Enable Trading for All Matches
          </Link>
        </div>
        
        {/* Create Markets Form */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-xl font-semibold mb-4">Create Cricket Markets</h2>
          
          {/* Match Selection */}
          <div className="mb-6">
            <label className="block text-gray-700 font-medium mb-2">
              Select Match
            </label>
            <select
              value={selectedMatch || ''}
              onChange={(e) => setSelectedMatch(e.target.value || null)}
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading || creatingMarkets}
            >
              <option value="">-- Select a match --</option>
              {upcomingMatches.map((match) => (
                <option key={match.id} value={match.id}>
                  {match.name} - {new Date(match.scheduledTime).toLocaleString()}
                </option>
              ))}
            </select>
            
            {loading && (
              <div className="text-sm text-gray-500 mt-2">
                Loading matches...
              </div>
            )}
            
            {!loading && upcomingMatches.length === 0 && (
              <div className="text-sm text-red-500 mt-2">
                No upcoming matches found.
              </div>
            )}
          </div>
          
          {/* Market Types Selection */}
          <div className="mb-6">
            <label className="block text-gray-700 font-medium mb-2">
              Market Types to Create
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="match_winner"
                  checked={marketTypes.match_winner}
                  onChange={() => toggleMarketType('match_winner')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled={creatingMarkets}
                />
                <label htmlFor="match_winner" className="ml-2 text-gray-700">
                  Match Winner
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="total_runs"
                  checked={marketTypes.total_runs}
                  onChange={() => toggleMarketType('total_runs')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled={creatingMarkets}
                />
                <label htmlFor="total_runs" className="ml-2 text-gray-700">
                  Total Runs
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="innings_score"
                  checked={marketTypes.innings_score}
                  onChange={() => toggleMarketType('innings_score')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled={creatingMarkets}
                />
                <label htmlFor="innings_score" className="ml-2 text-gray-700">
                  Innings Score
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="player_performance"
                  checked={marketTypes.player_performance}
                  onChange={() => toggleMarketType('player_performance')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled={creatingMarkets}
                />
                <label htmlFor="player_performance" className="ml-2 text-gray-700">
                  Player Performance
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="wickets"
                  checked={marketTypes.wickets}
                  onChange={() => toggleMarketType('wickets')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled={creatingMarkets}
                />
                <label htmlFor="wickets" className="ml-2 text-gray-700">
                  Wickets
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="next_dismissal"
                  checked={marketTypes.next_dismissal}
                  onChange={() => toggleMarketType('next_dismissal')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled={creatingMarkets}
                />
                <label htmlFor="next_dismissal" className="ml-2 text-gray-700">
                  Next Dismissal
                </label>
              </div>
            </div>
          </div>
          
          {/* Create Button */}
          <div className="flex justify-end">
            <button
              onClick={createMarkets}
              disabled={!selectedMatch || creatingMarkets}
              className={`px-4 py-2 rounded font-medium ${
                !selectedMatch || creatingMarkets
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {creatingMarkets ? 'Creating...' : 'Create Markets'}
            </button>
          </div>
        </div>
        
        {/* Refresh Matches Button */}
        <div className="flex justify-end mb-8">
          <button
            onClick={fetchUpcomingMatches}
            disabled={loading}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded font-medium hover:bg-gray-300"
          >
            {loading ? 'Refreshing...' : 'Refresh Matches'}
          </button>
        </div>
        
        {/* Upcoming Matches Table */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Upcoming Cricket Matches</h2>
          
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : upcomingMatches.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No upcoming cricket matches found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Match
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Teams
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Scheduled
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {upcomingMatches.map((match) => (
                    <tr key={match.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {match.tournament}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {match.teams.home} vs {match.teams.away}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(match.scheduledTime).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          match.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                          match.status === 'in_progress' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {match.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button
                          onClick={() => setSelectedMatch(match.id)}
                          className="text-blue-600 hover:text-blue-900"
                          disabled={creatingMarkets}
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 