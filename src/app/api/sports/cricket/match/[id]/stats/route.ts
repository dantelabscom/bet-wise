import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { sportMonksCricket } from '@/lib/services/sports-data/sportmonks-cricket';

/**
 * @route GET /api/sports/cricket/match/[id]/stats
 * @desc Get detailed stats for a cricket match
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

    // Get match ID from params
    const params = await Promise.resolve(context.params);
    const matchId = params.id;
    
    if (!matchId) {
      return NextResponse.json(
        { error: 'Match ID is required' }, 
        { status: 400 }
      );
    }

    console.log(`Fetching stats for match ID: ${matchId}`);

    try {
      // Fetch match data with detailed stats
      const matchData = await sportMonksCricket.getMatchScorecard(matchId);
      
      if (!matchData.success || !matchData.data) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Failed to fetch match data'
          }, 
          { status: 404 }
        );
      }
      
      // Process batting statistics
      const batsmen = [];
      const bowlers = [];
      let battingTeam = null;
      let bowlingTeam = null;
      
      if (matchData.data.scoreboards && Array.isArray(matchData.data.scoreboards)) {
        // Get current batting team
        const battingTeamId = matchData.data.scoreboards.find(
          (board: any) => board.type === 'batting' && board.active
        )?.team_id;
        
        // Get the batting and bowling team data
        if (battingTeamId) {
          const isLocalTeamBatting = battingTeamId === matchData.data.localteam_id;
          
          // Set batting team
          battingTeam = {
            name: isLocalTeamBatting 
              ? matchData.data.localteam?.name 
              : matchData.data.visitorteam?.name,
            score: 0,
            wickets: 0,
            overs: 0,
            runRate: 0
          };
          
          // Set bowling team
          bowlingTeam = {
            name: isLocalTeamBatting 
              ? matchData.data.visitorteam?.name 
              : matchData.data.localteam?.name,
            score: 0,
            wickets: 0,
            overs: 0,
            runRate: 0
          };
          
          // Get current innings runs
          const currentInning = matchData.data.runs?.find(
            (run: any) => run.team_id === battingTeamId && run.inning === matchData.data.current_inning
          );
          
          if (currentInning) {
            battingTeam.score = currentInning.score || 0;
            battingTeam.wickets = currentInning.wickets || 0;
            battingTeam.overs = currentInning.overs || 0;
            battingTeam.runRate = currentInning.score && currentInning.overs 
              ? parseFloat((currentInning.score / currentInning.overs).toFixed(2)) 
              : 0;
          }
          
          // Get batting stats
          const battingScoreboards = matchData.data.scoreboards.filter(
            (board: any) => board.type === 'batting' && board.team_id === battingTeamId
          );
          
          for (const board of battingScoreboards) {
            batsmen.push({
              name: board.player_name,
              runs: board.runs || 0,
              balls: board.balls || 0,
              fours: board.fours || 0,
              sixes: board.sixes || 0,
              strikeRate: board.strike_rate || 0
            });
          }
          
          // Get bowling stats
          const bowlingScoreboards = matchData.data.scoreboards.filter(
            (board: any) => board.type === 'bowling' && board.team_id !== battingTeamId
          );
          
          for (const board of bowlingScoreboards) {
            bowlers.push({
              name: board.player_name,
              overs: board.overs || 0,
              maidens: board.medians || 0,
              runs: board.runs || 0,
              wickets: board.wickets || 0,
              economy: board.rate || 0
            });
          }
          
          // Get previous innings score for bowling team
          const previousInning = matchData.data.runs?.find(
            (run: any) => run.team_id !== battingTeamId && run.inning < matchData.data.current_inning
          );
          
          if (previousInning) {
            bowlingTeam.score = previousInning.score || 0;
            bowlingTeam.wickets = previousInning.wickets || 0;
            bowlingTeam.overs = previousInning.overs || 0;
            bowlingTeam.runRate = previousInning.score && previousInning.overs 
              ? parseFloat((previousInning.score / previousInning.overs).toFixed(2)) 
              : 0;
          }
        }
      }
      
      // Return processed stats
      return NextResponse.json({
        success: true,
        data: {
          battingTeam,
          bowlingTeam,
          batsmen,
          bowlers
        }
      });
    } catch (apiError: any) {
      console.error('Error fetching match stats:', apiError);
      return NextResponse.json(
        { 
          success: false,
          error: apiError.message || 'API service error'
        }, 
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error in match stats endpoint:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'An unexpected error occurred'
      }, 
      { status: 500 }
    );
  }
} 