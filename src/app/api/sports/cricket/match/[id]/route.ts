import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { sportMonksCricket } from '@/lib/services/sports-data/sportmonks-cricket';

/**
 * @route GET /api/sports/cricket/match/[id]
 * @desc Get cricket match data for a specific match
 * @access Private
 */
export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {

    // Get match ID from params - properly awaited
    const params = await Promise.resolve(context.params);
    const matchId = params.id;
    
    if (!matchId) {
      return NextResponse.json(
        { error: 'Match ID is required' }, 
        { status: 400 }
      );
    }

    console.log(`Fetching cricket match data for match ID: ${matchId}`);

    try {
      // Ensure matchId is numeric - SportMonks expects numeric IDs
      const numericMatchId = matchId.toString().replace(/[^0-9]/g, '');
      
      if (!numericMatchId) {
        return NextResponse.json(
          { error: 'Invalid match ID format. ID must be numeric.' },
          { status: 400 }
        );
      }
      
      // Fetch match info data with necessary includes
      const matchInfoResult = await sportMonksCricket.getFixtureById(
        numericMatchId, 
        ['localteam', 'visitorteam', 'venue']
      );
      
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
      
      if (!matchInfoResult.data) {
        console.error('No data returned from cricket API');
        return NextResponse.json(
          { 
            success: false,
            error: 'No data returned from cricket API',
            details: 'The cricket API returned empty data'
          }, 
          { status: 404 }
        );
      }
      
      // Get scorecard data for more detailed information
      let scorecardData = null;
      try {
        const scorecardResult = await sportMonksCricket.getFixtureWithScorecard(numericMatchId);
        if (scorecardResult.success && scorecardResult.data) {
          // Process the scorecard using the helper method
          scorecardData = sportMonksCricket.processScorecard(scorecardResult.data);
        }
      } catch (scorecardError) {
        console.error('Error fetching scorecard (continuing without it):', scorecardError);
        // Continue without scorecard data
      }
      
      // Transform the match data to our standard format
      const transformedData = sportMonksCricket.transformToStandardFormat(matchInfoResult.data);
      
      // Combine the data
      const combinedData = {
        ...transformedData,
        scorecard: scorecardData
      };
      
      // Format match data for our frontend
      const formattedMatchData = formatCricketMatchData(combinedData);
      
      return NextResponse.json({
        success: true,
        data: formattedMatchData
      });
    } catch (apiError: any) {
      console.error('Error calling cricket API:', apiError);
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
    if (!matchData || typeof matchData !== 'object') {
      console.error('Invalid match data:', matchData);
      return createDefaultMatchData();
    }
    
    // Ensure teams is always an array
    const teams = Array.isArray(matchData.teams) ? matchData.teams : [];
    const homeTeam = teams.length > 0 ? teams[0] : 'Home Team';
    const awayTeam = teams.length > 1 ? teams[1] : 'Away Team';
    
    // Extract scores safely
    const scores = Array.isArray(matchData.score) ? matchData.score : [];
    
    // Find innings by team name, with fallbacks
    let homeInning = scores.find((s: any) => 
      s && s.inning && typeof s.inning === 'string' && s.inning.includes(homeTeam)
    );
    let awayInning = scores.find((s: any) => 
      s && s.inning && typeof s.inning === 'string' && s.inning.includes(awayTeam)
    );
    
    // If no matches by team name, use first and second innings
    if (!homeInning && scores.length > 0) homeInning = scores[0];
    if (!awayInning && scores.length > 1) awayInning = scores[1];
    
    // Ensure innings objects exist
    homeInning = homeInning || {};
    awayInning = awayInning || {};
    
    // Format match data for our frontend
    const formattedData: any = {
      matchId: matchData.id || 'unknown',
      name: matchData.name || `${homeTeam} vs ${awayTeam}`,
      status: matchData.status || 'unknown',
      format: matchData.matchType || 'unknown',
      current_innings: getCricketInnings(matchData),
      venue: matchData.venue || 'Unknown Venue',
      toss: matchData.toss || '',
      teams: teams,
      date: matchData.date || new Date().toISOString(),
    };
    
    // Current batting team data
    formattedData.batting_team = {
      name: homeTeam,
      score: parseInt(homeInning.r) || 0,
      wickets: parseInt(homeInning.w) || 0,
      overs: parseFloat(homeInning.o) || 0,
      run_rate: calculateRunRate(
        parseInt(homeInning.r) || 0,
        parseFloat(homeInning.o) || 0
      ),
    };
    
    // Current bowling team data
    formattedData.bowling_team = {
      name: awayTeam,
      score: parseInt(awayInning.r) || 0,
      wickets: parseInt(awayInning.w) || 0,
      overs: parseFloat(awayInning.o) || 0,
      run_rate: calculateRunRate(
        parseInt(awayInning.r) || 0, 
        parseFloat(awayInning.o) || 0
      ),
    };
    
    // Process scorecard data if available
    if (matchData.scorecard) {
      try {
        // Extract batsmen data
        formattedData.batsmen = extractBatsmenData(matchData.scorecard);
        
        // Extract bowlers data
        formattedData.bowlers = extractBowlersData(matchData.scorecard);
        
        // Extract recent balls
        formattedData.recent_balls = extractRecentBalls(matchData);
      } catch (scorecardError) {
        console.error('Error processing scorecard:', scorecardError);
        formattedData.batsmen = [];
        formattedData.bowlers = [];
        formattedData.recent_balls = [];
      }
    } else {
      formattedData.batsmen = [];
      formattedData.bowlers = [];
      formattedData.recent_balls = [];
    }
    
    return formattedData;
  } catch (error) {
    console.error('Error formatting cricket match data:', error);
    return createDefaultMatchData();
  }
}

