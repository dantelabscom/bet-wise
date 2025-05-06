import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { sportMonksCricket } from '@/lib/services/sports-data/sportmonks-cricket';

/**
 * @route GET /api/sports/cricket/matches
 * @desc Get live and upcoming cricket matches
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
    const type = searchParams.get('type') || 'all'; // all, live, upcoming
    const days = parseInt(searchParams.get('days') || '7', 10);
    
    console.log(`Fetching cricket matches - type: ${type}, days ahead: ${days}`);
    
    try {
      let matches = [];
      
      // First get live matches
      const liveMatchesResult = await sportMonksCricket.getLiveMatches([
        'localteam', 
        'visitorteam', 
        'runs', 
        'venue'
      ]);
      
      if (liveMatchesResult.success && liveMatchesResult.data) {
        const liveMatches = Array.isArray(liveMatchesResult.data) 
          ? liveMatchesResult.data 
          : [liveMatchesResult.data];
          
        const formattedLiveMatches = liveMatches.map(match => 
          sportMonksCricket.transformToStandardFormat(match)
        );
        
        matches.push(...formattedLiveMatches);
      }
      
      // Add upcoming matches if requested
      if (type === 'all' || type === 'upcoming') {
        const upcomingMatchesResult = await sportMonksCricket.getUpcomingFixtures(
          days, 
          ['localteam', 'visitorteam', 'venue']
        );
        
        if (upcomingMatchesResult.success && upcomingMatchesResult.data) {
          const upcomingMatches = Array.isArray(upcomingMatchesResult.data)
            ? upcomingMatchesResult.data
            : [upcomingMatchesResult.data];
            
          const formattedUpcomingMatches = upcomingMatches
            .filter(match => match.status !== 'Finished') // Filter out finished matches
            .map(match => sportMonksCricket.transformToStandardFormat(match));
          
          matches.push(...formattedUpcomingMatches);
        }
      }
      
      // Filter matches if requested
      if (type === 'live') {
        matches = matches.filter(match => 
          match.status.toLowerCase().includes('progress') || 
          match.status.toLowerCase() === 'in progress'
        );
      } else if (type === 'upcoming') {
        matches = matches.filter(match => 
          !match.status.toLowerCase().includes('progress') && 
          match.status.toLowerCase() !== 'completed' &&
          match.status.toLowerCase() !== 'in progress'
        );
      }
      
      return NextResponse.json({
        success: true,
        data: matches
      });
    } catch (apiError: any) {
      console.error('Error calling SportMonks API:', apiError);
      return NextResponse.json(
        { 
          success: false,
          error: apiError.message || 'API service error',
          details: apiError.stack || 'No stack trace available'
        }, 
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error fetching cricket matches:', error);
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