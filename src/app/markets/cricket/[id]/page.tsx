import { Suspense } from 'react';
import CricketMarketView from '@/components/cricket/CricketMarketView';

export const metadata = {
  title: 'Cricket Market | Jinzo',
  description: 'Trade on cricket match outcomes with real-time data',
};

interface CricketMarketPageProps {
  params: {
    id: string;
  };
}

export default function CricketMarketPage({ params }: CricketMarketPageProps) {
  return (
    <div className="container mx-auto py-8">
      <Suspense fallback={<div className="p-4 text-center">Loading cricket market...</div>}>
        <CricketMarketView matchId={params.id} />
      </Suspense>
    </div>
  );
} 