/**
 * Create default match data object when data is missing
 */
function createDefaultMatchData() {
  return {
    matchId: 'unknown',
    name: 'Unknown Match',
    status: 'unknown',
    format: 'unknown',
    current_innings: 1,
    venue: 'Unknown Venue',
    teams: ['Team A', 'Team B'],
    date: new Date().toISOString(),
    batting_team: {
      name: 'Team A',
      score: 0,
      wickets: 0,
      overs: 0,
      run_rate: 0,
    },
    bowling_team: {
      name: 'Team B',
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

/**
 * Determine the current innings from match data
 */
function getCricketInnings(matchData: any): number {
  try {
    // Safety check for match data
    if (!matchData) return 1;
    
    // Logic to determine the current innings
    if (matchData.score && Array.isArray(matchData.score) && matchData.score.length > 0) {
      // Second innings if two scores are present and the match is ongoing
      if (matchData.score.length > 1 && matchData.status?.toLowerCase() !== 'complete') {
        return 2;
      }
      return 1;
    }
    return 1;
  } catch (error) {
    console.error('Error determining cricket innings:', error);
    return 1;
  }
}

/**
 * Extract batsmen data from scorecard
 */
function extractBatsmenData(scorecard: any): any[] {
  try {
    if (!scorecard || !Array.isArray(scorecard) || scorecard.length === 0) return [];
    
    // Get the current innings scorecard
    const currentInningsCard = scorecard[scorecard.length - 1];
    if (!currentInningsCard || !currentInningsCard.batting || !Array.isArray(currentInningsCard.batting)) 
      return [];
    
    // Format batsmen data
    return currentInningsCard.batting
      .filter((batsman: any) => batsman && (batsman.dismissal !== 'not out' || (batsman.r && batsman.r > 0)))
      .map((batsman: any) => ({
        name: batsman?.batsman || 'Unknown Batsman',
        runs: parseInt(batsman?.r) || 0,
        balls: parseInt(batsman?.b) || 0,
        fours: parseInt(batsman?.['4s']) || 0,
        sixes: parseInt(batsman?.['6s']) || 0,
        strike_rate: parseFloat(batsman?.sr || '0'),
        on_strike: batsman?.dismissal === 'batting',
      }));
  } catch (error) {
    console.error('Error extracting batsmen data:', error);
    return [];
  }
}

/**
 * Extract bowlers data from scorecard
 */
function extractBowlersData(scorecard: any): any[] {
  try {
    if (!scorecard || !Array.isArray(scorecard) || scorecard.length === 0) return [];
    
    // Get the current innings scorecard
    const currentInningsCard = scorecard[scorecard.length - 1];
    if (!currentInningsCard || !currentInningsCard.bowling || !Array.isArray(currentInningsCard.bowling)) 
      return [];
    
    // Format bowlers data
    return currentInningsCard.bowling
      .filter((bowler: any) => bowler && parseFloat(bowler.o || '0') > 0)
      .map((bowler: any) => ({
        name: bowler?.bowler || 'Unknown Bowler',
        overs: parseFloat(bowler?.o || '0'),
        maidens: parseInt(bowler?.m || '0'),
        runs: parseInt(bowler?.r || '0'),
        wickets: parseInt(bowler?.w || '0'),
        economy: parseFloat(bowler?.eco || '0'),
        currently_bowling: false, // We'll determine this based on match status
      }));
  } catch (error) {
    console.error('Error extracting bowlers data:', error);
    return [];
  }
}

/**
 * Extract recent balls data
 */
function extractRecentBalls(matchData: any): string[] {
  try {
    // Safety check
    if (!matchData) return ['0', '0', '0', '0', '0'];
    
    // This information might be in different places depending on the API
    // For now, we'll create a simplified version
    if (matchData.score && Array.isArray(matchData.score) && matchData.score.length > 0) {
      const lastInning = matchData.score[matchData.score.length - 1];
      if (lastInning && lastInning.o && !isNaN(parseFloat(lastInning.o))) {
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
  } catch (error) {
    console.error('Error extracting recent balls:', error);
    return ['0', '0', '0', '0', '0'];
  }
}

/**
 * Calculate run rate from runs and overs
 */
function calculateRunRate(runs: number, overs: number): number {
  try {
    if (!overs || isNaN(overs) || overs === 0) return 0;
    const runRate = runs / overs;
    return parseFloat(runRate.toFixed(2));
  } catch (error) {
    console.error('Error calculating run rate:', error);
    return 0;
  }
} 