import { NextRequest, NextResponse } from 'next/server';
import { sportMonksService } from '@/lib/services/api/sportmonks-service';

export async function GET(req: NextRequest) {
  try {
    const seasonId = req.nextUrl.searchParams.get('seasonId');
    const includes = req.nextUrl.searchParams.get('include')?.split(',') || ['localTeam', 'visitorTeam', 'venue', 'stage'];
    
    if (!seasonId) {
      return NextResponse.json(
        { error: 'seasonId is required' },
        { status: 400 }
      );
    }

    const data = await sportMonksService.getFixturesBySeason(Number(seasonId), includes);
    
    return NextResponse.json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Error fetching cricket fixtures:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch cricket fixtures' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic'; 