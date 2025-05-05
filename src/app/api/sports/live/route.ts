import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { sportRadar } from '@/lib/services/sports-data/sportradar';
import { cricApi } from '@/lib/services/sports-data/cricapi';

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

    // Use CricAPI for cricket data, SportRadar for other sports
    let result;
    if (sport.toLowerCase() === 'cricket') {
      // Fetch match info and scorecard data from CricAPI
      const matchInfoResult = await cricApi.getMatchInfo(gameId);
      
      if (!matchInfoResult.success) {
        return NextResponse.json(
          { error: matchInfoResult.error || 'Failed to fetch cricket match data' }, 
          { status: 500 }
        );
      }
      
      // Get scorecard data for more detailed information
      const scorecardResult = await cricApi.getMatchScorecard(gameId);
      
      // Combine the data
      const combinedData = {
        ...matchInfoResult.data,
        scorecard: scorecardResult.success ? scorecardResult.data : null
      };
      
      // Transform to our standard format
      const transformedData = cricApi.transformToStandardFormat(combinedData);
      
      result = {
        success: true,
        data: transformedData
      };
    } else {
      // Use SportRadar for other sports
      result = await sportRadar.getLiveGameData(gameId, sport);
    }

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