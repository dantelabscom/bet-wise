import { NextRequest, NextResponse } from 'next/server';
import { demoUserService } from '@/lib/services/liquidity/demo-user-service';

// Create a new demo user
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name } = body;
    
    const demoUser = demoUserService.createDemoUser(name || 'Demo User');
    
    return NextResponse.json({
      success: true,
      user: {
        id: demoUser.id,
        name: demoUser.name,
        balance: demoUser.balance
      }
    });
  } catch (error: any) {
    console.error('Error creating demo user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create demo user' },
      { status: 500 }
    );
  }
}

// Get a demo user's portfolio
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    const portfolio = demoUserService.getPortfolio(userId);
    
    if (!portfolio) {
      return NextResponse.json(
        { error: `Demo user ${userId} not found` },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: portfolio
    });
  } catch (error: any) {
    console.error('Error getting demo user portfolio:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get demo user portfolio' },
      { status: 500 }
    );
  }
}

// Reset or delete a demo user
export async function DELETE(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    const action = req.nextUrl.searchParams.get('action') || 'delete';
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    let success = false;
    
    if (action === 'reset') {
      success = demoUserService.resetDemoUser(userId);
    } else {
      success = demoUserService.deleteDemoUser(userId);
    }
    
    if (!success) {
      return NextResponse.json(
        { error: `Failed to ${action} demo user ${userId}` },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: `Demo user ${userId} ${action === 'reset' ? 'reset' : 'deleted'} successfully`
    });
  } catch (error: any) {
    console.error(`Error ${req.nextUrl.searchParams.get('action') || 'deleting'} demo user:`, error);
    return NextResponse.json(
      { error: error.message || `Failed to ${req.nextUrl.searchParams.get('action') || 'delete'} demo user` },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic'; 