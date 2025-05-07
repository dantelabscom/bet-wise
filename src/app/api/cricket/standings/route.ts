import { NextRequest, NextResponse } from 'next/server';
import { sportMonksService } from '@/lib/services/api/sportmonks-service';

export async function GET(req: NextRequest) {
  try {
    const seasonId = req.nextUrl.searchParams.get('seasonId');
    const stageId = req.nextUrl.searchParams.get('stageId');
    const includes = req.nextUrl.searchParams.get('include')?.split(',') || ['league', 'season', 'stage'];
    
    if (!seasonId && !stageId) {
      return NextResponse.json(
        { error: 'Either seasonId or stageId is required' },
        { status: 400 }
      );
    }

    let data;
    
    if (seasonId) {
      data = await sportMonksService.getStandingsBySeason(Number(seasonId), includes);
    } else if (stageId) {
      data = await sportMonksService.getStandingsByStage(Number(stageId), includes);
    }
    
    return NextResponse.json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Error fetching cricket standings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch cricket standings' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic'; 