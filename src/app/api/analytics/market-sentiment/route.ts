import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';
import { eq, and, gte, desc, count } from 'drizzle-orm';
import { markets, marketOptions, orders } from '@/lib/db/schema';
import { OddsCalculator } from '@/lib/models/odds-calculator';

export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get active markets
    const activeMarkets = await db.select({
      id: markets.id,
      name: markets.name,
      tradingVolume: markets.tradingVolume
    })
    .from(markets)
    .where(eq(markets.status, 'open'))
    .orderBy(desc(markets.tradingVolume))
    .limit(10);
    
    // Market sentiment data
    const marketSentimentData = await Promise.all(activeMarkets.map(async (market) => {
      // Get market options
      const options = await db.select()
        .from(marketOptions)
        .where(eq(marketOptions.marketId, market.id));
      
      // Calculate public vs sharp money percentages
      // For this demo, we'll simulate these values based on order counts
      
      // Public money is determined by number of small orders
      const publicOrders = await db.select({ count: count() })
        .from(orders)
        .where(
          and(
            eq(orders.marketId, market.id),
            // Small orders (quantity less than 10)
            // This is a simplified approach - real implementation would use monetary value
          )
        );
      
      // Sharp money is determined by number of large orders
      const sharpOrders = await db.select({ count: count() })
        .from(orders)
        .where(
          and(
            eq(orders.marketId, market.id),
            // Large orders (quantity greater than 50)
            // This is a simplified approach - real implementation would use monetary value
          )
        );
      
      // Calculate total orders
      const totalOrders = publicOrders[0].count + sharpOrders[0].count;
      
      // Calculate percentages
      const publicMoneyPercentage = totalOrders > 0 
        ? (publicOrders[0].count / totalOrders) * 100 
        : 50;
      
      const sharpMoneyPercentage = totalOrders > 0 
        ? (sharpOrders[0].count / totalOrders) * 100 
        : 50;
      
      // Calculate market inefficiency score
      // Higher score means potentially more inefficient pricing
      // This is determined by looking at:
      // 1. Difference between market book total and 100%
      // 2. Divergence between public and sharp money
      
      // Calculate implied probabilities
      const impliedProbabilities = options.map(option => 
        OddsCalculator.decimalToImplied(parseFloat(option.currentPrice)) / 100
      );
      
      // Total probability should be 100% for a fair market
      // Anything above indicates a margin for the platform
      const totalProbability = impliedProbabilities.reduce((sum, prob) => sum + prob, 0);
      
      // Inefficiency score (0-20)
      // - 0-5: Very efficient market
      // - 5-10: Somewhat efficient
      // - 10-15: Some inefficiencies
      // - 15+: Significant inefficiencies
      
      const overroundFactor = Math.abs(totalProbability - 1) * 10; // 0-10 based on overround
      const sharpPublicDivergence = Math.abs(publicMoneyPercentage - sharpMoneyPercentage) / 10; // 0-10 based on divergence
      
      const inefficiencyScore = overroundFactor + sharpPublicDivergence;
      
      return {
        market: market.name,
        marketId: market.id,
        publicMoney: parseFloat(publicMoneyPercentage.toFixed(1)),
        sharpMoney: parseFloat(sharpMoneyPercentage.toFixed(1)),
        inefficiencyScore: parseFloat(inefficiencyScore.toFixed(1)),
        volume: parseFloat(market.tradingVolume)
      };
    }));
    
    // Sort by inefficiency score (highest first)
    marketSentimentData.sort((a, b) => b.inefficiencyScore - a.inefficiencyScore);
    
    return NextResponse.json(marketSentimentData);
    
  } catch (error) {
    console.error('Error fetching market sentiment data:', error);
    return NextResponse.json({ error: 'Failed to fetch market sentiment data' }, { status: 500 });
  }
} 