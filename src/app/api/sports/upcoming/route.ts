import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { sportRadar } from '@/lib/services/sports-data/sportradar';
import { sportMonksCricket } from '@/lib/services/sports-data/sportmonks-cricket';

/**
 * @route GET /api/sports/upcoming
 * @desc Get upcoming games for a specified sport
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const sport = searchParams.get('sport') || 'cricket';
    const leagueId = searchParams.get('leagueId') || undefined;
    const daysAhead = parseInt(searchParams.get('days') || '7', 10);

    // Validate params
    if (daysAhead < 1 || daysAhead > 30) {
      return NextResponse.json(
        { error: 'Days ahead must be between 1 and 30' }, 
        { status: 400 }
      );
    }

    console.log(`Fetching upcoming games for ${sport}, league: ${leagueId}, days: ${daysAhead}`);

    let result;
    
    // Use the appropriate service based on the sport
    if (sport === 'cricket') {
      // Use SportMonks for cricket data
      result = await fetchCricketData(daysAhead, leagueId);
    } else {
      // Use SportRadar for other sports
      result = await sportRadar.getUpcomingGames(sport, leagueId, daysAhead);
    }

    console.log(`API response status: ${result.success ? 'Success' : 'Failed'}`);
    
    if (!result.success) {
      console.error('API error:', result.error);
      return NextResponse.json(
        { 
          success: false,
          error: result.error || 'Failed to fetch upcoming games',
          details: 'The third-party sports data API returned an error'
        }, 
        { status: 500 }
      );
    }

    // Log some basic info about the returned data
    console.log(`Retrieved ${result.data?.length || 0} games`);
    
    // Return the data
    return NextResponse.json({
      success: true,
      data: result.data
    });
  } catch (error: any) {
    console.error('Error fetching upcoming games:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'An unexpected error occurred',
        details: error.stack || 'No stack trace available'
      }, 
      { status: 500 }
    );
  }
}

/**
 * Fetch cricket data using SportMonks
 */
async function fetchCricketData(daysAhead: number, leagueId?: string) {
  try {
    const includes = ['localteam', 'visitorteam', 'venue', 'league'];
    
    // Add league filter if provided
    const upcomingMatchesResult = await sportMonksCricket.getUpcomingFixtures(
      daysAhead, 
      includes
    );
    
    if (!upcomingMatchesResult.success) {
      return upcomingMatchesResult;
    }
    
    // Filter by league if provided
    let fixtures = upcomingMatchesResult.data;
    if (leagueId && Array.isArray(fixtures)) {
      fixtures = fixtures.filter(fixture => 
        fixture.league_id?.toString() === leagueId ||
        fixture.league?.id?.toString() === leagueId
      );
    }
    
    // Transform data to standard format
    const transformedFixtures = Array.isArray(fixtures)
      ? fixtures.map(fixture => {
          const transformed = sportMonksCricket.transformToStandardFormat(fixture);
          
          // Adapt to expected format for admin interface
          return {
            gameId: transformed.id,
            homeTeam: {
              name: transformed.teams[0] || 'Home Team',
              id: fixture.localteam_id
            },
            awayTeam: {
              name: transformed.teams[1] || 'Away Team',
              id: fixture.visitorteam_id
            },
            startTime: transformed.date,
            status: transformed.status,
            leagueId: fixture.league?.id || fixture.league_id || 'unknown',
            leagueName: fixture.league?.name || 'Unknown League'
          };
        })
      : [];
    
    return {
      success: true,
      data: transformedFixtures
    };
  } catch (error: any) {
    console.error('Error fetching cricket data from SportMonks:', error);
    return {
      success: false,
      data: null,
      error: error.message || 'Failed to fetch cricket data'
    };
  }
} 