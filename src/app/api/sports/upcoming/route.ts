import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { sportMonksCricket } from '@/lib/services/sports-data/sportmonks-cricket';

/**
 * @route GET /api/sports/upcoming
 * @desc Get upcoming matches for a specific sport
 * @access Private
 */
export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const sport = searchParams.get('sport') || 'cricket'; 
    const days = parseInt(searchParams.get('days') || '7', 10);
    
    console.log(`Fetching upcoming ${sport} matches for the next ${days} days`);
    
    if (sport.toLowerCase() === 'cricket') {
      // Get upcoming cricket matches from SportMonks API
      const upcomingMatchesResult = await sportMonksCricket.getUpcomingFixtures(
        days, 
        ['localteam', 'visitorteam', 'venue', 'league']
      );
      
      if (!upcomingMatchesResult.success || !upcomingMatchesResult.data) {
        return NextResponse.json(
          { 
            success: false,
            error: upcomingMatchesResult.error || 'Failed to fetch upcoming cricket matches' 
          }, 
          { status: 500 }
        );
      }
      
      // Format matches into a standard structure
      const matches = Array.isArray(upcomingMatchesResult.data)
        ? upcomingMatchesResult.data
        : [upcomingMatchesResult.data];
      
      // Transform to standard format
      const formattedMatches = matches
        .filter(match => match.status !== 'Finished') // Filter out finished matches
        .map(match => {
          const transformed = sportMonksCricket.transformToStandardFormat(match);
          
          // Adapt to the format expected by the admin page
          return {
            gameId: transformed.id,
            homeTeam: {
              id: match.localteam_id,
              name: transformed.teamInfo?.[0]?.name || match.localteam?.name || 'Home Team'
            },
            awayTeam: {
              id: match.visitorteam_id,
              name: transformed.teamInfo?.[1]?.name || match.visitorteam?.name || 'Away Team'
            },
            startTime: transformed.date,
            status: transformed.status,
            leagueId: match.league?.id || match.league_id,
            leagueName: match.league?.name || 'Cricket League',
            venue: transformed.venue
          };
        });
      
      return NextResponse.json({
        success: true,
        data: formattedMatches
      });
    } else {
      // For future support of other sports
      return NextResponse.json(
        { error: `Sport '${sport}' is not supported yet` }, 
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error fetching upcoming matches:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'An unexpected error occurred' 
      }, 
      { status: 500 }
    );
  }
} 