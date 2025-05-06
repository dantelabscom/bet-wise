import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

/**
 * WebSocket service to handle real-time communications
 * This includes order book updates, live scores, and ball-by-ball commentary
 */
export class WebSocketService {
  private static instance: WebSocketService;
  public io: SocketIOServer | null = null;
  
  // Private constructor for singleton pattern
  private constructor() {}
  
  // Get singleton instance
  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }
  
  // Initialize Socket.IO server
  public initialize(serverOrIo: HTTPServer | SocketIOServer): void {
    if (this.io) {
      console.log('WebSocket server already initialized');
      return;
    }
    
    // Check if we're getting a Socket.io instance directly
    if (serverOrIo instanceof SocketIOServer) {
      this.io = serverOrIo;
      console.log('WebSocket service initialized with existing Socket.IO instance');
      return;
    }
    
    // Otherwise create a new Socket.IO server from HTTP server
    this.io = new SocketIOServer(serverOrIo, {
      cors: {
        origin: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      path: '/api/socketio'
    });
    
    // Set up connection event
    this.io.on('connection', (socket) => {
      console.log(`New client connected: ${socket.id}`);
      
      // Join match room when client subscribes
      socket.on('join:match', (matchId: string) => {
        socket.join(`match:${matchId}`);
        console.log(`Client ${socket.id} joined match room: ${matchId}`);
      });
      
      // Join market room when client subscribes
      socket.on('join:market', (marketId: string) => {
        socket.join(`market:${marketId}`);
        console.log(`Client ${socket.id} joined market room: ${marketId}`);
      });
      
      // Handle placing orders
      socket.on('place:order', async (order: any) => {
        try {
          // TODO: Process order through order service
          // This will be implemented in the order service
          
          // Broadcast updated order book
          this.io?.to(`market:${order.marketId}`).emit('orderbook:update', {
            marketId: order.marketId,
            // Updated order book data will be fetched from the order service
          });
        } catch (error: any) {
          socket.emit('error', {
            message: error.message || 'Failed to place order',
            order
          });
        }
      });
      
      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
      });
    });
    
    console.log('WebSocket server initialized');
  }
  
  // Set an existing Socket.IO instance
  public setIoInstance(io: SocketIOServer): void {
    this.io = io;
    console.log('WebSocket service updated with external Socket.IO instance');
  }
  
  // Send match update to all clients in a match room
  public sendMatchUpdate(matchId: string, data: any): void {
    if (!this.io) {
      console.error('WebSocket server not initialized');
      return;
    }
    
    this.io.to(`match:${matchId}`).emit('match:update', data);
  }
  
  // Send ball by ball update
  public sendBallUpdate(matchId: string, data: any): void {
    if (!this.io) {
      console.error('WebSocket server not initialized');
      return;
    }
    
    this.io.to(`match:${matchId}`).emit('ball:update', data);
  }
  
  // Send order book update
  public sendOrderBookUpdate(marketId: string, orderBook: any): void {
    if (!this.io) {
      console.error('WebSocket server not initialized');
      return;
    }
    
    this.io.to(`market:${marketId}`).emit('orderbook:update', orderBook);
  }
  
  // Send market price update
  public sendPriceUpdate(marketId: string, priceData: any): void {
    if (!this.io) {
      console.error('WebSocket server not initialized');
      return;
    }
    
    this.io.to(`market:${marketId}`).emit('price:update', priceData);
  }
}

// Export singleton instance
export const webSocketService = WebSocketService.getInstance(); 