'use client';

import React, { useState, useEffect } from 'react';
import { useSocket } from '@/lib/hooks/useSocket';

interface BallEvent {
  matchId: string;
  over: number;
  ball: number;
  bowler: string;
  batsman: string;
  runs: number;
  extras: number;
  isWicket: boolean;
  wicketType?: string;
  commentary: string;
  timestamp: number;
  isBoundary: boolean;
  isSix: boolean;
}

interface BallByBallCommentaryProps {
  matchId: string;
}

export default function BallByBallCommentary({ matchId }: BallByBallCommentaryProps) {
  const { socket, isConnected } = useSocket();
  const [ballEvents, setBallEvents] = useState<BallEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Fetch initial ball events and set up listeners
  useEffect(() => {
    if (!socket || !isConnected) return;
    
    // Join the match room
    socket.emit('join:match', matchId);
    
    // Fetch recent balls
    fetch(`/api/sports/cricket/match/${matchId}/balls`)
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.data)) {
          setBallEvents(data.data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching ball events:', err);
        setLoading(false);
      });
    
    // Listen for new ball events
    socket.on('ball:update', (ballEvent: BallEvent) => {
      if (ballEvent.matchId === matchId) {
        setBallEvents(prev => [ballEvent, ...prev].slice(0, 20)); // Keep last 20 balls
      }
    });
    
    // Clean up
    return () => {
      socket.off('ball:update', (ballEvent: BallEvent) => {
        if (ballEvent.matchId === matchId) {
          setBallEvents(prev => [ballEvent, ...prev].slice(0, 20));
        }
      });
    };
  }, [socket, isConnected, matchId]);
  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Helper to get CSS classes for different ball events
  const getBallClasses = (ball: BallEvent): string => {
    if (ball.isWicket) return 'bg-red-100 dark:bg-red-900 border-red-300 dark:border-red-700';
    if (ball.isSix) return 'bg-purple-100 dark:bg-purple-900 border-purple-300 dark:border-purple-700';
    if (ball.isBoundary) return 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700';
    if (ball.runs > 0) return 'bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-800';
    return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
  };
  
  // Helper to get the right ball icon
  const getBallIcon = (ball: BallEvent): string => {
    if (ball.isWicket) return '🔴'; // Red circle for wicket
    if (ball.isSix) return '6️⃣'; // Six
    if (ball.isBoundary) return '4️⃣'; // Four
    return ball.runs.toString(); // Number of runs
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Ball-by-Ball Commentary</h3>
      
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
        </div>
      ) : ballEvents.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No balls have been bowled yet.
        </div>
      ) : (
        <div className="space-y-3">
          {ballEvents.map((ball, index) => (
            <div 
              key={index}
              className={`p-3 border rounded-lg ${getBallClasses(ball)}`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-sm font-semibold">
                  Over {ball.over}.{ball.ball} • {getBallIcon(ball)}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatTime(ball.timestamp)}
                </span>
              </div>
              
              <p className="text-sm">{ball.commentary}</p>
              
              <div className="flex justify-between mt-2 text-xs text-gray-600 dark:text-gray-400">
                <span>Bowler: {ball.bowler}</span>
                <span>Batsman: {ball.batsman}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 