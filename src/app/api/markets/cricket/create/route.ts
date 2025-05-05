import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { db } from '@/lib/db';
import { events, markets, marketOptions } from '@/lib/db/schema';
import { sportRadar } from '@/lib/services/sports-data/sportradar';

/**
 * @route POST /api/markets/cricket/create
 * @desc Create cricket markets for a specific match
 * @access Admin
 */
export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated and is an admin
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
    
    const body = await request.json();
    const { matchId, sportId, createMarketTypes } = body;
    
    if (!matchId || !sportId) {
      return NextResponse.json(
        { error: 'Match ID and Sport ID are required' }, 
        { status: 400 }
      );
    }
    
    // Fetch match data from SportRadar
    const matchResult = await sportRadar.getLiveGameData(matchId, 'cricket');
    
    if (!matchResult.success) {
      return NextResponse.json(
        { 
          success: false,
          error: matchResult.error || 'Failed to fetch match data',
        }, 
        { status: 500 }
      );
    }
    
    const matchData = matchResult.data;
    
    // Create or get an event for this match
    const matchDate = new Date(matchData.sport_event.scheduled);
    const homeTeam = matchData.sport_event.competitors.find((c: any) => c.qualifier === 'home')?.name || 'Home Team';
    const awayTeam = matchData.sport_event.competitors.find((c: any) => c.qualifier === 'away')?.name || 'Away Team';
    const tournamentName = matchData.sport_event.tournament?.name || 'Unknown Tournament';
    
    // Check if event already exists
    let existingEvent = await db.query.events.findFirst({
      where: (events, { eq }) => eq(events.sportId, sportId) && eq(events.name, `${homeTeam} vs ${awayTeam}`)
    });
    
    // Create event if it doesn't exist
    let eventId;
    if (!existingEvent) {
      const [newEvent] = await db.insert(events).values({
        sportId: sportId,
        name: `${homeTeam} vs ${awayTeam}`,
        description: `${tournamentName} cricket match`,
        homeTeam: homeTeam,
        awayTeam: awayTeam,
        startTime: matchDate,
        endTime: new Date(matchDate.getTime() + (8 * 60 * 60 * 1000)), // Add 8 hours for cricket match
        isActive: true,
      }).returning();
      
      eventId = newEvent.id;
    } else {
      eventId = existingEvent.id;
    }
    
    // Determine which market types to create
    const marketTypesToCreate = createMarketTypes || ['match_winner', 'total_runs', 'innings_score'];
    const createdMarkets = [];
    
    // Create Match Winner market
    if (marketTypesToCreate.includes('match_winner')) {
      const matchWinnerMarket = await createMatchWinnerMarket(
        eventId, 
        homeTeam, 
        awayTeam, 
        matchId, 
        matchData.sport_event.tournament.type || 't20'
      );
      createdMarkets.push(matchWinnerMarket);
    }
    
    // Create Total Runs market
    if (marketTypesToCreate.includes('total_runs')) {
      const totalRunsMarket = await createTotalRunsMarket(
        eventId,
        matchId,
        homeTeam,
        awayTeam,
        // Estimate total runs based on format
        matchData.sport_event.tournament.type === 't20' ? 320 : 550
      );
      createdMarkets.push(totalRunsMarket);
    }
    
    // Create Innings Score market (for first innings)
    if (marketTypesToCreate.includes('innings_score')) {
      const inningsScoreMarket = await createInningsScoreMarket(
        eventId,
        matchId,
        1, // First innings
        homeTeam,
        // Estimate innings score based on format
        matchData.sport_event.tournament.type === 't20' ? 160 : 280
      );
      createdMarkets.push(inningsScoreMarket);
    }
    
    return NextResponse.json({
      success: true,
      message: `Created ${createdMarkets.length} markets for the match`,
      markets: createdMarkets
    });
  } catch (error: any) {
    console.error('Error creating cricket markets:', error);
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
 * Create a match winner market
 */
async function createMatchWinnerMarket(
  eventId: number,
  homeTeam: string,
  awayTeam: string,
  matchId: string,
  format: string
) {
  // Create the market
  const [market] = await db.insert(markets).values({
    eventId: eventId,
    name: `Winner: ${homeTeam} vs ${awayTeam}`,
    description: `Predict the winner of the match between ${homeTeam} and ${awayTeam}`,
    type: 'match_winner',
    status: 'open',
    metadata: {
      matchId: matchId,
      format: format.toLowerCase(),
      teams: {
        home: homeTeam,
        away: awayTeam
      }
    },
    tradingVolume: '0',
  }).returning();
  
  // Create market options (home, away, and draw if test match)
  const homeOption = await db.insert(marketOptions).values({
    marketId: market.id,
    name: homeTeam,
    initialPrice: '2.00', // Default to even odds for simplicity
    currentPrice: '2.00',
    weight: '1',
  }).returning();
  
  const awayOption = await db.insert(marketOptions).values({
    marketId: market.id,
    name: awayTeam,
    initialPrice: '2.00',
    currentPrice: '2.00',
    weight: '1',
  }).returning();
  
  // Add draw option for test matches
  if (format.toLowerCase() === 'test') {
    const drawOption = await db.insert(marketOptions).values({
      marketId: market.id,
      name: 'Draw',
      initialPrice: '5.00', // Less likely
      currentPrice: '5.00',
      weight: '1',
    }).returning();
  }
  
  return market;
}

/**
 * Create a total runs market
 */
async function createTotalRunsMarket(
  eventId: number,
  matchId: string,
  homeTeam: string,
  awayTeam: string,
  estimatedTotal: number
) {
  // Create the market
  const [market] = await db.insert(markets).values({
    eventId: eventId,
    name: `Total Match Runs: ${homeTeam} vs ${awayTeam}`,
    description: `Predict whether the total runs in the match will be over or under ${estimatedTotal}`,
    type: 'total_runs',
    status: 'open',
    metadata: {
      matchId: matchId,
      line: estimatedTotal,
      team: 'both'
    },
    tradingVolume: '0',
  }).returning();
  
  // Create over/under options
  const overOption = await db.insert(marketOptions).values({
    marketId: market.id,
    name: `Over ${estimatedTotal}`,
    initialPrice: '2.00',
    currentPrice: '2.00',
    weight: '1',
  }).returning();
  
  const underOption = await db.insert(marketOptions).values({
    marketId: market.id,
    name: `Under ${estimatedTotal}`,
    initialPrice: '2.00',
    currentPrice: '2.00',
    weight: '1',
  }).returning();
  
  return market;
}

/**
 * Create an innings score market
 */
async function createInningsScoreMarket(
  eventId: number,
  matchId: string,
  innings: number,
  battingTeam: string,
  estimatedScore: number
) {
  // Create the market
  const [market] = await db.insert(markets).values({
    eventId: eventId,
    name: `${battingTeam} Innings Score (${innings})`,
    description: `Predict ${battingTeam}'s total score in the ${innings}${getOrdinalSuffix(innings)} innings`,
    type: 'innings_score',
    status: 'open',
    metadata: {
      matchId: matchId,
      innings: innings,
      team: 'home', // Assuming batting team is home for simplicity
    },
    tradingVolume: '0',
  }).returning();
  
  // Create multiple line options
  const lines = [
    Math.round(estimatedScore * 0.8), // 20% below estimate
    estimatedScore,
    Math.round(estimatedScore * 1.2), // 20% above estimate
  ];
  
  for (const line of lines) {
    // Create over/under options for each line
    await db.insert(marketOptions).values({
      marketId: market.id,
      name: `Over ${line}`,
      initialPrice: '2.00',
      currentPrice: '2.00',
      weight: '1',
      metadata: {
        type: 'over',
        line: line
      }
    }).returning();
    
    await db.insert(marketOptions).values({
      marketId: market.id,
      name: `Under ${line}`,
      initialPrice: '2.00',
      currentPrice: '2.00',
      weight: '1',
      metadata: {
        type: 'under',
        line: line
      }
    }).returning();
  }
  
  return market;
}

// Helper function to get ordinal suffix for numbers
function getOrdinalSuffix(num: number): string {
  const j = num % 10;
  const k = num % 100;
  
  if (j === 1 && k !== 11) {
    return 'st';
  }
  if (j === 2 && k !== 12) {
    return 'nd';
  }
  if (j === 3 && k !== 13) {
    return 'rd';
  }
  return 'th';
} 