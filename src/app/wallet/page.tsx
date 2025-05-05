'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import DashboardHeader from '@/components/dashboard/Header';
import toast from 'react-hot-toast';

interface WalletData {
  id: number;
  balance: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export default function WalletPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [action, setAction] = useState<'deposit' | 'withdraw'>('deposit');
  const [transactionLoading, setTransactionLoading] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  // Fetch wallet data
  useEffect(() => {
    const fetchWallet = async () => {
      if (status === 'authenticated') {
        try {
          const response = await fetch('/api/wallet');
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch wallet');
          }
          
          const data = await response.json();
          setWallet(data);
        } catch (error: any) {
          console.error('Error fetching wallet:', error);
          toast.error(error.message || 'Failed to fetch wallet data');
        } finally {
          setLoading(false);
        }
      }
    };

    fetchWallet();
  }, [status]);

  // Handle deposit/withdraw
  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    setTransactionLoading(true);
    
    try {
      const response = await fetch('/api/wallet', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          amount: Number(amount),
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${action}`);
      }
      
      const updatedWallet = await response.json();
      setWallet(updatedWallet);
      setAmount('');
      toast.success(`Successfully ${action === 'deposit' ? 'deposited to' : 'withdrawn from'} wallet`);
    } catch (error: any) {
      console.error(`Error processing ${action}:`, error);
      toast.error(error.message || `Failed to ${action}`);
    } finally {
      setTransactionLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Loading...</h2>
          <p className="text-gray-500">Please wait while we load your wallet</p>
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
          <h1 className="text-2xl font-bold text-gray-900">Your Wallet</h1>
          <p className="text-gray-600">Manage your funds</p>
        </div>
        
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Balance Card */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-2 text-lg font-semibold">Available Balance</h2>
            <div className="mb-6">
              <span className="text-3xl font-bold text-green-600">
                ${wallet ? parseFloat(wallet.balance).toFixed(2) : '0.00'}
              </span>
            </div>
            
            <div className="space-y-2 text-sm text-gray-600">
              <p>
                <span className="font-medium">Wallet ID:</span> {wallet?.id}
              </p>
              <p>
                <span className="font-medium">Last Updated:</span>{' '}
                {wallet ? new Date(wallet.updatedAt).toLocaleString() : '-'}
              </p>
            </div>
          </div>
          
          {/* Transaction Form */}
          <div className="rounded-lg bg-white p-6 shadow-md md:col-span-2">
            <h2 className="mb-4 text-lg font-semibold">
              {action === 'deposit' ? 'Deposit Funds' : 'Withdraw Funds'}
            </h2>
            
            <div className="mb-4 flex space-x-2">
              <button
                className={`rounded-md px-4 py-2 ${
                  action === 'deposit'
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-300 text-gray-700'
                }`}
                onClick={() => setAction('deposit')}
              >
                Deposit
              </button>
              <button
                className={`rounded-md px-4 py-2 ${
                  action === 'withdraw'
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-300 text-gray-700'
                }`}
                onClick={() => setAction('withdraw')}
              >
                Withdraw
              </button>
            </div>
            
            <form onSubmit={handleTransaction} className="space-y-4">
              <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                  Amount (USD)
                </label>
                <div className="relative mt-1 rounded-md shadow-sm">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <span className="text-gray-500">$</span>
                  </div>
                  <input
                    type="number"
                    name="amount"
                    id="amount"
                    step="0.01"
                    min="0"
                    className="block w-full rounded-md border-gray-300 pl-7 pr-12 focus:border-blue-500 focus:ring-blue-500"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
              </div>
              
              <div>
                <button
                  type="submit"
                  disabled={transactionLoading}
                  className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {transactionLoading
                    ? action === 'deposit'
                      ? 'Depositing...'
                      : 'Withdrawing...'
                    : action === 'deposit'
                    ? 'Deposit Funds'
                    : 'Withdraw Funds'}
                </button>
              </div>
            </form>
            
            <div className="mt-4 text-sm text-gray-500">
              <p className="mb-2">Note:</p>
              {action === 'deposit' ? (
                <ul className="list-inside list-disc space-y-1">
                  <li>Deposited funds will be available immediately</li>
                  <li>Minimum deposit amount is $1.00</li>
                  <li>Maximum deposit amount is $10,000.00 per transaction</li>
                </ul>
              ) : (
                <ul className="list-inside list-disc space-y-1">
                  <li>Withdrawals are subject to available balance</li>
                  <li>Minimum withdrawal amount is $1.00</li>
                  <li>Processing may take 1-3 business days</li>
                </ul>
              )}
            </div>
          </div>
        </div>
        
        {/* Transaction History Placeholder */}
        <div className="mt-8 rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-4 text-lg font-semibold">Transaction History</h2>
          
          <div className="text-center py-8 text-gray-500">
            <p>Transaction history coming soon</p>
          </div>
        </div>
      </main>
    </div>
  );
} 