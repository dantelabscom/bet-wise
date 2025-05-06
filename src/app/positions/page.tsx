'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import DashboardHeader from '@/components/dashboard/Header';
import { Position, calculatePositionValue, PositionCalculation } from '@/lib/models/position';

export default function PositionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [positions, setPositions] = useState<Array<Position & { metrics: PositionCalculation }>>([]);
  const [loading, setLoading] = useState(true);
  
  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);
  
  // Fetch user positions
  useEffect(() => {
    const fetchPositions = async () => {
      if (status !== 'authenticated') return;
      
      try {
        setLoading(true);
        const response = await fetch('/api/positions');
        
        if (!response.ok) {
          throw new Error('Failed to fetch positions');
        }
        
        const data = await response.json();
        setPositions(data.positions || []);
      } catch (error) {
        console.error('Error fetching positions:', error);
        toast.error('Failed to load positions');
      } finally {
        setLoading(false);
      }
    };
    
    fetchPositions();
  }, [status]);
  
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!session) {
    return null; // Will redirect in the useEffect
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">My Positions</h1>
          <p className="text-gray-600">Manage your current market positions</p>
        </div>
        
        {positions.length === 0 ? (
          <div className="rounded-lg bg-white p-8 shadow-md text-center">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No Positions Found</h2>
            <p className="text-gray-600 mb-4">You don't have any open positions yet.</p>
            <Link 
              href="/markets" 
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Explore Markets
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="rounded-lg bg-white p-6 shadow-md">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Portfolio Value</h2>
                <div className="text-2xl font-bold text-blue-600">
                  ${positions.reduce((sum, pos) => sum + parseFloat(pos.metrics.currentMarketValue), 0).toFixed(2)}
                </div>
                <div className="mt-1 text-sm text-gray-500">
                  {positions.length} Active Position{positions.length !== 1 ? 's' : ''}
                </div>
              </div>
              
              <div className="rounded-lg bg-white p-6 shadow-md">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Total P&L</h2>
                <div className={`text-2xl font-bold ${getTotalPnlClass(positions)}`}>
                  ${getTotalPnl(positions).toFixed(2)}
                </div>
                <div className="mt-1 text-sm text-gray-500">
                  Unrealized: ${positions.reduce((sum, pos) => sum + parseFloat(pos.metrics.unrealizedPnl), 0).toFixed(2)}
                </div>
              </div>
              
              <div className="rounded-lg bg-white p-6 shadow-md">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Cost Basis</h2>
                <div className="text-2xl font-bold text-gray-900">
                  ${positions.reduce((sum, pos) => sum + parseFloat(pos.metrics.costBasis), 0).toFixed(2)}
                </div>
              </div>
            </div>
            
            {/* Positions Table */}
            <div className="overflow-hidden rounded-lg bg-white shadow">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Market / Option
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Avg. Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Current Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Market Value
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Unrealized P&L
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {positions.map((position) => (
                      <tr key={position.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{position.market?.name}</div>
                          <div className="text-sm text-gray-500">{position.marketOption?.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {parseFloat(position.quantity).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          ${parseFloat(position.metrics.averagePrice).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          ${parseFloat(position.marketOption?.currentPrice || '0').toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          ${parseFloat(position.metrics.currentMarketValue).toFixed(2)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap ${getPnlClass(position.metrics.unrealizedPnl)}`}>
                          <div className="flex items-center">
                            <span>
                              ${parseFloat(position.metrics.unrealizedPnl).toFixed(2)}
                            </span>
                            <span className="ml-1 text-xs">
                              ({getPnlPercentage(position.metrics.unrealizedPnl, position.metrics.costBasis)}%)
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link 
                            href={`/markets/${position.marketId}/trade?option=${position.marketOptionId}&side=sell`} 
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            Trade
                          </Link>
                          <Link 
                            href={`/markets/${position.marketId}`} 
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View Market
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Helper functions
function getTotalPnl(positions: Array<Position & { metrics: PositionCalculation }>): number {
  return positions.reduce((sum, pos) => {
    return sum + parseFloat(pos.metrics.totalPnl);
  }, 0);
}

function getTotalPnlClass(positions: Array<Position & { metrics: PositionCalculation }>): string {
  const totalPnl = getTotalPnl(positions);
  
  if (totalPnl > 0) return 'text-green-600';
  if (totalPnl < 0) return 'text-red-600';
  return 'text-gray-600';
}

function getPnlClass(pnl: string): string {
  const value = parseFloat(pnl);
  
  if (value > 0) return 'text-green-600';
  if (value < 0) return 'text-red-600';
  return 'text-gray-600';
}

function getPnlPercentage(pnl: string, costBasis: string): string {
  const pnlValue = parseFloat(pnl);
  const costBasisValue = parseFloat(costBasis);
  
  if (costBasisValue === 0) return '0.00';
  
  return ((pnlValue / costBasisValue) * 100).toFixed(2);
} 