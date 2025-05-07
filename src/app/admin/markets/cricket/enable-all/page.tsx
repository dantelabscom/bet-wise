'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import DashboardHeader from '@/components/dashboard/Header';

export default function EnableAllCricketMarketsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  // Check if user is authenticated and redirect if not
  if (status === 'unauthenticated') {
    router.push('/login');
    return null;
  }

  const enableAllMarkets = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/markets/cricket/enable-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to enable trading for all cricket matches');
      }
      
      setResults(data);
      toast.success(`Successfully enabled trading for ${data.enabledMatches.length} cricket matches`);
    } catch (error: any) {
      console.error('Error enabling trading:', error);
      toast.error(error.message || 'Failed to enable trading');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold mb-6">Enable Trading for All Cricket Matches</h1>
        
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Enable Probo-Style Trading</CardTitle>
            <CardDescription>
              This will enable trading for all cricket matches regardless of their status.
              Trading will be simulated with bot activity to create realistic markets.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4">
              Clicking the button below will:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>Fetch all cricket matches from the SportMonks API</li>
              <li>Create sentiment-based markets for each match</li>
              <li>Initialize trading bots to provide liquidity</li>
              <li>Enable real-time price evolution based on simulated sentiment</li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={enableAllMarkets}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isLoading ? 'Enabling Trading...' : 'Enable Trading for All Matches'}
            </Button>
          </CardFooter>
        </Card>
        
        {results && (
          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p><strong>Status:</strong> {results.success ? 'Success' : 'Failed'}</p>
                <p><strong>Message:</strong> {results.message}</p>
                
                {results.enabledMatches && results.enabledMatches.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium mb-2">Enabled Matches:</h3>
                    <div className="max-h-80 overflow-y-auto border rounded-md">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Match</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Match ID</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Market ID</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {results.enabledMatches.map((match: any) => (
                            <tr key={match.matchId}>
                              <td className="px-4 py-2 whitespace-nowrap text-sm">{match.name}</td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm">{match.matchId}</td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm">{match.marketId}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
} 