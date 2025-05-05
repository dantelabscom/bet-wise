'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardHeader from '@/components/dashboard/Header';
import toast from 'react-hot-toast';

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
  sport: {
    id: number;
    name: string;
    type: string;
  };
  options: MarketOption[];
  createdAt: string;
}

interface MarketDetailPageProps {
  params: {
    id: string;
  };
}

export default function MarketDetailPage({ params }: MarketDetailPageProps) {
  const marketId = params.id;
  const { data: session, status } = useSession();
  const router = useRouter();
  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState<MarketOption | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  // Fetch market data
  useEffect(() => {
    const fetchMarket = async () => {
      if (status === 'authenticated') {
        try {
          // Simulating API call with mock data for now
          // In a real implementation, we would fetch from the API:
          // const response = await fetch(`/api/markets/${marketId}`);
          // const data = await response.json();
          
          // Mock data
          const mockMarket: Market = {
            id: Number(marketId),
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
              { id: 4, name: 'Baltimore Ravens', currentPrice: '10.00' },
              { id: 5, name: 'Detroit Lions', currentPrice: '12.00' },
              { id: 6, name: 'Dallas Cowboys', currentPrice: '15.00' },
            ],
            createdAt: new Date().toISOString(),
          };
          
          setMarket(mockMarket);
          
          // Set first option as selected by default
          if (mockMarket.options.length > 0) {
            setSelectedOption(mockMarket.options[0]);
          }
          
        } catch (error) {
          console.error('Error fetching market:', error);
          toast.error('Failed to load market data');
        } finally {
          setLoading(false);
        }
      }
    };

    fetchMarket();
  }, [status, marketId]);

  const handleOptionClick = (option: MarketOption) => {
    setSelectedOption(option);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Loading...</h2>
          <p className="text-gray-500">Please wait while we load market data</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null; // Will redirect in the useEffect
  }

  if (!market) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader user={session.user} />
        <div className="container mx-auto px-4 py-12 text-center">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">Market Not Found</h1>
          <p className="text-gray-600">The market you are looking for does not exist or has been removed.</p>
          <Link 
            href="/markets" 
            className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Browse All Markets
          </Link>
        </div>
      </div>
    );
  }

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader user={session.user} />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link 
            href="/markets" 
            className="inline-flex items-center text-sm text-blue-600 hover:underline"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="mr-1 h-4 w-4" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to All Markets
          </Link>
        </div>
        
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Market Info */}
          <div className="md:col-span-2">
            <div className="rounded-lg bg-white p-6 shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <span className="inline-block rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                    {market.sport.name}
                  </span>
                  <span className="ml-2 inline-block rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                    {market.status.toUpperCase()}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  ID: {market.id}
                </div>
              </div>
              
              <h1 className="mb-2 text-2xl font-bold text-gray-900">{market.name}</h1>
              
              <p className="mb-4 text-gray-600">{market.description}</p>
              
              <div className="mb-4 space-y-1 text-sm text-gray-600">
                <p>
                  <span className="font-medium">Event:</span> {market.event.name}
                </p>
                <p>
                  <span className="font-medium">Start Time:</span> {formatDate(market.event.startTime)}
                </p>
                <p>
                  <span className="font-medium">End Time:</span> {market.event.endTime ? formatDate(market.event.endTime) : 'TBD'}
                </p>
              </div>
              
              <h2 className="mb-3 text-lg font-semibold">Market Options</h2>
              
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {market.options.map(option => (
                  <div 
                    key={option.id}
                    className={`cursor-pointer rounded-md border p-3 transition-colors ${
                      selectedOption?.id === option.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                    onClick={() => handleOptionClick(option)}
                  >
                    <div className="mb-1 font-medium">{option.name}</div>
                    <div className="text-lg font-semibold">{parseFloat(option.currentPrice).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Trading Panel */}
          <div>
            <div className="sticky top-4 rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-4 text-lg font-semibold">Place an Order</h2>
              
              {selectedOption ? (
                <>
                  <div className="mb-4 rounded-md bg-gray-50 p-3">
                    <div className="text-sm text-gray-600">Selected Option</div>
                    <div className="font-medium">{selectedOption.name}</div>
                    <div className="text-lg font-semibold">{parseFloat(selectedOption.currentPrice).toFixed(2)}</div>
                  </div>
                  
                  <Link 
                    href={`/markets/${market.id}/trade?option=${selectedOption.id}`}
                    className="block w-full rounded-md bg-blue-600 px-4 py-2 text-center font-medium text-white hover:bg-blue-700"
                  >
                    Trade Now
                  </Link>
                </>
              ) : (
                <div className="text-gray-500">
                  Select an option to trade
                </div>
              )}
              
              <hr className="my-4 border-gray-200" />
              
              <div className="text-sm text-gray-600">
                <h3 className="mb-2 font-medium">About Trading</h3>
                <ul className="list-inside list-disc space-y-1">
                  <li>Buy and sell positions on this market</li>
                  <li>Prices fluctuate based on market activity</li>
                  <li>Winning positions pay out at 1.00</li>
                  <li>Losing positions are valued at 0.00</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 