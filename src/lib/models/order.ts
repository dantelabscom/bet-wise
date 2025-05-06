import { Decimal } from 'decimal.js';
import { 
  Order, 
  OrderBook, 
  OrderBookEntry, 
  OrderCreationParams, 
  OrderMatch, 
  OrderStatus, 
  OrderSide, 
  OrderType, 
  TradeResult 
} from '../services/orderbook/types';

export type {
  Order,
  OrderBook,
  OrderBookEntry,
  OrderCreationParams,
  OrderMatch,
  OrderStatus,
  OrderSide,
  OrderType,
  TradeResult
};

/**
 * Calculate the total value of an order
 * @param price Order price
 * @param quantity Order quantity
 * @returns The total order value
 */
export const calculateOrderValue = (price: string, quantity: string): string => {
  return new Decimal(price).mul(quantity).toString();
};

/**
 * Format an order price for display
 * @param price The price to format
 * @returns Formatted price string
 */
export const formatOrderPrice = (price: string | number): string => {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  return numPrice.toFixed(2);
};

/**
 * Get a display-friendly order status
 * @param status The order status
 * @returns Display-friendly status string
 */
export const getOrderStatusDisplay = (status: OrderStatus): string => {
  switch (status) {
    case 'open': return 'Open';
    case 'filled': return 'Filled';
    case 'partially_filled': return 'Partially Filled';
    case 'cancelled': return 'Cancelled';
    case 'rejected': return 'Rejected';
    case 'expired': return 'Expired';
    default: return status;
  }
}; 