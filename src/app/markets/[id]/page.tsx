import { Suspense } from 'react';
import MarketDetailClient from '@/components/markets/MarketDetailClient';

export const metadata = {
  title: 'Market Details | Jinzo',
  description: 'View details and trade on a specific market',
};

interface MarketDetailPageProps {
  params: {
    id: string;
  };
}

export default async function MarketDetailPage({ params }: MarketDetailPageProps) {
  const marketId = params.id;
  
  return (
    <Suspense fallback={<div className="h-96 flex items-center justify-center">Loading market details...</div>}>
      <MarketDetailClient marketId={marketId} />
    </Suspense>
  );
} 