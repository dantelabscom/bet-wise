import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';
import { orders, positions } from '@/lib/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

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
    
    // Get user orders within the time range
    const userOrders = await db.select()
      .from(orders)
      .where(
        and(
          eq(orders.userId, session.user.email),
          gte(orders.createdAt, startDate),
          lte(orders.createdAt, endDate)
        )
      ) as Order[];
    
    // Get user positions
    const userPositions = await db.select()
      .from(positions)
      .where(eq(positions.userId, session.user.email)) as unknown as Position[];
    
    // Calculate metrics
    let totalPnL = 0;
    let totalVolume = 0;
    let winCount = 0;
    let totalTrades = 0;
    let returns: number[] = [];
    
    // Calculate P&L and volume from closed positions
    userPositions.forEach(position => {
      if (position.status === 'closed') {
        const positionPnL = parseFloat(position.realizedPnl);
        totalPnL += positionPnL;
        
        // Volume is based on position size
        const positionVolume = parseFloat(position.quantity) * parseFloat(position.averagePrice);
        totalVolume += positionVolume;
        
        // Count wins
        if (positionPnL > 0) {
          winCount++;
        }
        
        // Add to total trades count
        totalTrades++;
        
        // Calculate return for this trade (for Sharpe ratio)
        const roi = positionPnL / positionVolume;
        returns.push(roi);
      }
    });
    
    // Calculate open positions value
    const openPositionsCount = userPositions.filter(p => p.status === 'open').length;
    
    // Calculate win rate
    const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;
    
    // Calculate ROI
    const roi = totalVolume > 0 ? (totalPnL / totalVolume) * 100 : 0;
    
    // Calculate Sharpe Ratio (simplified)
    let sharpeRatio = 0;
    if (returns.length > 1) {
      const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
      const stdDev = Math.sqrt(variance);
      sharpeRatio = stdDev !== 0 ? meanReturn / stdDev : 0;
    }
    
    // Calculate maximum drawdown
    let maxDrawdown = 0;
    
    // Sort orders by date to calculate cumulative P&L over time
    userOrders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    let peak = 0;
    let currentValue = 0;
    
    userOrders.forEach(order => {
      if (order.status === 'filled') {
        // Calculate P&L for this order (simplified)
        const orderPnL = parseFloat(order.filledPrice || '0') - parseFloat(order.price || '0');
        currentValue += orderPnL;
        
        // Update peak if current value is higher
        if (currentValue > peak) {
          peak = currentValue;
        }
        
        // Calculate drawdown if we're below the peak
        if (peak > 0 && currentValue < peak) {
          const drawdown = (peak - currentValue) / peak;
          if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
          }
        }
      }
    });
    
    // Prepare response object
    const metrics = {
      totalPnL,
      winRate,
      roi,
      sharpeRatio,
      totalVolume,
      openPositions: openPositionsCount,
      maxDrawdown: maxDrawdown * 100, // Convert to percentage
      totalTrades
    };
    
    return NextResponse.json(metrics);
    
  } catch (error) {
    console.error('Error fetching trading metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
} 