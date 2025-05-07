import { NextRequest, NextResponse } from 'next/server';
import { demoUserService } from '@/lib/services/liquidity/demo-user-service';
import { OrderType, OrderSide } from '@/lib/services/liquidity/bot-service';

// Place a new order for a demo user
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, marketId, type, side, price, quantity } = body;
    
    if (!userId || !marketId || !type || !side || !price || !quantity) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Validate order type
    if (!Object.values(OrderType).includes(type)) {
      return NextResponse.json(
        { error: 'Invalid order type' },
        { status: 400 }
      );
    }
    
    // Validate order side
    if (!Object.values(OrderSide).includes(side)) {
      return NextResponse.json(
        { error: 'Invalid order side' },
        { status: 400 }
      );
    }
    
    // Place the order
    const order = demoUserService.placeOrder(
      userId,
      marketId,
      type as OrderType,
      side as OrderSide,
      price,
      quantity
    );
    
    if (!order) {
      return NextResponse.json(
        { error: 'Failed to place order' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      order
    });
  } catch (error: any) {
    console.error('Error placing demo order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to place order' },
      { status: 500 }
    );
  }
}

// Cancel an order for a demo user
export async function DELETE(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    const orderId = req.nextUrl.searchParams.get('orderId');
    
    if (!userId || !orderId) {
      return NextResponse.json(
        { error: 'User ID and Order ID are required' },
        { status: 400 }
      );
    }
    
    const success = demoUserService.cancelOrder(userId, orderId);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to cancel order' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Order canceled successfully'
    });
  } catch (error: any) {
    console.error('Error canceling demo order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cancel order' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic'; 