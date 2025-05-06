import { useEffect, useState } from 'react';
import io from 'socket.io-client';

let socketInstance: any = null;
let socketInitialized = false;

/**
 * Custom hook for using Socket.IO across the app
 * Provides a singleton socket instance to prevent multiple connections
 */
export function useSocket() {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  
  useEffect(() => {
    // Only create a socket if one doesn't already exist
    if (!socketInstance && !socketInitialized) {
      socketInitialized = true; // Prevent double initialization
      
      console.log('Initializing socket connection...');
      
      // Create the socket connection
      socketInstance = io(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000', {
        path: '/api/socketio',
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 10000,
        autoConnect: true,
        forceNew: false,
      });
    }
    
    if (!socketInstance) {
      console.error('Failed to initialize socket');
      return;
    }
    
    // Set up event listeners
    const onConnect = () => {
      console.log('Socket connected successfully');
      setIsConnected(true);
    };
    
    const onDisconnect = (reason: string) => {
      console.log(`Socket disconnected: ${reason}`);
      setIsConnected(false);
    };
    
    const onConnectError = (err: any) => {
      console.error('Socket connection error:', err);
      // If we have too many connection errors, reset the socket
      if (!isConnected) {
        setTimeout(() => {
          console.log('Attempting to reconnect socket...');
          socketInstance?.connect();
        }, 3000);
      }
    };
    
    const onError = (err: any) => {
      console.error('Socket error:', err);
    };
    
    // Register event listeners
    socketInstance.on('connect', onConnect);
    socketInstance.on('disconnect', onDisconnect);
    socketInstance.on('connect_error', onConnectError);
    socketInstance.on('error', onError);
    
    // If the socket is already connected, set state immediately
    if (socketInstance.connected) {
      setIsConnected(true);
    } else if (!socketInstance.connected && !socketInstance.connecting) {
      socketInstance.connect();
    }
    
    // Clean up event listeners on unmount
    return () => {
      socketInstance?.off('connect', onConnect);
      socketInstance?.off('disconnect', onDisconnect);
      socketInstance?.off('connect_error', onConnectError);
      socketInstance?.off('error', onError);
    };
  }, [isConnected]);
  
  return socketInstance;
} 