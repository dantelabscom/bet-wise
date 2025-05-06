'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { RetroGrid } from '@/components/RetroGrid';
import Image from 'next/image';
import DisplayCards from '@/components/DisplayCard';
import { BarChart3, ShieldCheck, Zap, TrendingUp, LineChart, Trophy } from 'lucide-react';
import { EvervaultCard } from '@/components/EvervaultCard';

export default function Home() {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'authenticated') {
      // Redirect authenticated users to cricket markets
      router.push('/markets/cricket');
    } else {
      // Redirect unauthenticated users to login
      router.push('/auth/login');
    }
  }, [status, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Welcome to Cricket Trading</h2>
        <p className="text-gray-500">Redirecting...</p>
      </div>
    </div>
  );
}
