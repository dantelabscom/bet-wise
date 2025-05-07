import { useState, useEffect, useCallback } from 'react';
import { useSocket } from './useSocket';
import axios from 'axios';

interface DemoUser {
  id: string;
  name: string;
  balance: number;
  portfolio: {
    [marketId: string]: {
      yesShares: number;
      noShares: number;
      avgYesPrice: number;
      avgNoPrice: number;
    };
  };
  orders: any[];
  trades: any[];
}

interface OrderParams {
  marketId: string;
  type: 'BUY' | 'SELL';
  side: 'YES' | 'NO';
  price: number;
  quantity: number;
}

export function useDemoTrading() {
  const [demoUser, setDemoUser] = useState<DemoUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { socket, isConnected } = useSocket();

  // Initialize demo mode
  const initializeDemoMode = useCallback(async (name?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Create a demo user
      const response = await axios.post('/api/demo/user', { name });
      
      if (response.data.success) {
        // Get the full user data
        const userResponse = await axios.get(`/api/demo/user?userId=${response.data.user.id}`);
        
        if (userResponse.data.success) {
          setDemoUser(userResponse.data.data);
          
          // Store demo user ID in session storage
          sessionStorage.setItem('demoUserId', response.data.user.id);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize demo mode');
      console.error('Error initializing demo mode:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Place an order
  const placeOrder = useCallback(async (params: OrderParams) => {
    if (!demoUser) {
      setError('Demo user not initialized');
      return null;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await axios.post('/api/demo/order', {
        userId: demoUser.id,
        ...params
      });
      
      if (response.data.success) {
        // Refresh user data
        const userResponse = await axios.get(`/api/demo/user?userId=${demoUser.id}`);
        
        if (userResponse.data.success) {
          setDemoUser(userResponse.data.data);
        }
        
        return response.data.order;
      }
      
      return null;
    } catch (err: any) {
      setError(err.message || 'Failed to place order');
      console.error('Error placing order:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [demoUser]);

  // Cancel an order
  const cancelOrder = useCallback(async (orderId: string) => {
    if (!demoUser) {
      setError('Demo user not initialized');
      return false;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await axios.delete(`/api/demo/order?userId=${demoUser.id}&orderId=${orderId}`);
      
      if (response.data.success) {
        // Refresh user data
        const userResponse = await axios.get(`/api/demo/user?userId=${demoUser.id}`);
        
        if (userResponse.data.success) {
          setDemoUser(userResponse.data.data);
        }
        
        return true;
      }
      
      return false;
    } catch (err: any) {
      setError(err.message || 'Failed to cancel order');
      console.error('Error canceling order:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [demoUser]);

  // Reset demo user
  const resetDemoUser = useCallback(async () => {
    if (!demoUser) {
      setError('Demo user not initialized');
      return false;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await axios.delete(`/api/demo/user?userId=${demoUser.id}&action=reset`);
      
      if (response.data.success) {
        // Refresh user data
        const userResponse = await axios.get(`/api/demo/user?userId=${demoUser.id}`);
        
        if (userResponse.data.success) {
          setDemoUser(userResponse.data.data);
        }
        
        return true;
      }
      
      return false;
    } catch (err: any) {
      setError(err.message || 'Failed to reset demo user');
      console.error('Error resetting demo user:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [demoUser]);

  // End demo mode
  const endDemoMode = useCallback(async () => {
    if (!demoUser) {
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      await axios.delete(`/api/demo/user?userId=${demoUser.id}`);
      
      // Clear demo user from state and session storage
      setDemoUser(null);
      sessionStorage.removeItem('demoUserId');
    } catch (err: any) {
      setError(err.message || 'Failed to end demo mode');
      console.error('Error ending demo mode:', err);
    } finally {
      setIsLoading(false);
    }
  }, [demoUser]);

  // Refresh user data
  const refreshUserData = useCallback(async () => {
    if (!demoUser) {
      return;
    }
    
    try {
      const response = await axios.get(`/api/demo/user?userId=${demoUser.id}`);
      
      if (response.data.success) {
        setDemoUser(response.data.data);
      }
    } catch (err: any) {
      console.error('Error refreshing user data:', err);
    }
  }, [demoUser]);

  // Listen for socket events
  useEffect(() => {
    if (!socket || !isConnected || !demoUser) {
      return;
    }
    
    const handleOrderBookUpdate = () => {
      refreshUserData();
    };
    
    socket.on('orderbook:update', handleOrderBookUpdate);
    
    return () => {
      socket.off('orderbook:update', handleOrderBookUpdate);
    };
  }, [socket, isConnected, demoUser, refreshUserData]);

  // Check for existing demo user in session storage on mount
  useEffect(() => {
    const storedUserId = sessionStorage.getItem('demoUserId');
    
    if (storedUserId) {
      (async () => {
        try {
          setIsLoading(true);
          
          const response = await axios.get(`/api/demo/user?userId=${storedUserId}`);
          
          if (response.data.success) {
            setDemoUser(response.data.data);
          } else {
            // If user not found, clear session storage
            sessionStorage.removeItem('demoUserId');
          }
        } catch (err) {
          console.error('Error retrieving stored demo user:', err);
          sessionStorage.removeItem('demoUserId');
        } finally {
          setIsLoading(false);
        }
      })();
    }
  }, []);

  return {
    demoUser,
    isLoading,
    error,
    initializeDemoMode,
    placeOrder,
    cancelOrder,
    resetDemoUser,
    endDemoMode,
    refreshUserData,
    isDemoMode: !!demoUser
  };
} 