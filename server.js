const { createServer } = require('http');
const { Server } = require('socket.io');
const { parse } = require('url');
const next = require('next');
const path = require('path');
const dotenv = require('dotenv');
const axios = require('axios');

// Set up ts-node with proper options for interoperability
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    esModuleInterop: true,
    moduleResolution: 'node'
  }
});

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server, {
    path: '/api/socketio',
    cors: {
      origin: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Make io available globally so it can be accessed by API routes
  global.io = io;

  // Initialize the WebSocket service FIRST before any other service
  let webSocketService;
  try {
    // Import the WebSocket service dynamically
    const wsModule = require('./src/lib/services/websocket/socket-service.js');
    webSocketService = wsModule.webSocketService;
    
    // Set the Socket.IO instance in the WebSocket service
    webSocketService.setIoInstance(io);
    console.log('WebSocket service initialized with Socket.IO instance');
  } catch (error) {
    console.error('Failed to initialize WebSocket service:', error);
  }

  // Set up Socket.IO connection events
  io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);
    
    // Join match room when client subscribes
    socket.on('join:match', (matchId) => {
      socket.join(`match:${matchId}`);
      console.log(`Client ${socket.id} joined match room: ${matchId}`);
    });
    
    // Join market room when client subscribes
    socket.on('join:market', (marketId) => {
      socket.join(`market:${marketId}`);
      console.log(`Client ${socket.id} joined market room: ${marketId}`);
      
      // Emit an initial orderbook update to the client
      try {
        // Import the bot service dynamically
        const { botService } = require('./src/lib/services/liquidity/index.js');
        
        // Get market data from the bot service
        const marketData = botService.getMarketData(marketId);
        
        if (marketData) {
          console.log(`Sending initial orderbook data for market ${marketId}:`, {
            bids: marketData.orderBook?.bids || [],
            asks: marketData.orderBook?.asks || []
          });
          
          // Send the current order book to the client
          socket.emit('orderbook:update', {
            marketId,
            bids: marketData.orderBook?.bids || [],
            asks: marketData.orderBook?.asks || [],
            lastPrice: marketData.currentPrice || 0.5,
            lastTradePrice: marketData.lastTradePrice || 0.5,
            lastTradeQuantity: marketData.lastTradeQuantity || 0,
            lastUpdated: Date.now()
          });
        } else {
          console.log(`No market data found for ${marketId}, sending empty orderbook`);
          // Send empty orderbook if market not found
          socket.emit('orderbook:update', {
            marketId,
            bids: [],
            asks: [],
            lastPrice: 0.5,
            lastTradePrice: 0.5,
            lastTradeQuantity: 0,
            lastUpdated: Date.now()
          });
        }
      } catch (error) {
        console.error('Error sending initial orderbook data:', error);
      }
    });
    
    // Handle placing orders
    socket.on('place:order', async (order) => {
      try {
        console.log(`Order received from client ${socket.id}:`, order);
        
        // If this is a demo user order, process it through the demo user service
        if (order.userId && order.userId.startsWith('demo-')) {
          // We'll import the demo user service dynamically since it's TypeScript
          // The actual processing will happen in the API route
          io.to(`market:${order.marketId}`).emit('order:placed', {
            success: true,
            order
          });
        } else {
          try {
            // Import the bot service dynamically
            const { botService } = require('./src/lib/services/liquidity/index.js');
            
            // Process the order through the bot service
            botService.processUserOrder(order);
            
            // Get updated market data
            const marketData = botService.getMarketData(order.marketId);
            
            // Broadcast the updated orderbook to all clients in the market room
            if (marketData) {
              io.to(`market:${order.marketId}`).emit('orderbook:update', {
                marketId: order.marketId,
                bids: marketData.orderBook?.bids || [],
                asks: marketData.orderBook?.asks || [],
                lastPrice: marketData.currentPrice || 0.5,
                lastTradePrice: marketData.lastTradePrice || 0.5,
                lastTradeQuantity: marketData.lastTradeQuantity || 0,
                lastUpdated: Date.now()
              });
            }
          } catch (error) {
            console.error('Error processing order:', error);
          }
        }
      } catch (error) {
        socket.emit('error', {
          message: error.message || 'Failed to place order',
          order
        });
      }
    });
    
    // Create demo user
    socket.on('demo:create', (userData) => {
      try {
        // The actual creation will happen in the API route
        socket.emit('demo:created', {
          success: true,
          message: 'Demo user created successfully'
        });
      } catch (error) {
        socket.emit('error', {
          message: error.message || 'Failed to create demo user'
        });
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  // Start server
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, async (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${PORT}`);
    console.log('> Socket.IO server initialized');
    
    // Initialize the trading services
    try {
      console.log('Initializing trading services...');
      
      // Import the bot service and sentiment service dynamically
      const { botService, sentimentService } = require('./src/lib/services/liquidity/index.js');
      
      // Make sure the bot service has access to the WebSocket service
      if (webSocketService) {
        // Explicitly pass the WebSocket service to the bot service if needed
        if (typeof botService.setWebSocketService === 'function') {
          botService.setWebSocketService(webSocketService);
          console.log('WebSocket service explicitly connected to bot service');
        }
      } else {
        console.error('WebSocket service not available for bot service');
      }
      
      // Start the bot service
      botService.start();
      console.log('Bot service started');
      
      // Create a test market
      const testMarketId = sentimentService.createPredefinedMarket('cricket', {
        homeTeam: 'Test Team A',
        awayTeam: 'Test Team B',
        homeAdvantage: true
      });
      console.log(`Test market created with ID: ${testMarketId}`);
      
      // Create additional markets for cricket testing
      const marketIds = [];
      for (let i = 1; i <= 3; i++) {
        const marketId = `cricket-market-${i}`;
        botService.initializeMarket(
          marketId,
          `Cricket Market ${i}`,
          `Demo cricket market ${i}`,
          0.5
        );
        botService.startLiquidityGeneration(marketId);
        marketIds.push(marketId);
      }
      console.log(`Created additional cricket markets: ${marketIds.join(', ')}`);
      
      // Start liquidity generation for the test market
      botService.startLiquidityGeneration(testMarketId);
      
      console.log('Trading services initialized successfully');
      
      // Check if we have active websocket connections
      setTimeout(() => {
        const roomSizes = io.sockets.adapter.rooms;
        console.log('Current Socket.IO rooms:', roomSizes);
        
        // Get all connected clients
        const clients = io.sockets.sockets;
        console.log(`Connected clients: ${clients.size}`);
      }, 5000);
      
    } catch (error) {
      console.error('Failed to initialize trading services:', error);
    }
  });
}); 