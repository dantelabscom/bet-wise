import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { sportRadar } from '@/lib/services/sports-data/sportradar';

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
    const sport = searchParams.get('sport') || 'nba';
    const leagueId = searchParams.get('leagueId') || undefined;
    const daysAhead = parseInt(searchParams.get('days') || '7', 10);

    // Validate params
    if (daysAhead < 1 || daysAhead > 30) {
      return NextResponse.json(
        { error: 'Days ahead must be between 1 and 30' }, 
        { status: 400 }
      );
    }

    // Fetch upcoming games from SportRadar service
    const result = await sportRadar.getUpcomingGames(sport, leagueId, daysAhead);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch upcoming games' }, 
        { status: 500 }
      );
    }

    // Return the data
    return NextResponse.json({
      success: true,
      data: result.data
    });
  } catch (error: any) {
    console.error('Error fetching upcoming games:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' }, 
      { status: 500 }
    );
  }
} 