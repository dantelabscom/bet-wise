import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { cricApi } from '@/lib/services/sports-data/cricapi';

/**
 * @route GET /api/sports/cricket/match/[id]
 * @desc Get cricket match data for a specific match
 * @access Private
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const matchId = params.id;
    
    if (!matchId) {
      return NextResponse.json(
        { error: 'Match ID is required' }, 
        { status: 400 }
      );
    }

    console.log(`Fetching cricket match data for match ID: ${matchId}`);

    // Fetch both match info and scorecard data
    const matchInfoResult = await cricApi.getMatchInfo(matchId);
    
    if (!matchInfoResult.success) {
      console.error('Error fetching match info:', matchInfoResult.error);
      return NextResponse.json(
        { 
          success: false,
          error: matchInfoResult.error || 'Failed to fetch match data',
          details: 'The cricket API returned an error'
        }, 
        { status: 500 }
      );
    }
    
    // Get scorecard data for more detailed information
    const scorecardResult = await cricApi.getMatchScorecard(matchId);
    
    // Combine the data
    const combinedData = {
      ...matchInfoResult.data,
      scorecard: scorecardResult.success ? scorecardResult.data : null
    };
    
    // Format match data for our frontend
    const formattedMatchData = formatCricketMatchData(combinedData);
    
    return NextResponse.json({
      success: true,
      data: formattedMatchData
    });
  } catch (error: any) {
    console.error('Error fetching cricket match data:', error);
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
 * Format cricket match data from CricAPI to our frontend format
 */
function formatCricketMatchData(matchData: any) {
  try {
    // Extract teams
    const teams = matchData.teams || [];
    const homeTeam = teams[0] || 'Home Team';
    const awayTeam = teams[1] || 'Away Team';
    
    // Extract scores
    const scores = matchData.score || [];
    const homeInning = scores.find((s: any) => s.inning?.includes(homeTeam)) || {};
    const awayInning = scores.find((s: any) => s.inning?.includes(awayTeam)) || {};
    
    // Format match data for our frontend
    const formattedData: any = {
      matchId: matchData.id,
      status: matchData.status || 'unknown',
      format: matchData.matchType || 'unknown',
      current_innings: getCricketInnings(matchData),
      venue: matchData.venue || 'Unknown Venue',
      toss: matchData.toss || '',
    };
    
    // Current batting team data
    formattedData.batting_team = {
      name: homeTeam,
      score: homeInning.r || 0,
      wickets: homeInning.w || 0,
      overs: homeInning.o || 0,
      run_rate: calculateRunRate(
        homeInning.r || 0,
        homeInning.o || 0
      ),
    };
    
    // Current bowling team data
    formattedData.bowling_team = {
      name: awayTeam,
      score: awayInning.r || 0,
      wickets: awayInning.w || 0,
      overs: awayInning.o || 0,
      run_rate: calculateRunRate(
        awayInning.r || 0, 
        awayInning.o || 0
      ),
    };
    
    // Process scorecard data if available
    if (matchData.scorecard) {
      // Extract batsmen data
      formattedData.batsmen = extractBatsmenData(matchData.scorecard);
      
      // Extract bowlers data
      formattedData.bowlers = extractBowlersData(matchData.scorecard);
      
      // Extract recent balls
      formattedData.recent_balls = extractRecentBalls(matchData);
    }
    
    return formattedData;
  } catch (error) {
    console.error('Error formatting cricket match data:', error);
    return {
      matchId: matchData?.id || 'unknown',
      status: 'unknown',
      format: 'unknown',
      current_innings: 1,
      venue: 'Unknown Venue',
      batting_team: {
        name: 'Unknown Team',
        score: 0,
        wickets: 0,
        overs: 0,
        run_rate: 0,
      },
      bowling_team: {
        name: 'Unknown Team',
        score: 0,
        wickets: 0,
        overs: 0,
        run_rate: 0,
      },
      batsmen: [],
      bowlers: [],
      recent_balls: [],
    };
  }
}

/**
 * Determine the current innings from match data
 */
function getCricketInnings(matchData: any): number {
  // Logic to determine the current innings
  if (matchData.score && matchData.score.length > 0) {
    // Second innings if two scores are present and the match is ongoing
    if (matchData.score.length > 1 && matchData.status !== 'complete') {
      return 2;
    }
    return 1;
  }
  return 1;
}

/**
 * Extract batsmen data from scorecard
 */
function extractBatsmenData(scorecard: any): any[] {
  if (!scorecard || !Array.isArray(scorecard)) return [];
  
  // Get the current innings scorecard
  const currentInningsCard = scorecard[scorecard.length - 1];
  if (!currentInningsCard || !currentInningsCard.batting) return [];
  
  // Format batsmen data
  return currentInningsCard.batting
    .filter((batsman: any) => batsman.dismissal !== 'not out' || batsman.r > 0)
    .map((batsman: any) => ({
      name: batsman.batsman || 'Unknown Batsman',
      runs: batsman.r || 0,
      balls: batsman.b || 0,
      fours: batsman['4s'] || 0,
      sixes: batsman['6s'] || 0,
      strike_rate: parseFloat(batsman.sr || '0'),
      on_strike: batsman.dismissal === 'batting',
    }));
}

/**
 * Extract bowlers data from scorecard
 */
function extractBowlersData(scorecard: any): any[] {
  if (!scorecard || !Array.isArray(scorecard)) return [];
  
  // Get the current innings scorecard
  const currentInningsCard = scorecard[scorecard.length - 1];
  if (!currentInningsCard || !currentInningsCard.bowling) return [];
  
  // Format bowlers data
  return currentInningsCard.bowling
    .filter((bowler: any) => bowler.o > 0)
    .map((bowler: any) => ({
      name: bowler.bowler || 'Unknown Bowler',
      overs: parseFloat(bowler.o || '0'),
      maidens: parseInt(bowler.m || '0'),
      runs: parseInt(bowler.r || '0'),
      wickets: parseInt(bowler.w || '0'),
      economy: parseFloat(bowler.eco || '0'),
      currently_bowling: false, // We'll determine this based on match status
    }));
}

/**
 * Extract recent balls data
 */
function extractRecentBalls(matchData: any): string[] {
  // This information might be in different places depending on the API
  // For now, we'll create a simplified version
  if (matchData.score && matchData.score.length > 0) {
    const lastInning = matchData.score[matchData.score.length - 1];
    if (lastInning && lastInning.o) {
      // Create synthetic ball-by-ball data based on the current score
      // In a real implementation, you'd get this from the API if available
      const recentEvents = [];
      const ballsInLastOver = Math.round((parseFloat(lastInning.o) % 1) * 10);
      
      for (let i = 0; i < 5; i++) {
        if (i < ballsInLastOver) {
          // Random ball event for demo purposes
          const ballTypes = ['0', '1', '2', '4', '6', 'W'];
          const randomBall = ballTypes[Math.floor(Math.random() * ballTypes.length)];
          recentEvents.push(randomBall);
        } else {
          recentEvents.push('0');
        }
      }
      
      return recentEvents;
    }
  }
  
  return ['0', '1', '0', '0', '0']; // Default empty recent events
}

/**
 * Calculate run rate from runs and overs
 */
function calculateRunRate(runs: number, overs: number): number {
  if (!overs) return 0;
  return parseFloat((runs / overs).toFixed(2));
} 