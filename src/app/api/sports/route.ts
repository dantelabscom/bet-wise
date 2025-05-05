import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sports } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // Fetch all active sports
    const allSports = await db
      .select({
        id: sports.id,
        name: sports.name,
        type: sports.type,
        isActive: sports.isActive,
        createdAt: sports.createdAt,
      })
      .from(sports)
      .where(eq(sports.isActive, true))
      .orderBy(desc(sports.name));

    return NextResponse.json({
      sports: allSports,
      count: allSports.length,
    });
  } catch (error: any) {
    console.error('Error fetching sports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sports' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    
    // Validate required fields
    if (!body.name || !body.type) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type' },
        { status: 400 }
      );
    }
    
    // Create the sport
    const [newSport] = await db.insert(sports).values({
      name: body.name,
      type: body.type,
      isActive: body.isActive !== undefined ? body.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    
    return NextResponse.json(newSport);
  } catch (error: any) {
    console.error('Error creating sport:', error);
    return NextResponse.json(
      { error: 'Failed to create sport' },
      { status: 500 }
    );
  }
} 