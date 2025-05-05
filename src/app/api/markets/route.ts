import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { markets, events, sports, marketOptions, marketStatusEnum, marketTypeEnum } from '@/lib/db/schema';
import { desc, eq, sql, and, SQL, like, or } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Market, MarketOption, getMarketDescription } from '@/lib/models/market';

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = Number(searchParams.get('limit') || '10');
    const offset = Number(searchParams.get('offset') || '0');
    const sportId = searchParams.get('sportId');
    const type = searchParams.get('type'); // Market type filter
    const status = searchParams.get('status'); // Market status filter
    const search = searchParams.get('search'); // Search term
    
    // Validate query parameters
    if (isNaN(limit) || isNaN(offset) || limit < 1 || limit > 100 || offset < 0) {
      return NextResponse.json(
        { error: 'Invalid limit or offset parameters' },
        { status: 400 }
      );
    }

    // Build the where conditions
    const conditions = [];
    
    // Market status filter (default to open markets)
    if (status && isValidMarketStatus(status)) {
      conditions.push(eq(markets.status, status as any));
    } else {
      conditions.push(eq(markets.status, 'open'));
    }
    
    // Market type filter
    if (type && isValidMarketType(type)) {
      conditions.push(eq(markets.type, type as any));
    }
    
    // Sport filter
    if (sportId && !isNaN(Number(sportId))) {
      conditions.push(eq(sports.id, Number(sportId)));
    }
    
    // Search filter
    if (search) {
      conditions.push(
        or(
          like(markets.name, `%${search}%`),
          like(markets.description, `%${search}%`),
          like(events.name, `%${search}%`),
          like(events.homeTeam, `%${search}%`),
          like(events.awayTeam, `%${search}%`)
        )
      );
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
        type: markets.type,
        status: markets.status,
        metadata: markets.metadata,
        tradingVolume: markets.tradingVolume,
        settledOption: markets.settledOption,
        settledAt: markets.settledAt,
        suspendedReason: markets.suspendedReason,
        eventId: events.id,
        eventName: events.name,
        homeTeam: events.homeTeam,
        awayTeam: events.awayTeam,
        startTime: events.startTime,
        endTime: events.endTime,
        sportId: sports.id,
        sportName: sports.name,
        sportType: sports.type,
        result: events.result,
        createdAt: markets.createdAt,
        updatedAt: markets.updatedAt,
      })
      .from(markets)
      .innerJoin(events, eq(markets.eventId, events.id))
      .innerJoin(sports, eq(events.sportId, sports.id))
      .where(whereConditions)
      .orderBy(desc(events.startTime))
      .limit(limit)
      .offset(offset);

    // Get market options for each market
    const marketsWithOptions: Market[] = await Promise.all(
      marketResults.map(async (market) => {
        // Fetch options for each market
        const options = await db
          .select({
            id: marketOptions.id,
            marketId: marketOptions.marketId,
            name: marketOptions.name,
            initialPrice: marketOptions.initialPrice,
            currentPrice: marketOptions.currentPrice,
            lastPrice: marketOptions.lastPrice,
            metadata: marketOptions.metadata,
            weight: marketOptions.weight,
            createdAt: marketOptions.createdAt,
            updatedAt: marketOptions.updatedAt,
          })
          .from(marketOptions)
          .where(eq(marketOptions.marketId, market.id));

        // Construct a properly formatted market object
        const formattedMarket: Market = {
          id: market.id,
          eventId: market.eventId,
          name: market.name,
          description: market.description || undefined,
          type: market.type,
          status: market.status,
          metadata: market.metadata as Record<string, any> | undefined,
          settledOption: market.settledOption || undefined,
          settledAt: market.settledAt || undefined,
          suspendedReason: market.suspendedReason || undefined,
          tradingVolume: market.tradingVolume,
          createdAt: market.createdAt,
          updatedAt: market.updatedAt,
          options: options.map(option => ({
            id: option.id,
            marketId: option.marketId,
            name: option.name,
            initialPrice: option.initialPrice,
            currentPrice: option.currentPrice,
            lastPrice: option.lastPrice?.toString(),
            metadata: option.metadata as Record<string, any> | undefined,
            weight: option.weight,
            createdAt: option.createdAt,
            updatedAt: option.updatedAt,
          })),
          event: {
            id: market.eventId,
            name: market.eventName,
            homeTeam: market.homeTeam || undefined,
            awayTeam: market.awayTeam || undefined,
            startTime: market.startTime,
            endTime: market.endTime || undefined,
            result: market.result as Record<string, any> | undefined,
            sport: {
              id: market.sportId,
              name: market.sportName,
              type: market.sportType,
            },
          },
        };

        // Generate a market description if one isn't provided
        if (!formattedMarket.description) {
          formattedMarket.description = getMarketDescription(formattedMarket);
        }

        return formattedMarket;
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

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse request body
    const body = await request.json();
    
    // Validate required fields
    if (!body.eventId || !body.name || !body.options || !Array.isArray(body.options) || body.options.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: eventId, name, options' },
        { status: 400 }
      );
    }
    
    // Validate market type
    if (body.type && !isValidMarketType(body.type)) {
      return NextResponse.json(
        { error: 'Invalid market type' },
        { status: 400 }
      );
    }
    
    // Create the market
    const [newMarket] = await db.insert(markets).values({
      eventId: body.eventId,
      name: body.name,
      description: body.description,
      type: (body.type || 'winner') as any,
      status: 'open',
      metadata: body.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    
    // Create market options
    const optionValues = body.options.map((option: any) => ({
      marketId: newMarket.id,
      name: option.name,
      initialPrice: option.price.toString(),
      currentPrice: option.price.toString(),
      metadata: option.metadata,
      weight: option.weight?.toString() || '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    
    const newOptions = await db.insert(marketOptions).values(optionValues).returning();
    
    // Return the created market with options
    return NextResponse.json({
      id: newMarket.id,
      eventId: newMarket.eventId,
      name: newMarket.name,
      description: newMarket.description,
      type: newMarket.type,
      status: newMarket.status,
      metadata: newMarket.metadata,
      createdAt: newMarket.createdAt,
      updatedAt: newMarket.updatedAt,
      options: newOptions,
    });
  } catch (error: any) {
    console.error('Error creating market:', error);
    return NextResponse.json(
      { error: 'Failed to create market' },
      { status: 500 }
    );
  }
}

// Helper functions to validate enum values
function isValidMarketType(type: string): boolean {
  return ['winner', 'over_under', 'spread', 'prop', 'handicap', 'custom'].includes(type);
}

function isValidMarketStatus(status: string): boolean {
  return ['open', 'suspended', 'closed', 'settled', 'cancelled'].includes(status);
} 