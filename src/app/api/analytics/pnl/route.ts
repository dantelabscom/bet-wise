import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';
import { eq, and, gte, lte } from 'drizzle-orm';
import { orders, positions } from '@/lib/db/schema';

// Position and order types
interface Position {
  id: number;
  userId: string;
  marketId: number;
  marketOptionId: number;
  quantity: string;
  averagePrice: string;
  realizedPnl: string;
  status: 'open' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}

interface Order {
  id: number;
  userId: string;
  marketId: number;
  marketOptionId: number;
  type: 'market' | 'limit' | 'stop' | 'trailing';
  side: 'buy' | 'sell';
  price: string;
  quantity: string;
  filledQuantity: string;
  filledPrice?: string;
  status: 'open' | 'cancelled' | 'filled' | 'partially_filled';
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// PnL data point
interface PnLDataPoint {
  date: string;
  pnl: number;
  cumulativePnl: number;
}

export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get('timeRange') || '1m';
    
    // Calculate date range
    const endDate = new Date();
    let startDate = new Date();
    
    switch (timeRange) {
      case '1d':
        startDate.setDate(endDate.getDate() - 1);
        break;
      case '1w':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '1m':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case '3m':
        startDate.setMonth(endDate.getMonth() - 3);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      case 'all':
        startDate = new Date(0); // Beginning of time
        break;
      default:
        startDate.setMonth(endDate.getMonth() - 1); // Default to 1 month
    }
    
    // Get closed positions within the time range
    const closedPositions = await db.select()
      .from(positions)
      .where(
        and(
          eq(positions.userId, session.user.email),
          gte(positions.updatedAt, startDate),
          lte(positions.updatedAt, endDate)
        )
      ) as unknown as Position[];
    
    // Get filled orders within the time range
    const filledOrders = await db.select()
      .from(orders)
      .where(
        and(
          eq(orders.userId, session.user.email),
          eq(orders.status, 'filled'),
          gte(orders.updatedAt, startDate),
          lte(orders.updatedAt, endDate)
        )
      ) as Order[];
    
    // Create a map of daily P&L data
    const pnlMap = new Map<string, PnLDataPoint>();
    
    // Initialize the map with dates in the range
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateString = currentDate.toISOString().split('T')[0];
      pnlMap.set(dateString, {
        date: dateString,
        pnl: 0,
        cumulativePnl: 0
      });
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Add P&L from closed positions
    closedPositions.forEach(position => {
      if (position.status === 'closed') {
        const dateString = new Date(position.updatedAt).toISOString().split('T')[0];
        
        // Get or create data point for this date
        const dataPoint = pnlMap.get(dateString) || {
          date: dateString,
          pnl: 0,
          cumulativePnl: 0
        };
        
        // Add P&L from this position
        const positionPnL = parseFloat(position.realizedPnl);
        dataPoint.pnl += positionPnL;
        
        // Update the map
        pnlMap.set(dateString, dataPoint);
      }
    });
    
    // Add P&L from filled orders
    filledOrders.forEach(order => {
      const dateString = new Date(order.updatedAt).toISOString().split('T')[0];
      
      // Get or create data point for this date
      const dataPoint = pnlMap.get(dateString) || {
        date: dateString,
        pnl: 0,
        cumulativePnl: 0
      };
      
      // Calculate P&L for this order (simplified)
      if (order.filledPrice) {
        const orderPnL = (parseFloat(order.filledPrice) - parseFloat(order.price)) * 
          (order.side === 'buy' ? 1 : -1) * parseFloat(order.filledQuantity);
        
        dataPoint.pnl += orderPnL;
      }
      
      // Update the map
      pnlMap.set(dateString, dataPoint);
    });
    
    // Convert map to array and sort by date
    const pnlData = Array.from(pnlMap.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    // Calculate cumulative P&L
    let cumulativePnl = 0;
    pnlData.forEach(dataPoint => {
      cumulativePnl += dataPoint.pnl;
      dataPoint.cumulativePnl = cumulativePnl;
    });
    
    return NextResponse.json(pnlData);
    
  } catch (error) {
    console.error('Error fetching P&L data:', error);
    return NextResponse.json({ error: 'Failed to fetch P&L data' }, { status: 500 });
  }
} 