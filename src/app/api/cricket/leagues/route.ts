import { NextRequest, NextResponse } from 'next/server';
import { sportMonksService } from '@/lib/services/api/sportmonks-service';

export async function GET(req: NextRequest) {
  try {
    const includes = req.nextUrl.searchParams.get('include')?.split(',') || [];
    
    const data = await sportMonksService.getLeagues(includes);
    
    return NextResponse.json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Error fetching cricket leagues:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch cricket leagues' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic'; 