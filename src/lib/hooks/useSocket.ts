import { useEffect, useState, useCallback } from 'react';
import io from 'socket.io-client';

let socketInstance: ReturnType<typeof io> | null = null;
let socketInitialized = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 2000;

/**
 * Custom hook for using Socket.IO across the app
 * Provides a singleton socket instance to prevent multiple connections
 */
export function useSocket() {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const initializeSocket = useCallback(() => {
    if (!socketInstance && !socketInitialized) {
      socketInitialized = true;
      console.log('Initializing socket connection...');

      // Connect directly to the server without going through the API route
      socketInstance = io(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000', {
        path: '/api/socketio',
        reconnection: true,
        reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
        reconnectionDelay: RECONNECT_DELAY,
        timeout: 10000,
        transports: ['polling', 'websocket'],
        autoConnect: true,
        forceNew: false,
      });
    }
    return socketInstance;
  }, []);

  const handleReconnect = useCallback(() => {
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      console.log(`Attempting to reconnect socket... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
      
      setTimeout(() => {
        if (socketInstance) {
          socketInstance.connect();
        }
      }, RECONNECT_DELAY);
    } else {
      setError('Maximum reconnection attempts reached. Please refresh the page.');
      socketInitialized = false;
      if (socketInstance) {
        socketInstance.disconnect();
      }
      socketInstance = null;
      reconnectAttempts = 0;
    }
  }, []);

  useEffect(() => {
    const socket = initializeSocket();
    
    if (!socket) {
      setError('Failed to initialize socket');
      return;
    }

    const onConnect = () => {
      console.log('Socket connected successfully');
      setIsConnected(true);
      setError(null);
      reconnectAttempts = 0;
    };

    const onDisconnect = (reason: string) => {
      console.log(`Socket disconnected: ${reason}`);
      setIsConnected(false);
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, attempt to reconnect
        handleReconnect();
      }
    };

    const onConnectError = (err: Error) => {
      console.error('Socket connection error:', err);
      setError(err.message);
      setIsConnected(false);
      handleReconnect();
    };

    const onError = (err: Error) => {
      console.error('Socket error:', err);
      setError(err.message);
    };

    // Register event listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('error', onError);

    // If the socket is already connected, set state immediately
    if (socket.connected) {
      setIsConnected(true);
    } else {
      socket.connect();
    }

    // Clean up event listeners on unmount
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('error', onError);
    };
  }, [initializeSocket, handleReconnect]);

  return { socket: socketInstance, isConnected, error };
} 