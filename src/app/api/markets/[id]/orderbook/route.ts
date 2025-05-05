import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOrderBook } from '@/lib/services/order-matching';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { id } = params;
    
    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: 'Invalid market ID' },
        { status: 400 }
      );
    }
    
    const marketId = Number(id);
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const marketOptionId = searchParams.get('optionId');
    
    if (!marketOptionId || isNaN(Number(marketOptionId))) {
      return NextResponse.json(
        { error: 'Invalid or missing market option ID' },
        { status: 400 }
      );
    }
    
    // Get order book
    const orderBook = await getOrderBook(marketId, Number(marketOptionId));
    
    return NextResponse.json(orderBook);
  } catch (error: any) {
    console.error('Error fetching order book:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order book' },
      { status: 500 }
    );
  }
} 