'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardHeader from '@/components/dashboard/Header';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Loading...</h2>
          <p className="text-gray-500">Please wait while we load your dashboard</p>
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
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {session.user.name || 'Trader'}</h1>
          <p className="text-gray-600">Explore cricket markets and start trading</p>
        </div>
        
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-lg font-semibold">Your Wallet</h2>
            <div className="mb-4">
              <span className="text-2xl font-bold text-green-600">$1,000.00</span>
              <span className="ml-2 text-sm text-gray-500">Available Balance</span>
            </div>
            <Link 
              href="/wallet" 
              className="block rounded-md bg-blue-600 px-4 py-2 text-center text-white hover:bg-blue-700"
            >
              Manage Wallet
            </Link>
          </div>
          
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-lg font-semibold">Active Positions</h2>
            <p className="text-gray-500">No active positions yet</p>
            <Link 
              href="/positions" 
              className="mt-4 block rounded-md border border-blue-600 px-4 py-2 text-center text-blue-600 hover:bg-blue-50"
            >
              View All Positions
            </Link>
          </div>
          
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-lg font-semibold">Order History</h2>
            <p className="text-gray-500">No orders yet</p>
            <Link 
              href="/orders" 
              className="mt-4 block rounded-md border border-blue-600 px-4 py-2 text-center text-blue-600 hover:bg-blue-50"
            >
              View Order History
            </Link>
          </div>
        </div>
        
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Cricket Markets</h2>
            <Link href="/markets/cricket" className="text-blue-600 hover:underline">
              View All Cricket Markets
            </Link>
          </div>
          
          <div className="rounded-lg bg-white p-6 shadow-md">
            <p className="text-center py-8">
              <Link 
                href="/markets/cricket" 
                className="inline-block rounded-md bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
              >
                Explore Cricket Markets
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
} 