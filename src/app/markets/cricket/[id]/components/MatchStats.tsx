'use client';

import React, { useState, useEffect } from 'react';
import { useSocket } from '@/lib/hooks/useSocket';

interface TeamStats {
  name: string;
  score: number;
  wickets: number;
  overs: number;
  runRate: number;
}

interface BatsmanStats {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
}

interface BowlerStats {
  name: string;
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
}

interface MatchStatsProps {
  matchId: string;
}

export default function MatchStats({ matchId }: MatchStatsProps) {
  const { socket, isConnected } = useSocket();
  const [battingTeam, setBattingTeam] = useState<TeamStats | null>(null);
  const [bowlingTeam, setBowlingTeam] = useState<TeamStats | null>(null);
  const [batsmen, setBatsmen] = useState<BatsmanStats[]>([]);
  const [bowlers, setBowlers] = useState<BowlerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'batting' | 'bowling'>('summary');
  
  // Fetch match stats on component mount
  useEffect(() => {
    const fetchMatchStats = async () => {
      try {
        const response = await fetch(`/api/sports/cricket/match/${matchId}/stats`);
        if (!response.ok) throw new Error('Failed to fetch match stats');
        
        const data = await response.json();
        if (data.success && data.data) {
          // Process the data
          if (data.data.battingTeam) setBattingTeam(data.data.battingTeam);
          if (data.data.bowlingTeam) setBowlingTeam(data.data.bowlingTeam);
          if (data.data.batsmen) setBatsmen(data.data.batsmen);
          if (data.data.bowlers) setBowlers(data.data.bowlers);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching match stats:', error);
        // Use mock data if API fails
        setMockData();
        setLoading(false);
      }
    };
    
    fetchMatchStats();
    
    // Listen for live updates
    if (socket && isConnected) {
      socket.emit('join:match', matchId);
      
      socket.on('match:update', (data: { matchId: string; battingTeam: React.SetStateAction<TeamStats | null>; bowlingTeam: React.SetStateAction<TeamStats | null>; batsmen: React.SetStateAction<BatsmanStats[]>; bowlers: React.SetStateAction<BowlerStats[]>; }) => {
        if (data.matchId === matchId) {
          if (data.battingTeam) setBattingTeam(data.battingTeam);
          if (data.bowlingTeam) setBowlingTeam(data.bowlingTeam);
          if (data.batsmen) setBatsmen(data.batsmen);
          if (data.bowlers) setBowlers(data.bowlers);
        }
      });
      
      return () => {
        socket.off('match:update');
      };
    }
  }, [matchId, socket, isConnected]);
  
  // Set mock data if API fails
  const setMockData = () => {
    setBattingTeam({
      name: 'Team A',
      score: 142,
      wickets: 3,
      overs: 15.2,
      runRate: 9.26
    });
    
    setBowlingTeam({
      name: 'Team B',
      score: 0,
      wickets: 0,
      overs: 0,
      runRate: 0
    });
    
    setBatsmen([
      {
        name: 'Batsman 1',
        runs: 62,
        balls: 43,
        fours: 7,
        sixes: 2,
        strikeRate: 144.19
      },
      {
        name: 'Batsman 2',
        runs: 48,
        balls: 32,
        fours: 5,
        sixes: 3,
        strikeRate: 150.00
      },
      {
        name: 'Batsman 3',
        runs: 24,
        balls: 18,
        fours: 2,
        sixes: 1,
        strikeRate: 133.33
      }
    ]);
    
    setBowlers([
      {
        name: 'Bowler 1',
        overs: 4,
        maidens: 0,
        runs: 36,
        wickets: 1,
        economy: 9.00
      },
      {
        name: 'Bowler 2',
        overs: 4,
        maidens: 0,
        runs: 28,
        wickets: 2,
        economy: 7.00
      },
      {
        name: 'Bowler 3',
        overs: 4,
        maidens: 0,
        runs: 42,
        wickets: 0,
        economy: 10.50
      }
    ]);
  };
  
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Match Statistics</h3>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">Match Statistics</h3>
      
      {/* Tab navigation */}
      <div className="flex border-b dark:border-gray-700 mb-4">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'summary'
              ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          Summary
        </button>
        <button
          onClick={() => setActiveTab('batting')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'batting'
              ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          Batting
        </button>
        <button
          onClick={() => setActiveTab('bowling')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'bowling'
              ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          Bowling
        </button>
      </div>
      
      {/* Summary tab */}
      {activeTab === 'summary' && (
        <div>
          {/* Batting team stats */}
          {battingTeam && (
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
              <div className="flex justify-between items-center">
                <h4 className="font-semibold">{battingTeam.name} (Batting)</h4>
                <div className="text-lg font-bold">
                  {battingTeam.score}/{battingTeam.wickets}
                </div>
              </div>
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-300 flex justify-between">
                <span>Overs: {battingTeam.overs.toFixed(1)}</span>
                <span>Run Rate: {battingTeam.runRate.toFixed(2)}</span>
              </div>
            </div>
          )}
          
          {/* Bowling team stats */}
          {bowlingTeam && bowlingTeam.score > 0 && (
            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex justify-between items-center">
                <h4 className="font-semibold">{bowlingTeam.name}</h4>
                <div>
                  {bowlingTeam.score}/{bowlingTeam.wickets}
                </div>
              </div>
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-300 flex justify-between">
                <span>Overs: {bowlingTeam.overs.toFixed(1)}</span>
                <span>Run Rate: {bowlingTeam.runRate.toFixed(2)}</span>
              </div>
            </div>
          )}
          
          {/* Current partnership */}
          {batsmen.length >= 2 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">
                Current Partnership
              </h4>
              <div className="p-3 bg-green-50 dark:bg-green-900 rounded-lg">
                <div className="flex justify-between text-sm">
                  <div>
                    <span className="font-medium">{batsmen[0].name}</span>
                    <span className="ml-2">{batsmen[0].runs}({batsmen[0].balls})</span>
                  </div>
                  <div>
                    <span className="font-medium">{batsmen[1].name}</span>
                    <span className="ml-2">{batsmen[1].runs}({batsmen[1].balls})</span>
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                  Partnership: {batsmen[0].runs + batsmen[1].runs} runs
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Batting tab */}
      {activeTab === 'batting' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                <th className="py-2 text-left">Batsman</th>
                <th className="py-2 text-right">R</th>
                <th className="py-2 text-right">B</th>
                <th className="py-2 text-right">4s</th>
                <th className="py-2 text-right">6s</th>
                <th className="py-2 text-right">SR</th>
              </tr>
            </thead>
            <tbody>
              {batsmen.map((batsman, idx) => (
                <tr key={idx} className="border-b dark:border-gray-700">
                  <td className="py-2 font-medium">{batsman.name}</td>
                  <td className="py-2 text-right">{batsman.runs}</td>
                  <td className="py-2 text-right">{batsman.balls}</td>
                  <td className="py-2 text-right">{batsman.fours}</td>
                  <td className="py-2 text-right">{batsman.sixes}</td>
                  <td className="py-2 text-right">{batsman.strikeRate.toFixed(2)}</td>
                </tr>
              ))}
              
              {batsmen.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500 dark:text-gray-400">
                    No batting data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Bowling tab */}
      {activeTab === 'bowling' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                <th className="py-2 text-left">Bowler</th>
                <th className="py-2 text-right">O</th>
                <th className="py-2 text-right">M</th>
                <th className="py-2 text-right">R</th>
                <th className="py-2 text-right">W</th>
                <th className="py-2 text-right">Econ</th>
              </tr>
            </thead>
            <tbody>
              {bowlers.map((bowler, idx) => (
                <tr key={idx} className="border-b dark:border-gray-700">
                  <td className="py-2 font-medium">{bowler.name}</td>
                  <td className="py-2 text-right">{bowler.overs}</td>
                  <td className="py-2 text-right">{bowler.maidens}</td>
                  <td className="py-2 text-right">{bowler.runs}</td>
                  <td className="py-2 text-right">{bowler.wickets}</td>
                  <td className="py-2 text-right">{bowler.economy.toFixed(2)}</td>
                </tr>
              ))}
              
              {bowlers.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500 dark:text-gray-400">
                    No bowling data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
} 