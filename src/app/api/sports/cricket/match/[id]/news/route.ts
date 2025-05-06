import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { sportMonksCricket } from '@/lib/services/sports-data/sportmonks-cricket';

/**
 * @route GET /api/sports/cricket/match/[id]/news
 * @desc Get news and updates for a cricket match
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

    console.log(`Fetching news for match ID: ${matchId}`);

    try {
      // For now we'll use mock data since SportMonks may not provide match news
      // In a production environment, you would integrate with a news API or fetch from your database
      const now = Date.now();
      const mockNews = [
        {
          id: '1',
          title: 'Team A wins the toss',
          content: 'Team A has won the toss and elected to bat first.',
          timestamp: now - 1000 * 60 * 30, // 30 minutes ago
          type: 'update'
        },
        {
          id: '2',
          title: 'Player Injury Update',
          content: 'Star batsman from Team B is nursing a hamstring injury but is expected to play.',
          source: 'Cricket News Network',
          timestamp: now - 1000 * 60 * 60, // 1 hour ago
          type: 'news'
        },
        {
          id: '3',
          title: 'Weather Update',
          content: 'Clear skies expected throughout the match with no chance of rain.',
          timestamp: now - 1000 * 60 * 90, // 1.5 hours ago
          type: 'update'
        },
        {
          id: '4',
          title: 'Match Preview',
          content: 'Both teams come into this match with strong recent performances. Team A has won their last 3 matches while Team B is looking to bounce back from a narrow defeat.',
          source: 'Cricket Analysis',
          timestamp: now - 1000 * 60 * 120, // 2 hours ago
          type: 'news'
        },
        {
          id: '5',
          title: 'Pitch Report',
          content: 'The pitch is expected to be good for batting with some assistance for spinners later in the match.',
          source: 'Stadium Expert',
          timestamp: now - 1000 * 60 * 150, // 2.5 hours ago
          type: 'news'
        }
      ];
      
      // Try to fetch match details to use real team names
      const matchDetails = await sportMonksCricket.getFixtureById(matchId);
      
      if (matchDetails.success && matchDetails.data) {
        // Replace generic team names with actual team names
        const localTeam = matchDetails.data.localteam?.name || 'Team A';
        const visitorTeam = matchDetails.data.visitorteam?.name || 'Team B';
        
        // Update the mock news with real team names
        mockNews.forEach(item => {
          item.title = item.title.replace('Team A', localTeam).replace('Team B', visitorTeam);
          item.content = item.content.replace(/Team A/g, localTeam).replace(/Team B/g, visitorTeam);
        });
      }
      
      return NextResponse.json({
        success: true,
        data: mockNews
      });
    } catch (apiError: any) {
      console.error('Error fetching match news:', apiError);
      return NextResponse.json(
        { 
          success: false,
          error: apiError.message || 'API service error'
        }, 
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error in match news endpoint:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'An unexpected error occurred'
      }, 
      { status: 500 }
    );
  }
} 