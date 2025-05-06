import { Decimal } from 'decimal.js';
import { OrderSide } from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Position interface for tracking user positions
 */
export interface Position {
  id: string;
  userId: string;
  marketId: number;
  marketOptionId: number;
  quantity: string;
  averageEntryPrice: string;
  realizedPnl: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Parameters for updating a position
 */
export interface PositionUpdateParams {
  userId: string;
  marketId: number;
  marketOptionId: number;
  quantityDelta: string;
  price: string;
}

/**
 * PositionManager class handles position tracking and P&L calculations
 */
export class PositionManager {
  /**
   * Update a position based on a trade
   * @param params Position update parameters
   * @param existingPosition Existing position (if any)
   * @returns The updated position
   */
  updatePosition(params: PositionUpdateParams, existingPosition: Position | null): Position {
    const quantityDelta = new Decimal(params.quantityDelta);
    const price = new Decimal(params.price);
    
    // If no existing position, create a new one
    if (!existingPosition) {
      return {
        id: uuidv4(),
        userId: params.userId,
        marketId: params.marketId,
        marketOptionId: params.marketOptionId,
        quantity: quantityDelta.toString(),
        averageEntryPrice: price.toString(),
        realizedPnl: '0',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    
    const existingQty = new Decimal(existingPosition.quantity);
    const existingAvgPrice = new Decimal(existingPosition.averageEntryPrice);
    const existingRealizedPnl = new Decimal(existingPosition.realizedPnl);
    
    // Calculate new position values
    let newQuantity: Decimal;
    let newAveragePrice: Decimal;
    let realizedPnl = new Decimal(0);
    
    if (quantityDelta.gt(0)) {
      // Increasing position
      newQuantity = existingQty.plus(quantityDelta);
      
      // Calculate weighted average price
      const existingValue = existingQty.mul(existingAvgPrice);
      const newValue = quantityDelta.mul(price);
      newAveragePrice = newQuantity.isZero() 
        ? new Decimal(0) 
        : existingValue.plus(newValue).div(newQuantity);
    } else {
      // Reducing position
      const reduceQty = quantityDelta.abs();
      
      // Check if trying to sell more than owned
      if (reduceQty.gt(existingQty)) {
        throw new Error('Cannot reduce position by more than current quantity');
      }
      
      // Calculate realized P&L for the portion being sold
      realizedPnl = reduceQty.mul(price.minus(existingAvgPrice));
      
      // Update position
      newQuantity = existingQty.minus(reduceQty);
      newAveragePrice = newQuantity.isZero() ? new Decimal(0) : existingAvgPrice;
    }
    
    // Create updated position
    return {
      ...existingPosition,
      quantity: newQuantity.toString(),
      averageEntryPrice: newAveragePrice.toString(),
      realizedPnl: existingRealizedPnl.plus(realizedPnl).toString(),
      updatedAt: new Date(),
    };
  }
  
  /**
   * Calculate position value and P&L
   * @param position The position to calculate
   * @param currentPrice Current market price
   * @returns Position calculation results
   */
  calculatePositionValue(position: Position, currentPrice: string): {
    quantity: string;
    averageEntryPrice: string;
    realizedPnl: string;
    unrealizedPnl: string;
    totalPnl: string;
    currentMarketValue: string;
    costBasis: string;
  } {
    const quantity = new Decimal(position.quantity);
    const averagePrice = new Decimal(position.averageEntryPrice);
    const realizedPnl = new Decimal(position.realizedPnl);
    const price = new Decimal(currentPrice);
    
    const costBasis = quantity.mul(averagePrice);
    const currentMarketValue = quantity.mul(price);
    const unrealizedPnl = currentMarketValue.minus(costBasis);
    const totalPnl = unrealizedPnl.plus(realizedPnl);
    
    return {
      quantity: quantity.toString(),
      averageEntryPrice: averagePrice.toFixed(2),
      realizedPnl: realizedPnl.toFixed(2),
      unrealizedPnl: unrealizedPnl.toFixed(2),
      totalPnl: totalPnl.toFixed(2),
      currentMarketValue: currentMarketValue.toFixed(2),
      costBasis: costBasis.toFixed(2)
    };
  }
  
  /**
   * Calculate position delta for a trade
   * @param existingPosition Existing position (if any)
   * @param tradeQuantity Trade quantity
   * @param tradePrice Trade price
   * @param tradeSide Trade side (buy/sell)
   * @returns Position update parameters
   */
  calculatePositionDelta(
    existingPosition: Position | null,
    tradeQuantity: string,
    tradePrice: string,
    tradeSide: OrderSide
  ): PositionUpdateParams {
    const tradeQty = new Decimal(tradeQuantity);
    const quantityDelta = tradeSide === 'buy' 
      ? tradeQty 
      : tradeQty.negated();
    
    return {
      userId: existingPosition?.userId || '',
      marketId: existingPosition?.marketId || 0,
      marketOptionId: existingPosition?.marketOptionId || 0,
      quantityDelta: quantityDelta.toString(),
      price: tradePrice,
    };
  }
} 