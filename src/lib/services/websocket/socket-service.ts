import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
// Remove direct import of botService to avoid circular dependency
// import { botService } from '../liquidity/bot-service';

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
    // Only run on server side
    if (typeof window !== 'undefined') {
      console.log('WebSocketService: Skipping initialization in browser environment');
      return;
    }
    
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
        
        // Check if this market exists in bot service
        try {
          // Dynamically import botService to avoid circular dependency
          import('../liquidity/bot-service').then(module => {
            const botService = module.botService;
            if (botService) {
              const marketData = botService.getMarketData(marketId);
              console.log(`Market ${marketId} found in bot service`);
              
              // Send initial order book data
              if (marketData) {
                socket.emit('orderbook:update', {
                  marketId,
                  bids: marketData.orderBook?.bids || [],
                  asks: marketData.orderBook?.asks || [],
                  lastPrice: marketData.currentPrice || 0.5,
                  lastUpdated: Date.now()
                });
              }
            }
          }).catch(err => {
            console.error('Error importing bot service:', err);
          });
        } catch (error) {
          console.log(`Market ${marketId} not found in bot service`);
        }
        
        // Handle get:orderbook requests
        socket.on('get:orderbook', (data: { marketId: string }) => {
          if (data.marketId !== marketId) return;
          
          console.log(`Client ${socket.id} requested orderbook for market: ${data.marketId}`);
          
          try {
            // Dynamically import botService to avoid circular dependency
            import('../liquidity/bot-service').then(module => {
              const botService = module.botService;
              if (botService) {
                // Get order book data from bot service
                const marketData = botService.getMarketData(data.marketId);
                if (marketData) {
                  socket.emit('orderbook:update', {
                    marketId: data.marketId,
                    bids: marketData.orderBook?.bids || [],
                    asks: marketData.orderBook?.asks || [],
                    lastPrice: marketData.currentPrice || 0.5,
                    lastUpdated: Date.now()
                  });
                } else {
                  // Send empty order book if market not found
                  socket.emit('orderbook:update', {
                    marketId: data.marketId,
                    bids: [],
                    asks: [],
                    lastPrice: 0.5,
                    lastUpdated: Date.now()
                  });
                }
              }
            }).catch(err => {
              console.error('Error importing bot service:', err);
              // Send empty order book on error
              socket.emit('orderbook:update', {
                marketId: data.marketId,
                bids: [],
                asks: [],
                lastPrice: 0.5,
                lastUpdated: Date.now()
              });
            });
          } catch (error) {
            console.error(`Error getting order book for market ${data.marketId}:`, error);
            // Send empty order book on error
            socket.emit('orderbook:update', {
              marketId: data.marketId,
              bids: [],
              asks: [],
              lastPrice: 0.5,
              lastUpdated: Date.now()
            });
          }
        });
        
        // Handle get:price_history requests
        socket.on('get:price_history', (data: { marketId: string }) => {
          if (data.marketId !== marketId) return;
          
          console.log(`Client ${socket.id} requested price history for market: ${data.marketId}`);
          
          try {
            // Dynamically import botService to avoid circular dependency
            import('../liquidity/bot-service').then(module => {
              const botService = module.botService;
              if (botService) {
                // Get market data from bot service
                const marketData = botService.getMarketData(data.marketId);
                if (marketData && marketData.priceHistory) {
                  socket.emit('price:history', {
                    marketId: data.marketId,
                    history: marketData.priceHistory || []
                  });
                } else {
                  // Send empty price history if not found
                  socket.emit('price:history', {
                    marketId: data.marketId,
                    history: []
                  });
                }
              }
            }).catch(err => {
              console.error('Error importing bot service:', err);
              // Send empty price history on error
              socket.emit('price:history', {
                marketId: data.marketId,
                history: []
              });
            });
          } catch (error) {
            console.error(`Error getting price history for market ${data.marketId}:`, error);
            // Send empty price history on error
            socket.emit('price:history', {
              marketId: data.marketId,
              history: []
            });
          }
        });
      });
      
      // Handle placing orders
      socket.on('place:order', async (order: any) => {
        try {
          console.log(`Client ${socket.id} placed order for market: ${order.marketId}`, order);
          
          // Process order through bot service
          try {
            // Dynamically import botService to avoid circular dependency
            import('../liquidity/bot-service').then(module => {
              const botService = module.botService;
              if (botService) {
                // Add isBot: false to indicate this is a user order
                const userOrder = { ...order, isBot: false };
                botService.processUserOrder(userOrder);
                // Order book update will be sent by the bot service
              }
            }).catch(err => {
              console.error('Error importing bot service:', err);
              socket.emit('error', {
                message: 'Failed to process order',
                order
              });
            });
          } catch (error) {
            console.error(`Error processing order:`, error);
            
            // Send error to client
            socket.emit('error', {
              message: 'Failed to process order',
              order
            });
          }
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