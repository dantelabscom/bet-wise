import { Suspense } from 'react';
import LiveGameView from '@/components/sports/LiveGameView';

export const metadata = {
  title: 'Live Game | BetWise',
  description: 'View live sports game data and markets on BetWise',
};

interface LiveGamePageProps {
  params: {
    gameId: string;
  };
  searchParams: {
    sport?: string;
  };
}

export default function LiveGamePage({ params, searchParams }: LiveGamePageProps) {
  const { gameId } = params;
  const sport = searchParams.sport || 'nba';
  
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Live Game View</h1>
      
      <div className="grid grid-cols-1 gap-8">
        {/* Live Game View */}
        <Suspense fallback={<div className="h-96 flex items-center justify-center">Loading game data...</div>}>
          <LiveGameView gameId={gameId} sport={sport} />
        </Suspense>
        
        {/* Markets for this game would be displayed here */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Available Markets</h2>
          <p className="text-gray-600">
            Explore and trade on available markets for this game.
          </p>
          {/* Market components would be included here */}
        </div>
      </div>
    </div>
  );
} 