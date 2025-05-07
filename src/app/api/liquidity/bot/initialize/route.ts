import { NextRequest, NextResponse } from 'next/server';
import { botService } from '@/lib/services/liquidity/bot-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { marketId, name, description, initialPrice } = body;
    
    if (!marketId) {
      return NextResponse.json(
        { error: 'Market ID is required' },
        { status: 400 }
      );
    }
    
    // Initialize market with bot liquidity
    botService.initializeMarket(
      marketId,
      name || `Market ${marketId}`,
      description || `Description for market ${marketId}`,
      initialPrice || 0.5
    );
    
    // Start liquidity generation
    botService.startLiquidityGeneration(marketId);
    
    return NextResponse.json({
      success: true,
      message: `Bot liquidity initialized for market ${marketId}`
    });
  } catch (error: any) {
    console.error('Error initializing bot liquidity:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initialize bot liquidity' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const marketId = req.nextUrl.searchParams.get('marketId');
    
    if (!marketId) {
      return NextResponse.json(
        { error: 'Market ID is required' },
        { status: 400 }
      );
    }
    
    const marketData = botService.getMarketData(marketId);
    
    if (!marketData) {
      return NextResponse.json(
        { error: `Market ${marketId} not found or not initialized` },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: marketData
    });
  } catch (error: any) {
    console.error('Error getting market data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get market data' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic'; 