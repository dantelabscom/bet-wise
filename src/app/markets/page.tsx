'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MarketsPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to cricket markets
    router.push('/markets/cricket');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Redirecting to Cricket Markets...</h2>
        <p className="text-gray-500">Please wait</p>
      </div>
    </div>
  );
} 