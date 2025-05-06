import { NextRequest, NextResponse } from 'next/server';
import { getOrderBook } from '@/lib/services/order-matching';
import { tradingEngineClient } from '@/lib/clients/trading-engine-client';

// Feature flag to control whether to use the Rust trading engine
const USE_RUST_ENGINE = process.env.USE_RUST_ENGINE === 'true';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const marketId = parseInt(params.id);
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const optionId = searchParams.get('optionId');
    
    if (!optionId) {
      return NextResponse.json(
        { error: 'Option ID is required' },
        { status: 400 }
      );
    }
    
    // Use Rust trading engine if feature flag is enabled
    if (USE_RUST_ENGINE) {
      try {
        const result = await tradingEngineClient.getOrderBook(
          marketId, 
          parseInt(optionId)
        );
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch order book from trading engine');
        }
        
        return NextResponse.json({
          orderBook: result.data,
          engine: 'rust'
        });
      } catch (error: any) {
        console.error('Error using Rust trading engine for orderbook:', error);
        // Fall back to TypeScript implementation
        console.log('Falling back to TypeScript implementation for orderbook');
      }
    }
    
    // Default to TypeScript implementation
    const orderBook = await getOrderBook(marketId, parseInt(optionId));
    
    return NextResponse.json({
      orderBook,
      engine: 'typescript'
    });
  } catch (error: any) {
    console.error('Error fetching order book:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order book' },
      { status: 500 }
    );
  }
} 