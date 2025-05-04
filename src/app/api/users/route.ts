import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, wallets } from '@/lib/db/schema';

export async function POST(request: NextRequest) {
  try {
    const { id, email, name } = await request.json();

    if (!id || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: id or email' },
        { status: 400 }
      );
    }

    // Create user in the database
    const newUser = await db.transaction(async (tx) => {
      // Insert user
      await tx.insert(users).values({
        id,
        email,
        name: name || null,
      });

      // Create wallet for the user
      await tx.insert(wallets).values({
        userId: id,
        balance: '1000', // Default balance for new users
      });

      // Return the created user
      return { id, email, name };
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error: any) {
    console.error('Error creating user:', error);
    
    // Check for unique constraint violation (user already exists)
    if (error.message?.includes('unique constraint')) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
} 