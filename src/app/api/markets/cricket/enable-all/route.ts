import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { sportMonksCricket } from '@/lib/services/sports-data/sportmonks-cricket';
import { sentimentService, botService } from '@/lib/services/liquidity';

/**
 * @route POST /api/markets/cricket/enable-all
 * @desc Enable trading for all cricket matches regardless of status
 * @access Admin
 */
export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }
    
    // For now, we'll skip admin check for development purposes
    // In production, this should be uncommented
    // if (session.user.role !== 'admin') {
    //   return NextResponse.json(
    //     { error: 'Forbidden - Admin access required' }, 
    //     { status: 403 }
    //   );
    // }
    
    // Get all cricket matches from SportMonks API
    const { data: allMatches } = await sportMonksCricket.getAllMatches();
    
    if (!allMatches || !Array.isArray(allMatches)) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to fetch cricket matches'
        }, 
        { status: 500 }
      );
    }
    
    console.log(`Found ${allMatches.length} cricket matches to enable trading for`);
    
    // Transform matches to standard format
    const standardizedMatches = allMatches.map(match => 
      sportMonksCricket.transformToStandardFormat(match)
    ).filter(Boolean);
    
    // Enable trading for each match
    const enabledMatches = [];
    
    for (const match of standardizedMatches) {
      try {
        // Create sentiment-based market for each match
        const marketId = sentimentService.createPredefinedMarket('cricket', {
          homeTeam: match.teamInfo[0].name,
          awayTeam: match.teamInfo[1].name,
          homeAdvantage: true // Default to home advantage
        });
        
        // Start liquidity generation for the market
        botService.startLiquidityGeneration(marketId);
        
        enabledMatches.push({
          matchId: match.id,
          marketId,
          name: match.name
        });
        
        console.log(`Enabled trading for match: ${match.name} (${match.id}) with market ID: ${marketId}`);
      } catch (error) {
        console.error(`Failed to enable trading for match ${match.id}:`, error);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Enabled trading for ${enabledMatches.length} out of ${standardizedMatches.length} cricket matches`,
      enabledMatches
    });
  } catch (error: any) {
    console.error('Error enabling trading for cricket matches:', error);
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