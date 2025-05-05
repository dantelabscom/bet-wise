import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';
import { eq, and, sql } from 'drizzle-orm';
import { positions, marketOptions, markets } from '@/lib/db/schema';

// Position type
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
  marketOption?: {
    name: string;
    currentPrice: string;
  };
  market?: {
    name: string;
    type: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get open positions with market and option details
    const openPositions = await db.select({
      id: positions.id,
      userId: positions.userId,
      marketId: positions.marketId,
      marketOptionId: positions.marketOptionId,
      quantity: positions.quantity,
      averagePrice: positions.averagePrice,
      realizedPnl: positions.realizedPnl,
      createdAt: positions.createdAt,
      updatedAt: positions.updatedAt,
      // The schema might not have a status field - we're adding it for the cast
      status: sql`'open'::text`, // Add status as a raw SQL expression
      marketOption: {
        name: marketOptions.name,
        currentPrice: marketOptions.currentPrice
      },
      market: {
        name: markets.name,
        type: markets.type
      }
    })
    .from(positions)
    .where(
      // Instead of using the status field directly, we'll rely on other business logic
      // to determine open positions, e.g., a position with remaining quantity
      eq(positions.userId, session.user.email)
      // Remove the status condition since it's not available in the schema
    )
    .leftJoin(marketOptions, eq(positions.marketOptionId, marketOptions.id))
    .leftJoin(markets, eq(positions.marketId, markets.id)) as unknown as Position[];
    
    // Filter positions that are considered "open" based on business logic
    // This would depend on your application's specific rules
    const filteredOpenPositions = openPositions.filter(position => 
      parseFloat(position.quantity) > 0
    );
    
    // Calculate current exposure
    let totalExposure = 0;
    const riskByCategory = new Map<string, number>();
    const riskByMarket = new Map<string, number>();
    
    // Process each position
    filteredOpenPositions.forEach(position => {
      // Calculate position value
      const quantity = parseFloat(position.quantity);
      const currentPrice = position.marketOption?.currentPrice 
        ? parseFloat(position.marketOption.currentPrice) 
        : parseFloat(position.averagePrice);
      
      const positionValue = quantity * currentPrice;
      totalExposure += positionValue;
      
      // Categorize by market type
      const marketType = position.market?.type || 'unknown';
      const currentCategoryValue = riskByCategory.get(marketType) || 0;
      riskByCategory.set(marketType, currentCategoryValue + positionValue);
      
      // Categorize by market
      const marketName = position.market?.name || 'unknown';
      const currentMarketValue = riskByMarket.get(marketName) || 0;
      riskByMarket.set(marketName, currentMarketValue + positionValue);
    });
    
    // Prepare allocation data
    const categoryAllocation = Array.from(riskByCategory.entries()).map(([category, exposure]) => ({
      category,
      exposure,
      percentage: (exposure / totalExposure) * 100
    }));
    
    const marketAllocation = Array.from(riskByMarket.entries()).map(([market, exposure]) => ({
      market,
      exposure,
      percentage: (exposure / totalExposure) * 100
    }));
    
    // Sort allocations by exposure
    categoryAllocation.sort((a, b) => b.exposure - a.exposure);
    marketAllocation.sort((a, b) => b.exposure - a.exposure);
    
    // Calculate risk metrics
    // Value at Risk (VaR) - simplified
    // In a real system, this would use historical volatility and sophisticated models
    const valueAtRisk = totalExposure * 0.05; // 5% VaR (simplified)
    
    // Concentration risk
    // High percentage in one category indicates higher concentration risk
    const maxConcentration = categoryAllocation.length > 0 
      ? categoryAllocation[0].percentage
      : 0;
    
    const concentrationRisk = maxConcentration > 50 ? 'high' : 
                               maxConcentration > 30 ? 'medium' : 'low';
    
    // Prepare response object
    const riskData = {
      currentExposure: totalExposure,
      valueAtRisk, 
      concentrationRisk,
      allocation: categoryAllocation,
      marketAllocation
    };
    
    return NextResponse.json(riskData);
    
  } catch (error) {
    console.error('Error fetching risk data:', error);
    return NextResponse.json({ error: 'Failed to fetch risk data' }, { status: 500 });
  }
} 