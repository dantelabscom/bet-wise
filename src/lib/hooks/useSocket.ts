import { useEffect, useState, useCallback } from 'react';

// Define a simple interface for the socket to avoid import issues
interface SocketClient {
  connected: boolean;
  connect: () => void;
  disconnect: () => void;
  on: (event: string, callback: any) => void;
  off: (event: string, callback: any) => void;
  emit: (event: string, ...args: any[]) => void;
}

// Use type for the socket instance
let socketInstance: SocketClient | null = null;
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
  const [socket, setSocket] = useState<SocketClient | null>(null);

  const initializeSocket = useCallback(async () => {
    if (!socketInstance && !socketInitialized) {
      socketInitialized = true;
      console.log('Initializing socket connection...');

      try {
        // Dynamically import socket.io-client only on the client side
        const io = (await import('socket.io-client')).default;

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
        
        console.log('Socket.io client initialized', socketInstance);
        setSocket(socketInstance);
      } catch (err) {
        console.error('Failed to initialize socket:', err);
        setError('Failed to initialize socket connection');
        socketInitialized = false;
      }
    } else if (socketInstance) {
      // Return existing instance
      console.log('Reusing existing socket connection');
      setSocket(socketInstance);
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
      setSocket(null);
      reconnectAttempts = 0;
    }
  }, []);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    console.log('useSocket hook initializing...');
    
    // Initialize socket
    initializeSocket().then((socket) => {
      if (!socket) {
        console.error('Failed to get socket instance');
        return;
      }

      const onConnect = () => {
        console.log('Socket connected successfully', socket);
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
        console.log('Socket is already connected');
        setIsConnected(true);
      } else {
        console.log('Initiating socket connection...');
        socket.connect();
      }

      // Clean up event listeners on unmount
      return () => {
        console.log('Cleaning up socket event listeners');
        socket.off('connect', onConnect);
        socket.off('disconnect', onDisconnect);
        socket.off('connect_error', onConnectError);
        socket.off('error', onError);
      };
    });
  }, [initializeSocket, handleReconnect]);

  return { socket, isConnected, error };
} 