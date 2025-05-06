import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

// Feature flag to control whether to use the Rust trading engine
const USE_RUST_ENGINE = process.env.USE_RUST_ENGINE === 'true';
const TRADING_ENGINE_WS_URL = process.env.NEXT_PUBLIC_TRADING_ENGINE_WS_URL || 'ws://localhost:8080/ws';

/**
 * WebSocket service to handle real-time communications
 * This includes order book updates, live scores, and ball-by-ball commentary
 */
export class WebSocketService {
  private static instance: WebSocketService;
  public io: SocketIOServer | null = null;
  private tradingEngineWs: WebSocket | null = null;
  
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
    } else {
      // Otherwise create a new Socket.IO server from HTTP server
      this.io = new SocketIOServer(serverOrIo, {
        cors: {
          origin: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
          methods: ["GET", "POST"],
          credentials: true
        },
        path: '/api/socketio'
      });
      console.log('WebSocket server initialized');
    }
    
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
        
        // If using Rust engine, join the market room in the trading engine
        if (USE_RUST_ENGINE && this.tradingEngineWs && this.tradingEngineWs.readyState === WebSocket.OPEN) {
          this.tradingEngineWs.send(JSON.stringify({
            type: 'join',
            data: `market:${marketId}`
          }));
        }
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
    
    // Connect to Rust trading engine WebSocket if enabled
    if (USE_RUST_ENGINE && typeof window === 'undefined') {
      this.connectToTradingEngine();
    }
  }
  
  // Connect to the Rust trading engine WebSocket
  private connectToTradingEngine(): void {
    try {
      // Only run on server side
      if (typeof WebSocket === 'undefined') {
        const WebSocket = require('ws');
        this.tradingEngineWs = new WebSocket(TRADING_ENGINE_WS_URL);
      } else {
        this.tradingEngineWs = new WebSocket(TRADING_ENGINE_WS_URL);
      }
      
      if (!this.tradingEngineWs) {
        console.error('Failed to create WebSocket connection to trading engine');
        return;
      }
      
      this.tradingEngineWs.onopen = () => {
        console.log('Connected to Rust trading engine WebSocket');
      };
      
      this.tradingEngineWs.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data.toString());
          
          // Forward messages from the trading engine to clients
          switch (message.type) {
            case 'orderbook':
              if (message.data && message.data.market_id && this.io) {
                this.io.to(`market:${message.data.market_id}`).emit('orderbook:update', message.data);
              }
              break;
            case 'price':
              if (message.data && message.data.market_id && this.io) {
                this.io.to(`market:${message.data.market_id}`).emit('price:update', message.data);
              }
              break;
            case 'match':
              if (message.data && message.data.market_id && this.io) {
                this.io.to(`market:${message.data.market_id}`).emit('match:update', message.data);
              }
              break;
          }
        } catch (error) {
          console.error('Error processing message from trading engine:', error);
        }
      };
      
      this.tradingEngineWs.onerror = (error) => {
        console.error('Trading engine WebSocket error:', error);
      };
      
      this.tradingEngineWs.onclose = () => {
        console.log('Disconnected from trading engine WebSocket, attempting to reconnect...');
        // Attempt to reconnect after a delay
        setTimeout(() => this.connectToTradingEngine(), 5000);
      };
    } catch (error) {
      console.error('Failed to connect to trading engine WebSocket:', error);
    }
  }
  
  // Set an existing Socket.IO instance
  public setIoInstance(io: SocketIOServer): void {
    this.io = io;
    console.log('WebSocket service updated with external Socket.IO instance');
    
    // Connect to Rust trading engine WebSocket if enabled
    if (USE_RUST_ENGINE && typeof window === 'undefined' && !this.tradingEngineWs) {
      this.connectToTradingEngine();
    }
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