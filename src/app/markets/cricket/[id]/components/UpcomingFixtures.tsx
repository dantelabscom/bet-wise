'use client';

import React, { useState, useEffect } from 'react';
import { FixturesList } from '@/components/cricket/FixturesList';
import { useCricketData } from '@/lib/hooks/useCricketData';

interface UpcomingFixturesProps {
  matchId: string;
}

export default function UpcomingFixtures({ matchId }: UpcomingFixturesProps) {
  const { currentSeasons, isLoading, error, fetchSeasons } = useCricketData();
  const [currentSeasonId, setCurrentSeasonId] = useState<number | null>(null);

  useEffect(() => {
    // Fetch current seasons on component mount
    fetchSeasons([], true);
  }, [fetchSeasons]);

  useEffect(() => {
    // Set the first current season as default when data is loaded
    if (currentSeasons.length > 0) {
      setCurrentSeasonId(currentSeasons[0].id);
    }
  }, [currentSeasons]);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Upcoming Fixtures</h3>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Upcoming Fixtures</h3>
        <div className="py-8 text-center text-gray-500 dark:text-gray-400">
          Error loading fixtures: {error}
        </div>
      </div>
    );
  }

  if (!currentSeasonId) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Upcoming Fixtures</h3>
        <div className="py-8 text-center text-gray-500 dark:text-gray-400">
          No active cricket season found
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
      {currentSeasonId && <FixturesList seasonId={currentSeasonId} limit={5} />}
    </div>
  );
} 