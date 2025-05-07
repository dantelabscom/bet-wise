import { NextRequest, NextResponse } from 'next/server';
import { sportMonksService } from '@/lib/services/api/sportmonks-service';

export async function GET(req: NextRequest) {
  try {
    const includes = req.nextUrl.searchParams.get('include')?.split(',') || [];
    const currentOnly = req.nextUrl.searchParams.get('current') === 'true';
    
    let data;
    
    if (currentOnly) {
      data = await sportMonksService.getCurrentSeasons(includes);
    } else {
      data = await sportMonksService.getSeasons(includes);
    }
    
    return NextResponse.json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Error fetching cricket seasons:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch cricket seasons' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic'; 