const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // Initialize Socket.IO with the HTTP server
  const io = new Server(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    },
    path: '/api/socketio',
  });

  // Set up connection event
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
    });
    
    // Handle placing orders
    socket.on('place:order', async (order) => {
      try {
        console.log(`Order received from client ${socket.id}:`, order);
        // Broadcast updated order book
        io.to(`market:${order.marketId}`).emit('orderbook:update', {
          marketId: order.marketId,
          // Updated order book data
        });
      } catch (error) {
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

  // Make Socket.IO instance available globally
  global.io = io;

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${PORT}`);
  });
}); 