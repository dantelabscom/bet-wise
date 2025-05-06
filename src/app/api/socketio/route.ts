import { NextRequest, NextResponse } from 'next/server';
import { Server as SocketIOServer } from 'socket.io';
import { webSocketService } from '@/lib/services/websocket/socket-service';

// Global variables to track Socket.IO server state
let io: SocketIOServer | null = null;

export async function GET(req: NextRequest) {
  try {
    // Return a simple response for health check
    if (req.nextUrl.searchParams.has('health')) {
      return NextResponse.json({ status: 'ok', socketInitialized: !!io });
    }

    // For actual Socket.IO connections, we need to return a 501 Not Implemented
    // Socket.IO cannot be properly initialized in Next.js API routes in serverless environments
    return new NextResponse(
      JSON.stringify({
        error: 'Socket.IO is not supported in serverless environments',
        message: 'Please use a custom server implementation for Socket.IO'
      }),
      { 
        status: 501,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
          'Access-Control-Allow-Methods': 'GET,POST',
          'Access-Control-Allow-Credentials': 'true'
        }
      }
    );
  } catch (error) {
    console.error('Socket.IO request handling error:', error);
    return new NextResponse('Socket.IO request handling error', { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const POST = GET; 