import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { wallets, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Get the user's session with auth options
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Find the user's wallet
    const wallet = await db.query.wallets.findFirst({
      where: eq(wallets.userId, session.user.id),
    });

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: wallet.id,
      balance: wallet.balance,
      userId: wallet.userId,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    });
  } catch (error: any) {
    console.error('Error fetching wallet:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallet' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Get the user's session with auth options
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse the request body
    const body = await request.json();
    
    // Validate the request
    if (body.action !== 'deposit' && body.action !== 'withdraw') {
      return NextResponse.json(
        { error: 'Invalid action. Must be "deposit" or "withdraw"' },
        { status: 400 }
      );
    }
    
    if (!body.amount || isNaN(Number(body.amount)) || Number(body.amount) <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount. Must be a positive number' },
        { status: 400 }
      );
    }
    
    const amount = Number(body.amount);

    // Find the user's wallet
    const existingWallet = await db.query.wallets.findFirst({
      where: eq(wallets.userId, session.user.id),
    });

    if (!existingWallet) {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 }
      );
    }
    
    // Check if enough balance for withdrawal
    if (body.action === 'withdraw' && Number(existingWallet.balance) < amount) {
      return NextResponse.json(
        { error: 'Insufficient balance' },
        { status: 400 }
      );
    }
    
    // Calculate new balance
    const newBalance = body.action === 'deposit'
      ? Number(existingWallet.balance) + amount
      : Number(existingWallet.balance) - amount;
    
    // Update the wallet
    const updatedWallet = await db
      .update(wallets)
      .set({
        balance: newBalance.toString(),
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, existingWallet.id))
      .returning();
    
    return NextResponse.json(updatedWallet[0]);
  } catch (error: any) {
    console.error('Error updating wallet:', error);
    return NextResponse.json(
      { error: 'Failed to update wallet' },
      { status: 500 }
    );
  }
} 