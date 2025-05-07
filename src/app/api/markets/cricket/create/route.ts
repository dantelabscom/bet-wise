import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { sportMonksCricket } from '@/lib/services/sports-data/sportmonks-cricket';
import { sentimentService, botService } from '@/lib/services/liquidity';

/**
 * @route POST /api/markets/cricket/create
 * @desc Create markets for a cricket match
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
    
    // Get request body
    const body = await request.json();
    const { matchId, createMarketTypes } = body;
    
    if (!matchId) {
      return NextResponse.json(
        { error: 'Match ID is required' }, 
        { status: 400 }
      );
    }
    
    if (!createMarketTypes || !Array.isArray(createMarketTypes) || createMarketTypes.length === 0) {
      return NextResponse.json(
        { error: 'At least one market type must be selected' }, 
        { status: 400 }
      );
    }
    
    // Get match details from SportMonks API
    const matchResponse = await sportMonksCricket.getFixture(matchId, ['localteam', 'visitorteam']);
    
    if (!matchResponse.success || !matchResponse.data) {
      return NextResponse.json(
        { error: 'Failed to fetch match details' }, 
        { status: 500 }
      );
    }
    
    const match = sportMonksCricket.transformToStandardFormat(matchResponse.data);
    
    if (!match || !match.teamInfo || match.teamInfo.length < 2) {
      return NextResponse.json(
        { error: 'Invalid match data or missing team information' }, 
        { status: 400 }
      );
    }
    
    // Create markets based on selected types
    const createdMarkets = [];
    
    // Match winner market
    if (createMarketTypes.includes('match_winner')) {
      const marketId = sentimentService.createPredefinedMarket('cricket', {
        homeTeam: match.teamInfo[0].name,
        awayTeam: match.teamInfo[1].name,
        matchId: match.id,
        matchName: match.name,
        homeAdvantage: true // Default to home advantage
      });
      
      // Start liquidity generation for the market
      botService.startLiquidityGeneration(marketId);
      
      createdMarkets.push({
        marketId,
        type: 'match_winner',
        name: `${match.name} - Match Winner`
      });
    }
    
    // Total runs market (over/under)
    if (createMarketTypes.includes('total_runs')) {
      const marketId = sentimentService.createPredefinedMarket('cricket', {
        homeTeam: 'Over',
        awayTeam: 'Under',
        matchId: match.id,
        matchName: match.name,
        totalRuns: 300, // Default value
        marketType: 'total_runs'
      });
      
      // Start liquidity generation for the market
      botService.startLiquidityGeneration(marketId);
      
      createdMarkets.push({
        marketId,
        type: 'total_runs',
        name: `${match.name} - Total Runs Over/Under 300`
      });
    }
    
    // Innings score market
    if (createMarketTypes.includes('innings_score')) {
      const marketId = sentimentService.createPredefinedMarket('cricket', {
        homeTeam: 'Over',
        awayTeam: 'Under',
        matchId: match.id,
        matchName: match.name,
        inningsScore: 150, // Default value
        marketType: 'innings_score',
        team: match.teamInfo[0].name // First innings for home team
      });
      
      // Start liquidity generation for the market
      botService.startLiquidityGeneration(marketId);
      
      createdMarkets.push({
        marketId,
        type: 'innings_score',
        name: `${match.teamInfo[0].name} - First Innings Score Over/Under 150`
      });
    }
    
    // Add more market types as needed
    
    return NextResponse.json({
      success: true,
      message: `Successfully created ${createdMarkets.length} markets for ${match.name}`,
      markets: createdMarkets
    });
  } catch (error: any) {
    console.error('Error creating cricket markets:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'An unexpected error occurred' 
      }, 
      { status: 500 }
    );
  }
} 