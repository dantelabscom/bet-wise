import { Position, PositionManager } from '../orderbook/position-manager';
import { db } from '@/lib/db';
import { positions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Initialize position manager
const positionManager = new PositionManager();

/**
 * Get all positions for a user
 * @param userId User ID
 * @returns Array of positions
 */
export async function getUserPositions(userId: string): Promise<Position[]> {
  try {
    const userPositions = await db.query.positions.findMany({
      where: eq(positions.userId, userId)
    });
    
    return userPositions.map(pos => ({
      id: pos.id,
      userId: pos.userId,
      marketId: pos.marketId,
      marketOptionId: pos.marketOptionId,
      quantity: pos.quantity.toString(),
      averageEntryPrice: pos.averageEntryPrice.toString(),
      realizedPnl: pos.realizedPnl.toString(),
      createdAt: pos.createdAt,
      updatedAt: pos.updatedAt
    }));
  } catch (error) {
    console.error('Error fetching user positions:', error);
    return [];
  }
}

/**
 * Get a specific position by ID
 * @param positionId Position ID
 * @returns Position or null if not found
 */
export async function getPositionById(positionId: string): Promise<Position | null> {
  try {
    const position = await db.query.positions.findFirst({
      where: eq(positions.id, positionId)
    });
    
    if (!position) return null;
    
    return {
      id: position.id,
      userId: position.userId,
      marketId: position.marketId,
      marketOptionId: position.marketOptionId,
      quantity: position.quantity.toString(),
      averageEntryPrice: position.averageEntryPrice.toString(),
      realizedPnl: position.realizedPnl.toString(),
      createdAt: position.createdAt,
      updatedAt: position.updatedAt
    };
  } catch (error) {
    console.error('Error fetching position by ID:', error);
    return null;
  }
} 