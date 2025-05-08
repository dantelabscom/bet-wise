import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { marketService } from '@/lib/services/trading/market-service';
import { botService } from '@/lib/services/liquidity/bot-service';

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
      
      // Initialize bot trading for each market
      newMarkets.forEach(market => {
        console.log(`Initializing bot trading for market: ${market.id}`);
        
        // Initialize market for bot trading
        botService.initializeMarket(
          market.id, 
          market.name, 
          market.description,
          0.5 // Initial price
        );
        
        // Start generating liquidity
        botService.startLiquidityGeneration(market.id);
      });
      
      return NextResponse.json({
        success: true,
        data: newMarkets
      });
    } else {
      // Check if bot trading is already initialized for these markets
      markets.forEach(market => {
        try {
          // Get market data to check if it exists
          const marketData = botService.getMarketData(market.id);
          if (!marketData) {
            // Initialize if not already done
            console.log(`Initializing bot trading for existing market: ${market.id}`);
            botService.initializeMarket(
              market.id, 
              market.name, 
              market.description,
              0.5 // Initial price
            );
            botService.startLiquidityGeneration(market.id);
          }
        } catch (error) {
          console.log(`Market ${market.id} not yet initialized for bot trading, initializing now`);
          botService.initializeMarket(
            market.id, 
            market.name, 
            market.description,
            0.5 // Initial price
          );
          botService.startLiquidityGeneration(market.id);
        }
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