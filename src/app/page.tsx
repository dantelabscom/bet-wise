'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { RetroGrid } from '@/components/RetroGrid';
import Image from 'next/image';
import DisplayCards from '@/components/DisplayCard';
import { BarChart3, ShieldCheck, Zap, TrendingUp, LineChart, Trophy } from 'lucide-react';
import { EvervaultCard } from '@/components/EvervaultCard';
import DashboardHeader from '@/components/dashboard/Header';

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status !== 'loading') {
      setIsLoading(false);
    }
  }, [status]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Welcome to Cricket Trading</h2>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Custom cards for the landing page
  const featureCards = [
    {
      icon: <TrendingUp className="h-8 w-8 text-blue-500" />,
      title: "Live Trading",
      description: "Experience real-time trading on cricket matches with instant updates and market movements."
    },
    {
      icon: <BarChart3 className="h-8 w-8 text-blue-500" />,
      title: "Advanced Analytics",
      description: "Make informed decisions with our comprehensive analytics and performance metrics."
    },
    {
      icon: <ShieldCheck className="h-8 w-8 text-blue-500" />,
      title: "Secure Platform",
      description: "Trade with confidence on our secure and reliable trading platform."
    }
  ];

  // Original landing page with your custom components
  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      
      <div className="relative overflow-hidden">
        <RetroGrid />
        <div className="container mx-auto px-4 py-16 relative z-10">
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold mb-6">BetWise</h1>
            <p className="text-xl text-gray-700 max-w-2xl mx-auto">
              A smarter way to bet on cricket with advanced analytics and real-time markets
            </p>
          </div>
          
          <div className="max-w-6xl mx-auto">
            <EvervaultCard />
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-16">
              {featureCards.map((card, index) => (
                <div key={index} className="bg-white p-6 rounded-lg shadow-md text-center">
                  <div className="flex justify-center mb-4">
                    {card.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{card.title}</h3>
                  <p className="text-gray-600">{card.description}</p>
                </div>
              ))}
            </div>
            
            <div className="mt-16 text-center">
              {status === 'authenticated' ? (
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold">Welcome back, {session?.user?.name || 'Trader'}!</h2>
                  <div className="flex flex-wrap justify-center gap-4">
                    <Link 
                      href="/markets/cricket" 
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-md"
                    >
                      Explore Cricket Markets
                    </Link>
                    <Link 
                      href="/dashboard" 
                      className="border border-blue-600 text-blue-600 hover:bg-blue-50 font-medium py-3 px-6 rounded-md"
                    >
                      Go to Dashboard
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold">Get Started Today</h2>
                  <div className="flex flex-wrap justify-center gap-4">
                    <Link 
                      href="/auth/login" 
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-md"
                    >
                      Login
                    </Link>
                    <Link 
                      href="/auth/register" 
                      className="border border-blue-600 text-blue-600 hover:bg-blue-50 font-medium py-3 px-6 rounded-md"
                    >
                      Sign Up
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
