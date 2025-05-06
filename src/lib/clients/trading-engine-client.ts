import axios from 'axios';

const TRADING_ENGINE_BASE_URL = process.env.NEXT_PUBLIC_TRADING_ENGINE_URL || 'http://localhost:8080/api/v1';

export const tradingEngineClient = {
  // Create a new order
  async createOrder(orderParams: any) {
    const response = await axios.post(`${TRADING_ENGINE_BASE_URL}/orders`, orderParams);
    return response.data;
  },
  
  // Get order book for a market option
  async getOrderBook(marketId: number, optionId: number) {
    const response = await axios.get(
      `${TRADING_ENGINE_BASE_URL}/markets/${marketId}/options/${optionId}/orderbook`
    );
    return response.data;
  },
  
  // Get user positions
  async getUserPositions(userId: string) {
    const response = await axios.get(`${TRADING_ENGINE_BASE_URL}/users/${userId}/positions`);
    return response.data;
  },

  // Health check
  async healthCheck() {
    try {
      const response = await axios.get(`${TRADING_ENGINE_BASE_URL.replace('/api/v1', '')}/health`);
      return response.data;
    } catch (error) {
      console.error('Trading engine health check failed:', error);
      throw error;
    }
  }
}; 