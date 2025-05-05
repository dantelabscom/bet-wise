import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserPositions } from '@/lib/services/order-matching';
import { calculatePositionValue } from '@/lib/models/position';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get user positions
    const positions = await getUserPositions(session.user.id);
    
    // Calculate additional position metrics
    const positionsWithMetrics = positions.map(position => {
      const metrics = calculatePositionValue(position);
      return {
        ...position,
        metrics,
      };
    });
    
    return NextResponse.json({ positions: positionsWithMetrics });
  } catch (error: any) {
    console.error('Error fetching positions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch positions' },
      { status: 500 }
    );
  }
} 