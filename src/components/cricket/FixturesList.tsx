import React, { useEffect } from 'react';
import { useCricketData } from '@/lib/hooks/useCricketData';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface FixturesListProps {
  seasonId: number;
  limit?: number;
}

export function FixturesList({ seasonId, limit = 5 }: FixturesListProps) {
  const { fixtures, isLoading, error, fetchFixturesBySeason } = useCricketData();

  useEffect(() => {
    if (seasonId) {
      fetchFixturesBySeason(seasonId, ['localTeam', 'visitorTeam', 'venue', 'stage']);
    }
  }, [seasonId, fetchFixturesBySeason]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <h3 className="text-lg font-semibold">Upcoming Fixtures</h3>
        </CardHeader>
        <CardContent>
          <p>Loading fixtures...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <h3 className="text-lg font-semibold">Upcoming Fixtures</h3>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">Error loading fixtures: {error}</p>
        </CardContent>
      </Card>
    );
  }

  // Filter fixtures that haven't started yet and sort by date
  const upcomingFixtures = fixtures
    .filter(fixture => new Date(fixture.starting_at) > new Date())
    .sort((a, b) => new Date(a.starting_at).getTime() - new Date(b.starting_at).getTime())
    .slice(0, limit);

  return (
    <Card>
      <CardHeader className="pb-2">
        <h3 className="text-lg font-semibold">Upcoming Fixtures</h3>
      </CardHeader>
      <CardContent>
        {upcomingFixtures.length === 0 ? (
          <p>No upcoming fixtures found</p>
        ) : (
          <div className="space-y-4">
            {upcomingFixtures.map(fixture => (
              <div key={fixture.id} className="border-b pb-3 last:border-0">
                <div className="flex justify-between items-center mb-1">
                  <div className="font-medium">{fixture.localTeam?.name} vs {fixture.visitorTeam?.name}</div>
                  <Badge variant="outline">
                    {format(new Date(fixture.starting_at), 'MMM dd, yyyy')}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  <div>{fixture.venue?.name}</div>
                  <div>{format(new Date(fixture.starting_at), 'h:mm a')}</div>
                  {fixture.stage?.name && <div>{fixture.stage.name}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 