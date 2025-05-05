import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { markets, events, sports, marketOptions } from '@/lib/db/schema';
import { desc, eq, sql, and, SQL } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // Get limit and offset from query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = Number(searchParams.get('limit') || '10');
    const offset = Number(searchParams.get('offset') || '0');
    const sportId = searchParams.get('sportId');
    
    // Validate query parameters
    if (isNaN(limit) || isNaN(offset) || limit < 1 || limit > 100 || offset < 0) {
      return NextResponse.json(
        { error: 'Invalid limit or offset parameters' },
        { status: 400 }
      );
    }

    // Build the where conditions
    const conditions = [];
    
    // Market must be open
    conditions.push(eq(markets.status, 'open'));
    
    // Add sport filter if provided
    if (sportId && !isNaN(Number(sportId))) {
      conditions.push(eq(sports.id, Number(sportId)));
    }
    
    // Combine all conditions with AND
    const whereConditions = conditions.length > 1 
      ? and(...conditions) 
      : conditions[0];

    // Execute the query with pagination
    const marketResults = await db
      .select({
        id: markets.id,
        name: markets.name,
        description: markets.description,
        status: markets.status,
        eventId: events.id,
        eventName: events.name,
        sportId: sports.id,
        sportName: sports.name,
        sportType: sports.type,
        startTime: events.startTime,
        endTime: events.endTime,
        createdAt: markets.createdAt,
      })
      .from(markets)
      .innerJoin(events, eq(markets.eventId, events.id))
      .innerJoin(sports, eq(events.sportId, sports.id))
      .where(whereConditions)
      .orderBy(desc(events.startTime))
      .limit(limit)
      .offset(offset);

    // Prepare data structure for response
    const marketsWithOptions = await Promise.all(
      marketResults.map(async (market) => {
        // Fetch options for each market
        const options = await db
          .select({
            id: marketOptions.id,
            name: marketOptions.name,
            currentPrice: marketOptions.currentPrice,
          })
          .from(marketOptions)
          .where(eq(marketOptions.marketId, market.id));

        return {
          id: market.id,
          name: market.name,
          description: market.description,
          status: market.status,
          event: {
            id: market.eventId,
            name: market.eventName,
            startTime: market.startTime,
            endTime: market.endTime,
          },
          sport: {
            id: market.sportId,
            name: market.sportName,
            type: market.sportType,
          },
          options: options,
          createdAt: market.createdAt,
        };
      })
    );

    // Get total count for pagination
    const [{ count }] = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(markets)
      .innerJoin(events, eq(markets.eventId, events.id))
      .innerJoin(sports, eq(events.sportId, sports.id))
      .where(whereConditions);

    return NextResponse.json({
      markets: marketsWithOptions,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + limit < count,
      },
    });
  } catch (error: any) {
    console.error('Error fetching markets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch markets' },
      { status: 500 }
    );
  }
} 