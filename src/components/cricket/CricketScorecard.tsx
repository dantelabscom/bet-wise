"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';

interface Batsman {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  onStrike: boolean;
}

interface Bowler {
  name: string;
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
  currentlyBowling: boolean;
}

interface TeamInnings {
  teamName: string;
  score: number;
  wickets: number;
  overs: number;
  runRate: number;
}

interface CricketScorecardProps {
  matchId: string;
  refreshInterval?: number; // in milliseconds
}

export default function CricketScorecard({ 
  matchId, 
  refreshInterval = 30000  // Default refresh every 30 seconds
}: CricketScorecardProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Match state
  const [matchStatus, setMatchStatus] = useState<string>('');
  const [matchFormat, setMatchFormat] = useState<string>('');
  const [currentInnings, setCurrentInnings] = useState<number>(1);
  const [venue, setVenue] = useState<string>('');
  const [toss, setToss] = useState<string>('');
  
  // Team scores
  const [battingTeam, setBattingTeam] = useState<TeamInnings | null>(null);
  const [bowlingTeam, setBowlingTeam] = useState<TeamInnings | null>(null);
  const [previousInnings, setPreviousInnings] = useState<TeamInnings[]>([]);
  
  // Current players
  const [batsmen, setBatsmen] = useState<Batsman[]>([]);
  const [bowlers, setBowlers] = useState<Bowler[]>([]);
  
  // Recent events (last 5 balls)
  const [recentEvents, setRecentEvents] = useState<string[]>([]);
  
  // Fetch live cricket data
  const fetchCricketData = async () => {
    if (!matchId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/sports/cricket/match/${matchId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch cricket match data');
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to load match data');
      }
      
      // Update match state
      setMatchStatus(data.data.status);
      setMatchFormat(data.data.format);
      setCurrentInnings(data.data.current_innings);
      setVenue(data.data.venue);
      setToss(data.data.toss);
      
      // Update team scores
      if (data.data.batting_team) {
        setBattingTeam({
          teamName: data.data.batting_team.name,
          score: data.data.batting_team.score,
          wickets: data.data.batting_team.wickets,
          overs: data.data.batting_team.overs,
          runRate: data.data.batting_team.run_rate,
        });
      }
      
      if (data.data.bowling_team) {
        setBowlingTeam({
          teamName: data.data.bowling_team.name,
          score: data.data.bowling_team.score,
          wickets: data.data.bowling_team.wickets,
          overs: data.data.bowling_team.overs,
          runRate: data.data.bowling_team.run_rate,
        });
      }
      
      // Update previous innings if any
      if (data.data.previous_innings && Array.isArray(data.data.previous_innings)) {
        setPreviousInnings(data.data.previous_innings.map((inning: any) => ({
          teamName: inning.team_name,
          score: inning.score,
          wickets: inning.wickets,
          overs: inning.overs,
          runRate: inning.run_rate,
        })));
      }
      
      // Update current players
      if (data.data.batsmen && Array.isArray(data.data.batsmen)) {
        setBatsmen(data.data.batsmen.map((batsman: any) => ({
          name: batsman.name,
          runs: batsman.runs,
          balls: batsman.balls,
          fours: batsman.fours,
          sixes: batsman.sixes,
          strikeRate: batsman.strike_rate,
          onStrike: batsman.on_strike,
        })));
      }
      
      if (data.data.bowlers && Array.isArray(data.data.bowlers)) {
        setBowlers(data.data.bowlers.map((bowler: any) => ({
          name: bowler.name,
          overs: bowler.overs,
          maidens: bowler.maidens,
          runs: bowler.runs,
          wickets: bowler.wickets,
          economy: bowler.economy,
          currentlyBowling: bowler.currently_bowling,
        })));
      }
      
      // Update recent events
      if (data.data.recent_balls && Array.isArray(data.data.recent_balls)) {
        setRecentEvents(data.data.recent_balls);
      }
      
    } catch (err) {
      console.error('Error fetching cricket data:', err);
      setError('Failed to load match data');
      toast.error('Failed to load match data');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch on initial load and at the refresh interval
  useEffect(() => {
    fetchCricketData();
    
    const interval = setInterval(() => {
      fetchCricketData();
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [matchId, refreshInterval]);
  
  if (loading && !battingTeam) {
    return (
      <div className="rounded-lg bg-white p-4 shadow-md">
        <div className="mb-2 text-lg font-semibold text-gray-900">Match Scorecard</div>
        <div className="flex h-40 items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="rounded-lg bg-white p-4 shadow-md">
        <div className="mb-2 text-lg font-semibold text-gray-900">Match Scorecard</div>
        <div className="text-red-500">{error}</div>
        <button 
          onClick={fetchCricketData}
          className="mt-2 rounded bg-blue-500 px-3 py-1 text-white hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }
  
  return (
    <div className="rounded-lg bg-white p-4 shadow-md space-y-4">
      {/* Match info header */}
      <div className="border-b pb-2">
        <h2 className="text-lg font-semibold text-gray-900">Match Scorecard</h2>
        <div className="flex justify-between text-sm text-gray-600">
          <div>
            <span className="font-medium">{matchFormat}</span> • <span>{venue}</span>
          </div>
          <div>
            <span className={`font-medium ${
              matchStatus === 'in_progress' ? 'text-green-600' : 
              matchStatus === 'complete' ? 'text-blue-600' : 'text-orange-600'
            }`}>
              {matchStatus === 'in_progress' ? 'LIVE' : 
               matchStatus === 'complete' ? 'COMPLETED' : 'UPCOMING'}
            </span>
          </div>
        </div>
        {toss && <div className="text-xs text-gray-500 mt-1">{toss}</div>}
      </div>
      
      {/* Current innings score */}
      {battingTeam && (
        <div className="p-3 bg-gray-50 rounded-md">
          <div className="flex justify-between items-center">
            <div>
              <span className="font-bold text-lg">{battingTeam.teamName}</span>
              <span className="text-2xl font-bold ml-2">
                {battingTeam.score}-{battingTeam.wickets}
              </span>
              <span className="text-sm ml-2">
                ({battingTeam.overs} overs)
              </span>
            </div>
            <div className="text-sm">
              <span className="font-medium">RR: </span>
              <span>{battingTeam.runRate.toFixed(2)}</span>
            </div>
          </div>
          
          {/* Previous innings scores */}
          {previousInnings.length > 0 && (
            <div className="mt-2 text-sm text-gray-600 border-t pt-1">
              {previousInnings.map((innings, index) => (
                <div key={index} className="flex justify-between">
                  <div>
                    <span className="font-medium">{innings.teamName}</span>
                    <span className="ml-2">
                      {innings.score}-{innings.wickets} ({innings.overs} overs)
                    </span>
                  </div>
                  <div>RR: {innings.runRate.toFixed(2)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Current batsmen */}
      {batsmen.length > 0 && (
        <div className="mt-4">
          <h3 className="text-md font-medium text-gray-800 mb-2">Batsmen</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 tracking-wider">
                    Batsman
                  </th>
                  <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 tracking-wider">
                    R
                  </th>
                  <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 tracking-wider">
                    B
                  </th>
                  <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 tracking-wider">
                    4s
                  </th>
                  <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 tracking-wider">
                    6s
                  </th>
                  <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 tracking-wider">
                    SR
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {batsmen.map((batsman, index) => (
                  <tr key={index}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">
                      {batsman.name} {batsman.onStrike && <span className="text-xs text-blue-600">*</span>}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-right">
                      {batsman.runs}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-right">
                      {batsman.balls}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-right">
                      {batsman.fours}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-right">
                      {batsman.sixes}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-right">
                      {batsman.strikeRate.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Current bowlers */}
      {bowlers.length > 0 && (
        <div className="mt-4">
          <h3 className="text-md font-medium text-gray-800 mb-2">Bowlers</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 tracking-wider">
                    Bowler
                  </th>
                  <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 tracking-wider">
                    O
                  </th>
                  <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 tracking-wider">
                    M
                  </th>
                  <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 tracking-wider">
                    R
                  </th>
                  <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 tracking-wider">
                    W
                  </th>
                  <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 tracking-wider">
                    Econ
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {bowlers.map((bowler, index) => (
                  <tr key={index}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">
                      {bowler.name} {bowler.currentlyBowling && <span className="text-xs text-green-600">*</span>}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-right">
                      {bowler.overs.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-right">
                      {bowler.maidens}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-right">
                      {bowler.runs}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-right">
                      {bowler.wickets}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-right">
                      {bowler.economy.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Recent events */}
      {recentEvents.length > 0 && (
        <div className="mt-4">
          <h3 className="text-md font-medium text-gray-800 mb-2">Recent Balls</h3>
          <div className="flex space-x-2">
            {recentEvents.map((event, index) => (
              <div
                key={index}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  event === 'W' ? 'bg-red-100 text-red-600' :
                  event === '6' ? 'bg-purple-100 text-purple-600' :
                  event === '4' ? 'bg-blue-100 text-blue-600' :
                  event === '0' ? 'bg-gray-100 text-gray-600' :
                  'bg-green-100 text-green-600'
                }`}
              >
                {event}
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="text-xs text-gray-500 text-right pt-2">
        Last updated: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
} 