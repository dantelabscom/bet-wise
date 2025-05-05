import { Suspense } from 'react';
import UpcomingGames from '@/components/sports/UpcomingGames';

export const metadata = {
  title: 'Sports | BetWise',
  description: 'View upcoming and live sports games on BetWise',
};

export default function SportsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Sports Markets</h1>
      
      <div className="grid grid-cols-1 gap-8">
        {/* Upcoming Games */}
        <Suspense fallback={<div className="h-96 flex items-center justify-center">Loading...</div>}>
          <UpcomingGames />
        </Suspense>
      </div>
    </div>
  );
} 