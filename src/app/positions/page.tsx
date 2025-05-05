'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardHeader from '@/components/dashboard/Header';
import toast from 'react-hot-toast';

interface Position {
  id: number;
  marketId: number;
  marketName: string;
  optionId: number;
  optionName: string;
  entryPrice: string;
  currentPrice: string;
  quantity: string;
  side: 'buy' | 'sell';
  status: 'open' | 'closed' | 'settling';
  pnl: string;
  createdAt: string;
}

export default function PositionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('open');

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  // Fetch positions data
  useEffect(() => {
    const fetchPositions = async () => {
      if (status === 'authenticated') {
        try {
          // In a real implementation, we would fetch from the API
          // const response = await fetch('/api/positions');
          // const data = await response.json();
          
          // For now, using mock data
          const mockPositions: Position[] = [
            {
              id: 1,
              marketId: 1,
              marketName: 'Super Bowl Winner 2025',
              optionId: 1,
              optionName: 'Kansas City Chiefs',
              entryPrice: '5.20',
              currentPrice: '5.50',
              quantity: '10',
              side: 'buy',
              status: 'open',
              pnl: '+3.00',
              createdAt: new Date('2023-11-15').toISOString(),
            },
            {
              id: 2,
              marketId: 2,
              marketName: 'NBA Championship 2025',
              optionId: 4,
              optionName: 'Boston Celtics',
              entryPrice: '4.80',
              currentPrice: '4.50',
              quantity: '5',
              side: 'buy',
              status: 'open',
              pnl: '-1.50',
              createdAt: new Date('2023-12-05').toISOString(),
            },
            {
              id: 3,
              marketId: 1,
              marketName: 'Super Bowl Winner 2025',
              optionId: 3,
              optionName: 'Buffalo Bills',
              entryPrice: '8.50',
              currentPrice: '9.00',
              quantity: '8',
              side: 'buy',
              status: 'closed',
              pnl: '+4.00',
              createdAt: new Date('2023-10-20').toISOString(),
            },
          ];
          
          setPositions(mockPositions);
        } catch (error) {
          console.error('Error fetching positions:', error);
          toast.error('Failed to load positions data');
        } finally {
          setLoading(false);
        }
      }
    };

    fetchPositions();
  }, [status]);

  // Filter positions based on filter state
  const filteredPositions = positions.filter(position => {
    if (filter === 'all') return true;
    if (filter === 'open') return position.status === 'open';
    if (filter === 'closed') return position.status === 'closed';
    return true;
  });

  // Calculate total P&L
  const totalPnl = positions.reduce((total, position) => {
    return total + parseFloat(position.pnl);
  }, 0);

  // Format currency
  const formatCurrency = (value: string | number) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return numValue.toFixed(2);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Loading...</h2>
          <p className="text-gray-500">Please wait while we load your positions</p>
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
          <h1 className="text-2xl font-bold text-gray-900">My Positions</h1>
          <p className="text-gray-600">Track and manage your trading positions</p>
        </div>
        
        {/* Summary Card */}
        <div className="mb-8 rounded-lg bg-white p-6 shadow-md">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Total Positions</h3>
              <p className="text-2xl font-bold">{positions.length}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Open Positions</h3>
              <p className="text-2xl font-bold">
                {positions.filter(p => p.status === 'open').length}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Total P&L</h3>
              <p className={`text-2xl font-bold ${
                totalPnl > 0 ? 'text-green-600' : totalPnl < 0 ? 'text-red-600' : 'text-gray-900'
              }`}>
                ${formatCurrency(totalPnl)}
              </p>
            </div>
          </div>
        </div>
        
        {/* Filter Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <div className="flex space-x-8">
            <button
              className={`border-b-2 px-1 pb-4 text-sm font-medium ${
                filter === 'open'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
              onClick={() => setFilter('open')}
            >
              Open Positions
            </button>
            <button
              className={`border-b-2 px-1 pb-4 text-sm font-medium ${
                filter === 'closed'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
              onClick={() => setFilter('closed')}
            >
              Closed Positions
            </button>
            <button
              className={`border-b-2 px-1 pb-4 text-sm font-medium ${
                filter === 'all'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
              onClick={() => setFilter('all')}
            >
              All Positions
            </button>
          </div>
        </div>
        
        {/* Positions Table */}
        {filteredPositions.length > 0 ? (
          <div className="overflow-x-auto rounded-lg bg-white shadow-md">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Market / Option
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Position
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Entry Price
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Current Price
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    P&L
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredPositions.map((position) => (
                  <tr key={position.id}>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="font-medium text-gray-900">{position.marketName}</div>
                      <div className="text-sm text-gray-500">{position.optionName}</div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className={`text-sm font-semibold ${
                        position.side === 'buy' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {position.side === 'buy' ? 'LONG' : 'SHORT'} {position.quantity}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      ${formatCurrency(position.entryPrice)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      ${formatCurrency(position.currentPrice)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className={`text-sm font-semibold ${
                        parseFloat(position.pnl) > 0
                          ? 'text-green-600'
                          : parseFloat(position.pnl) < 0
                          ? 'text-red-600'
                          : 'text-gray-500'
                      }`}>
                        ${formatCurrency(position.pnl)}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        position.status === 'open'
                          ? 'bg-green-100 text-green-800'
                          : position.status === 'closed'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {position.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                      {position.status === 'open' && (
                        <Link
                          href={`/markets/${position.marketId}/trade?option=${position.optionId}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Trade
                        </Link>
                      )}
                      {position.status === 'closed' && (
                        <span className="text-gray-400">Settled</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg bg-white p-8 text-center shadow-md">
            <p className="text-gray-500">No positions found with the selected filter</p>
            <Link 
              href="/markets" 
              className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Explore Markets
            </Link>
          </div>
        )}
      </main>
    </div>
  );
} 