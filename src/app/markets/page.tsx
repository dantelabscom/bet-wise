'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardHeader from '@/components/dashboard/Header';
import toast from 'react-hot-toast';

interface Sport {
  id: number;
  name: string;
  type: string;
}

interface MarketOption {
  id: number;
  name: string;
  currentPrice: string;
}

interface Market {
  id: number;
  name: string;
  description: string;
  status: string;
  event: {
    id: number;
    name: string;
    startTime: string;
    endTime: string;
  };
  sport: Sport;
  options: MarketOption[];
  createdAt: string;
}

export default function MarketsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState<number | null>(null);
  
  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  // Fetch markets data
  useEffect(() => {
    const fetchMarkets = async () => {
      if (status === 'authenticated') {
        try {
          // In a real implementation, we would fetch from the API
          // const response = await fetch('/api/markets');
          // const data = await response.json();
          
          // For now, using mock data
          const mockMarkets: Market[] = [
            {
              id: 1,
              name: 'Super Bowl Winner 2025',
              description: 'Predict the winner of Super Bowl LIX in February 2025',
              status: 'open',
              event: {
                id: 1,
                name: 'Super Bowl LIX',
                startTime: new Date('2025-02-09T23:30:00Z').toISOString(),
                endTime: new Date('2025-02-10T03:30:00Z').toISOString(),
              },
              sport: {
                id: 1,
                name: 'Football',
                type: 'football',
              },
              options: [
                { id: 1, name: 'Kansas City Chiefs', currentPrice: '5.50' },
                { id: 2, name: 'San Francisco 49ers', currentPrice: '6.20' },
                { id: 3, name: 'Buffalo Bills', currentPrice: '9.00' },
              ],
              createdAt: new Date().toISOString(),
            },
            {
              id: 2,
              name: 'NBA Championship 2025',
              description: 'Predict the winner of the 2024-2025 NBA season',
              status: 'open',
              event: {
                id: 2,
                name: 'NBA Finals 2025',
                startTime: new Date('2025-06-01T00:00:00Z').toISOString(),
                endTime: new Date('2025-06-20T00:00:00Z').toISOString(),
              },
              sport: {
                id: 2,
                name: 'Basketball',
                type: 'basketball',
              },
              options: [
                { id: 4, name: 'Boston Celtics', currentPrice: '4.50' },
                { id: 5, name: 'Denver Nuggets', currentPrice: '5.00' },
                { id: 6, name: 'Los Angeles Lakers', currentPrice: '8.00' },
              ],
              createdAt: new Date().toISOString(),
            },
          ];
          
          setMarkets(mockMarkets);
          
          // Extract unique sports from markets
          const uniqueSports = Array.from(
            new Map(mockMarkets.map(market => [market.sport.id, market.sport])).values()
          );
          setSports(uniqueSports);
          
        } catch (error) {
          console.error('Error fetching markets:', error);
          toast.error('Failed to load markets data');
        } finally {
          setLoading(false);
        }
      }
    };

    fetchMarkets();
  }, [status]);

  // Filter markets based on selected sport
  const filteredMarkets = selectedSport
    ? markets.filter(market => market.sport.id === selectedSport)
    : markets;

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Loading...</h2>
          <p className="text-gray-500">Please wait while we load markets data</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null; // Will redirect in the useEffect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader user={session.user} />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Markets</h1>
          <p className="text-gray-600">Explore available markets and place your trades</p>
        </div>
        
        {/* Filters */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              className={`rounded-md px-4 py-2 text-sm ${
                selectedSport === null
                  ? 'bg-blue-600 text-white'
                  : 'border border-gray-300 bg-white text-gray-700'
              }`}
              onClick={() => setSelectedSport(null)}
            >
              All Sports
            </button>
            
            {sports.map(sport => (
              <button
                key={sport.id}
                className={`rounded-md px-4 py-2 text-sm ${
                  selectedSport === sport.id
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-300 bg-white text-gray-700'
                }`}
                onClick={() => setSelectedSport(sport.id)}
              >
                {sport.name}
              </button>
            ))}
          </div>
        </div>
        
        {/* Markets List */}
        <div className="space-y-6">
          {filteredMarkets.length > 0 ? (
            filteredMarkets.map(market => (
              <div key={market.id} className="overflow-hidden rounded-lg bg-white shadow-md">
                <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="inline-block rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                        {market.sport.name}
                      </span>
                      <span className="ml-2 inline-block rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                        {market.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      Event Date: {formatDate(market.event.startTime)}
                    </div>
                  </div>
                  <h2 className="mt-2 text-xl font-semibold text-gray-900">
                    <Link href={`/markets/${market.id}`} className="hover:text-blue-600">
                      {market.name}
                    </Link>
                  </h2>
                  <p className="mt-1 text-gray-600">{market.description}</p>
                </div>
                
                <div className="px-6 py-4">
                  <h3 className="mb-3 text-sm font-medium text-gray-700">Top Options</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {market.options.map(option => (
                      <div
                        key={option.id}
                        className="cursor-pointer rounded-md border border-gray-200 p-3 hover:border-blue-300 hover:bg-blue-50"
                      >
                        <div className="mb-1 font-medium">{option.name}</div>
                        <div className="flex items-center justify-between">
                          <div className="text-lg font-semibold">{parseFloat(option.currentPrice).toFixed(2)}</div>
                          <Link
                            href={`/markets/${market.id}/trade?option=${option.id}`}
                            className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                          >
                            Trade
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-4 text-right">
                    <Link
                      href={`/markets/${market.id}`}
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      View Full Market →
                    </Link>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg bg-white p-8 text-center shadow-md">
              <p className="text-gray-500">No markets found with the selected filter</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 