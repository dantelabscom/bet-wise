import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { ballCommentaryService } from '@/lib/services/sports-data/ball-commentary-service';

/**
 * @route GET /api/sports/cricket/match/[id]/balls
 * @desc Get ball-by-ball commentary for a cricket match
 * @access Private
 */
export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    // Check if user is authenticated
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    // Get match ID from params - properly awaited
    const params = await Promise.resolve(context.params);
    const matchId = params.id;
    
    if (!matchId) {
      return NextResponse.json(
        { error: 'Match ID is required' }, 
        { status: 400 }
      );
    }

    console.log(`Fetching ball-by-ball commentary for match ID: ${matchId}`);

    try {
      // Get recent ball events
      const ballEvents = await ballCommentaryService.getRecentBalls(matchId, 20);
      
      // If there's no active polling for this match, start it
      // This ensures we start getting real-time updates after the first request
      if (!ballCommentaryService.isPolling(matchId)) {
        ballCommentaryService.startPolling(matchId);
      }
      
      return NextResponse.json({
        success: true,
        data: ballEvents
      });
    } catch (apiError: any) {
      console.error('Error fetching ball commentary:', apiError);
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
    console.error('Error in ball commentary endpoint:', error);
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