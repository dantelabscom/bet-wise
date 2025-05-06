import { Suspense } from 'react';
import AdvancedTradeClient from '@/components/markets/AdvancedTradeClient';

export const metadata = {
  title: 'Advanced Trading | Jinzo',
  description: 'Advanced trading interface for placing orders',
};

interface AdvancedTradePageProps {
  params: {
    id: string;
  };
  searchParams: {
    option?: string;
    side?: string;
  };
}

export default async function AdvancedTradePage({ params, searchParams }: AdvancedTradePageProps) {
  const marketId = params.id;
  const optionId = searchParams.option;
  const side = searchParams.side;
  
  return (
    <Suspense fallback={<div className="h-96 flex items-center justify-center">Loading trading interface...</div>}>
      <AdvancedTradeClient 
        marketId={marketId} 
        initialOptionId={optionId} 
        initialSide={side === 'buy' || side === 'sell' ? side : undefined} 
      />
    </Suspense>
  );
} 