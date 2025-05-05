import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { cricApi } from '@/lib/services/sports-data/cricapi';

/**
 * @route GET /api/sports/cricket/matches
 * @desc Get current cricket matches
 * @access Private
 */
export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const offset = parseInt(searchParams.get('offset') || '0');

    // Fetch current cricket matches
    const result = await cricApi.getCurrentMatches(offset);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch cricket matches' }, 
        { status: 500 }
      );
    }

    // Transform data to our standard format if needed
    const transformedData = Array.isArray(result.data) 
      ? result.data.map(match => cricApi.transformToStandardFormat(match))
      : result.data;

    // Return the data
    return NextResponse.json({
      success: true,
      data: transformedData
    });
  } catch (error: any) {
    console.error('Error fetching cricket matches:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' }, 
      { status: 500 }
    );
  }
} 