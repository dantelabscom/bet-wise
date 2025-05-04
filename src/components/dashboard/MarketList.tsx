'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// Mock data for initial implementation
const MOCK_MARKETS = [
  {
    id: 1,
    name: 'Super Bowl Winner 2025',
    sport: 'Football',
    options: [
      { id: 1, name: 'Kansas City Chiefs', price: 5.5 },
      { id: 2, name: 'San Francisco 49ers', price: 6.2 },
      { id: 3, name: 'Buffalo Bills', price: 9.0 },
    ],
    endTime: new Date('2025-02-09').toISOString(),
  },
  {
    id: 2,
    name: 'NBA Championship 2025',
    sport: 'Basketball',
    options: [
      { id: 4, name: 'Boston Celtics', price: 4.2 },
      { id: 5, name: 'Dallas Mavericks', price: 7.5 },
      { id: 6, name: 'Denver Nuggets', price: 8.0 },
    ],
    endTime: new Date('2025-06-15').toISOString(),
  },
  {
    id: 3,
    name: 'Premier League Winner 2024/25',
    sport: 'Soccer',
    options: [
      { id: 7, name: 'Manchester City', price: 2.1 },
      { id: 8, name: 'Arsenal', price: 3.5 },
      { id: 9, name: 'Liverpool', price: 4.2 },
    ],
    endTime: new Date('2025-05-19').toISOString(),
  },
];

export default function MarketList() {
  const [markets, setMarkets] = useState(MOCK_MARKETS);
  const [loading, setLoading] = useState(false);

  // In a real implementation, we would fetch markets from the API
  // useEffect(() => {
  //   const fetchMarkets = async () => {
  //     setLoading(true);
  //     try {
  //       const response = await fetch('/api/markets');
  //       const data = await response.json();
  //       setMarkets(data);
  //     } catch (error) {
  //       console.error('Error fetching markets:', error);
  //     } finally {
  //       setLoading(false);
  //     }
  //   };
  //
  //   fetchMarkets();
  // }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-gray-500">Loading markets...</p>
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg bg-white p-6 shadow-md">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">No markets available</h3>
          <p className="mt-2 text-gray-500">Check back later for new markets</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {markets.map((market) => (
        <div key={market.id} className="overflow-hidden rounded-lg bg-white shadow-md">
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="inline-block rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                  {market.sport}
                </span>
                <h3 className="mt-1 text-lg font-semibold text-gray-900">{market.name}</h3>
              </div>
              <div className="text-sm text-gray-500">
                Ends: {new Date(market.endTime).toLocaleDateString()}
              </div>
            </div>
          </div>
          
          <div className="divide-y divide-gray-200">
            {market.options.map((option) => (
              <div key={option.id} className="flex items-center justify-between px-6 py-4">
                <span className="text-base font-medium text-gray-900">{option.name}</span>
                <div className="flex items-center space-x-4">
                  <span className="text-base font-semibold text-gray-900">{option.price.toFixed(2)}</span>
                  <Link
                    href={`/markets/${market.id}/trade?option=${option.id}`}
                    className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Trade
                  </Link>
                </div>
              </div>
            ))}
          </div>
          
          <div className="bg-gray-50 px-6 py-3 text-right">
            <Link
              href={`/markets/${market.id}`}
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              View Market Details →
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
} 