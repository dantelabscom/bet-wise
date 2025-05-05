import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { sportRadar } from '@/lib/services/sports-data/sportradar';

/**
 * @route GET /api/sports/live
 * @desc Get live data for a specific game
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
    const gameId = searchParams.get('gameId');
    const sport = searchParams.get('sport') || 'nba';

    // Validate required parameters
    if (!gameId) {
      return NextResponse.json(
        { error: 'Game ID is required' }, 
        { status: 400 }
      );
    }

    // Fetch live game data from SportRadar service
    const result = await sportRadar.getLiveGameData(gameId, sport);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch live game data' }, 
        { status: 500 }
      );
    }

    // Return the data
    return NextResponse.json({
      success: true,
      data: result.data
    });
  } catch (error: any) {
    console.error('Error fetching live game data:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' }, 
      { status: 500 }
    );
  }
} 