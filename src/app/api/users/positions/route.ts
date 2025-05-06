import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { tradingEngineClient } from '@/lib/clients/trading-engine-client';
import { getUserPositions } from '@/lib/services/trading/positions';

// Feature flag to control whether to use the Rust trading engine
const USE_RUST_ENGINE = process.env.USE_RUST_ENGINE === 'true';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Use Rust trading engine if feature flag is enabled
    if (USE_RUST_ENGINE) {
      try {
        const result = await tradingEngineClient.getUserPositions(session.user.id);
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch positions from trading engine');
        }
        
        return NextResponse.json({
          positions: result.data,
          engine: 'rust'
        });
      } catch (error: any) {
        console.error('Error using Rust trading engine for positions:', error);
        // Fall back to TypeScript implementation
        console.log('Falling back to TypeScript implementation for positions');
      }
    }
    
    // Default to TypeScript implementation
    const positions = await getUserPositions(session.user.id);
    
    return NextResponse.json({
      positions,
      engine: 'typescript'
    });
  } catch (error: any) {
    console.error('Error fetching positions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch positions' },
      { status: 500 }
    );
  }
} 