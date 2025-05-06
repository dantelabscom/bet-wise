import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { markets, events, sports, marketOptions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { Market, getMarketDescription } from '@/lib/models/market';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Await params before accessing its properties
    const awaitedParams = await params;
    const { id } = awaitedParams;
    
    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: 'Invalid market ID' },
        { status: 400 }
      );
    }

    const marketId = Number(id);

    // Fetch market with relations
    const marketData = await db.query.markets.findFirst({
      where: eq(markets.id, marketId),
      with: {
        event: {
          with: {
            sport: true,
          },
        },
        options: true,
      },
    });

    if (!marketData) {
      return NextResponse.json(
        { error: 'Market not found' },
        { status: 404 }
      );
    }

    // Format the response
    const formattedMarket: Market = {
      id: marketData.id,
      eventId: marketData.eventId,
      name: marketData.name,
      description: marketData.description || undefined,
      type: marketData.type,
      status: marketData.status,
      metadata: marketData.metadata as Record<string, any> | undefined,
      settledOption: marketData.settledOption || undefined,
      settledAt: marketData.settledAt || undefined,
      suspendedReason: marketData.suspendedReason || undefined,
      tradingVolume: marketData.tradingVolume,
      createdAt: marketData.createdAt,
      updatedAt: marketData.updatedAt,
      options: marketData.options.map(option => ({
        id: option.id,
        marketId: option.marketId,
        name: option.name,
        initialPrice: option.initialPrice,
        currentPrice: option.currentPrice,
        lastPrice: option.lastPrice?.toString(),
        minPrice: option.minPrice?.toString(),
        maxPrice: option.maxPrice?.toString(),
        metadata: option.metadata as Record<string, any> | undefined,
        weight: option.weight,
        createdAt: option.createdAt,
        updatedAt: option.updatedAt,
      })),
      event: {
        id: marketData.event.id,
        name: marketData.event.name,
        homeTeam: marketData.event.homeTeam || undefined,
        awayTeam: marketData.event.awayTeam || undefined,
        startTime: marketData.event.startTime,
        endTime: marketData.event.endTime || undefined,
        result: marketData.event.result as Record<string, any> | undefined,
        sport: {
          id: marketData.event.sport.id,
          name: marketData.event.sport.name,
          type: marketData.event.sport.type,
        },
      },
    };

    // Generate a market description if one isn't provided
    if (!formattedMarket.description) {
      formattedMarket.description = getMarketDescription(formattedMarket);
    }

    return NextResponse.json(formattedMarket);
  } catch (error: any) {
    console.error('Error fetching market:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    // Await params before accessing its properties
    const awaitedParams = await params;
    const { id } = awaitedParams;
    
    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: 'Invalid market ID' },
        { status: 400 }
      );
    }

    const marketId = Number(id);
    const body = await request.json();

    // Check if market exists
    const existingMarket = await db.query.markets.findFirst({
      where: eq(markets.id, marketId),
    });

    if (!existingMarket) {
      return NextResponse.json(
        { error: 'Market not found' },
        { status: 404 }
      );
    }

    // Fields that can be updated
    const allowedFields = [
      'name',
      'description',
      'status',
      'metadata',
      'settledOption',
      'suspendedReason',
    ];

    // Create update object with only allowed fields
    const updateData: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Add update timestamp
    updateData.updatedAt = new Date();

    // If settling the market, add settledAt date
    if (body.status === 'settled' && existingMarket.status !== 'settled') {
      updateData.settledAt = new Date();
    }

    // Perform update
    const [updatedMarket] = await db
      .update(markets)
      .set(updateData)
      .where(eq(markets.id, marketId))
      .returning();

    // Update market options if provided
    if (body.options && Array.isArray(body.options)) {
      for (const option of body.options) {
        if (option.id && option.currentPrice) {
          await db
            .update(marketOptions)
            .set({
              currentPrice: option.currentPrice.toString(),
              lastPrice: option.lastPrice?.toString() || marketOptions.currentPrice,
              updatedAt: new Date(),
            })
            .where(and(
              eq(marketOptions.id, option.id),
              eq(marketOptions.marketId, marketId)
            ));
        }
      }
    }

    return NextResponse.json(updatedMarket);
  } catch (error: any) {
    console.error('Error updating market:', error);
    return NextResponse.json(
      { error: 'Failed to update market' },
      { status: 500 }
    );
  }
} 