import { Decimal } from 'decimal.js';
import { Position, OrderSide } from '../services/orderbook/types';

export type { Position };

export interface PositionCalculation {
  [x: string]: string;
  quantity: string;
  averageEntryPrice: string;
  realizedPnl: string;
  unrealizedPnl: string;
  totalPnl: string;
  currentMarketValue: string;
  costBasis: string;
}

/**
 * Calculate position value and P&L
 * @param position The position to calculate
 * @param currentPrice Current market price (optional)
 * @returns Position calculation results
 */
export const calculatePositionValue = (position: Position, currentPrice?: string): PositionCalculation => {
  const quantity = new Decimal(position.quantity);
  const averagePrice = new Decimal(position.averageEntryPrice);
  const realizedPnl = new Decimal(position.realizedPnl);
  const optionPrice = currentPrice ? new Decimal(currentPrice) : 
    position.marketOption?.currentPrice ? new Decimal(position.marketOption.currentPrice) : averagePrice;
  
  const costBasis = quantity.mul(averagePrice);
  const currentMarketValue = quantity.mul(optionPrice);
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
}; 