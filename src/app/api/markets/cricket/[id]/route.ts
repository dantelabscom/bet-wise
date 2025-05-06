import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { marketService } from '@/lib/services/trading/market-service';

/**
 * @route GET /api/markets/cricket/[id]
 * @desc Get markets for a cricket match
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

    console.log(`Fetching markets for match ID: ${matchId}`);

    // Get markets for the match
    const markets = marketService.getMarketsForMatch(matchId);
    
    // If no markets exist yet, create standard ones
    if (markets.length === 0) {
      console.log(`No markets found for match ${matchId}, creating standard markets`);
      const newMarkets = marketService.createStandardMarketsForMatch(matchId);
      
      return NextResponse.json({
        success: true,
        data: newMarkets
      });
    }
    
    return NextResponse.json({
      success: true,
      data: markets
    });
  } catch (error: any) {
    console.error('Error fetching markets:', error);
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