import { positions } from '@/lib/db/schema';

export interface Position {
  id: number;
  userId: string;
  marketId: number;
  marketOptionId: number;
  quantity: string;
  averagePrice: string;
  realizedPnl: string;
  createdAt: Date;
  updatedAt: Date;
  market?: {
    name: string;
    status: string;
    type: string;
  };
  marketOption?: {
    name: string;
    currentPrice: string;
  };
}

export interface PositionCalculation {
  quantity: string;
  averagePrice: string;
  realizedPnl: string;
  unrealizedPnl: string;
  totalPnl: string;
  currentMarketValue: string;
  costBasis: string;
}

export interface PositionUpdate {
  positionId?: number;
  userId: string;
  marketId: number;
  marketOptionId: number;
  quantityChange: string;
  price: string;
  realizedPnl?: string;
}

export const calculatePositionValue = (position: Position, currentPrice?: string): PositionCalculation => {
  const quantity = parseFloat(position.quantity);
  const averagePrice = parseFloat(position.averagePrice);
  const realizedPnl = parseFloat(position.realizedPnl);
  const optionPrice = currentPrice ? parseFloat(currentPrice) : 
    position.marketOption?.currentPrice ? parseFloat(position.marketOption.currentPrice) : averagePrice;
  
  const costBasis = quantity * averagePrice;
  const currentMarketValue = quantity * optionPrice;
  const unrealizedPnl = currentMarketValue - costBasis;
  const totalPnl = unrealizedPnl + realizedPnl;
  
  return {
    quantity: quantity.toString(),
    averagePrice: averagePrice.toFixed(2),
    realizedPnl: realizedPnl.toFixed(2),
    unrealizedPnl: unrealizedPnl.toFixed(2),
    totalPnl: totalPnl.toFixed(2),
    currentMarketValue: currentMarketValue.toFixed(2),
    costBasis: costBasis.toFixed(2)
  };
};

export const calculatePositionDelta = (
  existingPosition: Position | null,
  tradeQuantity: string,
  tradePrice: string,
  tradeSide: 'buy' | 'sell'
): PositionUpdate => {
  const tradeQty = parseFloat(tradeQuantity);
  const price = parseFloat(tradePrice);
  
  // If no existing position, create a new one
  if (!existingPosition) {
    return {
      userId: '', // Will be filled by the caller
      marketId: 0, // Will be filled by the caller
      marketOptionId: 0, // Will be filled by the caller
      quantityChange: tradeSide === 'buy' ? tradeQuantity : `-${tradeQuantity}`,
      price: tradePrice,
      realizedPnl: '0.00'
    };
  }
  
  const existingQty = parseFloat(existingPosition.quantity);
  const existingAvgPrice = parseFloat(existingPosition.averagePrice);
  
  let newQuantity: number;
  let newAveragePrice: number;
  let realizedPnl = 0;
  
  if (tradeSide === 'buy') {
    // Increasing position
    newQuantity = existingQty + tradeQty;
    newAveragePrice = (existingQty * existingAvgPrice + tradeQty * price) / newQuantity;
  } else {
    // Reducing position
    if (tradeQty > existingQty) {
      throw new Error('Cannot sell more than the position quantity');
    }
    
    // Calculate realized PnL
    realizedPnl = tradeQty * (price - existingAvgPrice);
    
    // Update position
    newQuantity = existingQty - tradeQty;
    newAveragePrice = newQuantity > 0 ? existingAvgPrice : 0;
  }
  
  return {
    positionId: existingPosition.id,
    userId: existingPosition.userId,
    marketId: existingPosition.marketId,
    marketOptionId: existingPosition.marketOptionId,
    quantityChange: tradeSide === 'buy' ? tradeQuantity : `-${tradeQuantity}`,
    price: tradePrice,
    realizedPnl: realizedPnl.toFixed(2)
  };
}; 