import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createOrder, getUserOrders, cancelOrder } from '@/lib/services/order-matching';
import { Order, OrderCreationParams } from '@/lib/models/order';
import { tradingEngineClient } from '@/lib/clients/trading-engine-client';

// Feature flag to control whether to use the Rust trading engine
const USE_RUST_ENGINE = process.env.USE_RUST_ENGINE === 'true';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    
    // Get user orders
    const orders = await getUserOrders(session.user.id, status || undefined);
    
    return NextResponse.json({ orders });
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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
    if (!body.marketId || !body.marketOptionId || !body.side || !body.quantity) {
      return NextResponse.json(
        { error: 'Missing required fields: marketId, marketOptionId, side, quantity' },
        { status: 400 }
      );
    }
    
    // For limit orders, price is required
    if ((body.type === 'limit' || !body.type) && !body.price) {
      return NextResponse.json(
        { error: 'Price is required for limit orders' },
        { status: 400 }
      );
    }
    
    // Create order params
    const orderParams: OrderCreationParams = {
      userId: session.user.id,
      marketId: parseInt(body.marketId),
      marketOptionId: parseInt(body.marketOptionId),
      type: body.type || 'limit',
      side: body.side,
      price: body.price || '0',
      quantity: body.quantity,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    };
    
    // Use Rust trading engine if feature flag is enabled
    if (USE_RUST_ENGINE) {
      try {
        // Format parameters for Rust engine
        const rustOrderParams = {
          user_id: session.user.id,
          market_id: parseInt(body.marketId),
          market_option_id: parseInt(body.marketOptionId),
          order_type: body.type || 'limit',
          side: body.side,
          price: body.price || '0',
          quantity: body.quantity,
          expires_at: body.expiresAt || null,
        };
        
        // Call Rust trading engine
        const result = await tradingEngineClient.createOrder(rustOrderParams);
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to create order in trading engine');
        }
        
        return NextResponse.json({ 
          order: result.data,
          engine: 'rust'
        });
      } catch (error: any) {
        console.error('Error using Rust trading engine:', error);
        // Fall back to TypeScript implementation
        console.log('Falling back to TypeScript implementation');
      }
    }
    
    // Default to TypeScript implementation
    const order = await createOrder(orderParams);
    
    if (!order) {
      return NextResponse.json(
        { error: 'Failed to create order' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ 
      order,
      engine: 'typescript'
    });
  } catch (error: any) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create order' },
      { status: 500 }
    );
  }
} 