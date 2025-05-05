import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { events, sports } from '@/lib/db/schema';
import { desc, eq, and, gte, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = Number(searchParams.get('limit') || '50');
    const offset = Number(searchParams.get('offset') || '0');
    const sportId = searchParams.get('sportId');
    const includeFinished = searchParams.get('includeFinished') === 'true';
    const upcoming = searchParams.get('upcoming') === 'true';
    
    // Validate query parameters
    if (isNaN(limit) || isNaN(offset) || limit < 1 || limit > 100 || offset < 0) {
      return NextResponse.json(
        { error: 'Invalid limit or offset parameters' },
        { status: 400 }
      );
    }

    // Build the where conditions
    const conditions = [];
    
    // Filter events by sport if provided
    if (sportId && !isNaN(Number(sportId))) {
      conditions.push(eq(events.sportId, Number(sportId)));
    }
    
    // Only return active events by default
    conditions.push(eq(events.isActive, true));
    
    // Filter out finished events unless explicitly included
    if (!includeFinished) {
      conditions.push(
        and(
          sql`${events.endTime} IS NULL OR ${events.endTime} > NOW()`
        )
      );
    }
    
    // Filter for upcoming events only
    if (upcoming) {
      conditions.push(gte(events.startTime, new Date()));
    }
    
    // Combine all conditions with AND
    const whereConditions = conditions.length > 1 
      ? and(...conditions) 
      : conditions[0];

    // Execute the query with pagination
    const eventsResults = await db
      .select({
        id: events.id,
        name: events.name,
        description: events.description,
        sportId: events.sportId,
        homeTeam: events.homeTeam,
        awayTeam: events.awayTeam,
        startTime: events.startTime,
        endTime: events.endTime,
        isActive: events.isActive,
        result: events.result,
        sport: {
          id: sports.id,
          name: sports.name,
          type: sports.type,
        },
        createdAt: events.createdAt,
        updatedAt: events.updatedAt,
      })
      .from(events)
      .innerJoin(sports, eq(events.sportId, sports.id))
      .where(whereConditions)
      .orderBy(desc(events.startTime))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const [{ count }] = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(events)
      .where(whereConditions);

    return NextResponse.json({
      events: eventsResults,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + limit < count,
      },
    });
  } catch (error: any) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    
    // Validate required fields
    if (!body.name || !body.sportId || !body.startTime) {
      return NextResponse.json(
        { error: 'Missing required fields: name, sportId, startTime' },
        { status: 400 }
      );
    }
    
    // Create the event
    const [newEvent] = await db.insert(events).values({
      name: body.name,
      description: body.description,
      sportId: body.sportId,
      homeTeam: body.homeTeam,
      awayTeam: body.awayTeam,
      startTime: new Date(body.startTime),
      endTime: body.endTime ? new Date(body.endTime) : undefined,
      isActive: body.isActive !== undefined ? body.isActive : true,
      result: body.result,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    
    return NextResponse.json(newEvent);
  } catch (error: any) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
} 