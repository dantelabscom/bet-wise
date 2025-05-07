import { NextRequest, NextResponse } from 'next/server';
import { sentimentService, SentimentLevel } from '@/lib/services/liquidity/sentiment-service';

// Create a new market with sentiment
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, customData } = body;
    
    if (!type) {
      return NextResponse.json(
        { error: 'Market type is required' },
        { status: 400 }
      );
    }
    
    // Create predefined market based on type
    const marketId = sentimentService.createPredefinedMarket(
      type,
      customData
    );
    
    return NextResponse.json({
      success: true,
      marketId,
      message: `Market created with ID: ${marketId}`
    });
  } catch (error: any) {
    console.error('Error creating market with sentiment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create market' },
      { status: 500 }
    );
  }
}

// Get market sentiment data
export async function GET(req: NextRequest) {
  try {
    const marketId = req.nextUrl.searchParams.get('marketId');
    const historyOnly = req.nextUrl.searchParams.get('historyOnly') === 'true';
    
    if (!marketId) {
      return NextResponse.json(
        { error: 'Market ID is required' },
        { status: 400 }
      );
    }
    
    if (historyOnly) {
      // Return only price history for charts
      const history = sentimentService.getSentimentHistory(marketId);
      
      if (!history || history.length === 0) {
        return NextResponse.json(
          { error: `No history found for market ${marketId}` },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        history
      });
    } else {
      // Return full sentiment data
      const sentiment = sentimentService.getMarketSentiment(marketId);
      
      if (!sentiment) {
        return NextResponse.json(
          { error: `Market ${marketId} not found or not initialized with sentiment` },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        data: sentiment
      });
    }
  } catch (error: any) {
    console.error('Error getting market sentiment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get market sentiment' },
      { status: 500 }
    );
  }
}

// Add an event to a market
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { marketId, title, description, sentimentImpact } = body;
    
    if (!marketId || !title || sentimentImpact === undefined) {
      return NextResponse.json(
        { error: 'Market ID, title, and sentimentImpact are required' },
        { status: 400 }
      );
    }
    
    // Add event to market
    sentimentService.addMarketEvent({
      id: `event-${Date.now()}`,
      marketId,
      title,
      description: description || '',
      sentimentImpact: Number(sentimentImpact),
      timestamp: Date.now()
    });
    
    return NextResponse.json({
      success: true,
      message: `Event added to market ${marketId}`
    });
  } catch (error: any) {
    console.error('Error adding market event:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add market event' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic'; 