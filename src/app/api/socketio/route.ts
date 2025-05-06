import { NextRequest, NextResponse } from 'next/server';
import { Server as SocketIOServer } from 'socket.io';
import { webSocketService } from '@/lib/services/websocket/socket-service';

// Store the Socket.io server instance globally
let io: SocketIOServer;

export async function GET(req: NextRequest) {
  if (!io) {
    // Initialize Socket.IO without a server in Next.js App Router
    io = new SocketIOServer({
      cors: {
        origin: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      path: '/api/socketio'
    });
    
    // Connect the io instance to the WebSocketService
    webSocketService.setIoInstance(io);
    
    // Set up connection event
    io.on('connection', (socket) => {
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
          console.log(`Order received from client ${socket.id}:`, order);
          // Broadcast updated order book
          webSocketService.sendOrderBookUpdate(order.marketId, {
            marketId: order.marketId,
            // Updated order book data
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
    
    console.log('Socket.IO server initialized in API route');
  }

  // Get the search params from the URL
  const searchParams = req.nextUrl.searchParams;
  
  // Get the headers of the request
  const headers = Object.fromEntries(req.headers);
  
  try {
    // Let Socket.IO handle the request
    await new Promise((resolve, reject) => {
      let shouldResolve = false;
      let socketResponse: Response | null = null;
      
      ((io as any).engine as any).on("headers", (socketHeaders: any, req: any) => {
        shouldResolve = true;
        socketResponse = new Response(null, {
          status: 200,
          headers: new Headers(socketHeaders)
        });
      });
      
      // Create a fake req object for Socket.io
      const fakeReq = {
        method: req.method,
        url: `/api/socketio?${searchParams.toString()}`,
        headers: headers,
        body: null,
      };
      
      // Use the Socket.io engine's handleRequest method with the fake req
      (io.engine as any).handleRequest(fakeReq, null, null, () => {
        if (!shouldResolve) {
          resolve(new Response(null, { status: 200 }));
        } else {
          resolve(socketResponse);
        }
      });
      
      setTimeout(() => {
        reject(new Error('Socket.IO request handling timed out'));
      }, 5000);
    });
    
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error('Socket.IO request handling error:', error);
    return new NextResponse('Socket.IO request handling error', { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const POST = GET; 