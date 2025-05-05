'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import DashboardHeader from '@/components/dashboard/Header';
import { Order, getOrderStatusDisplay } from '@/lib/models/order';

// Order statistics interface
interface OrderStats {
  total: number;
  open: number;
  filled: number;
  cancelled: number;
  totalValue: number;
  successRate: number;
}

export default function OrdersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'filled' | 'cancelled'>('all');
  const [orderStats, setOrderStats] = useState<OrderStats>({
    total: 0,
    open: 0,
    filled: 0,
    cancelled: 0,
    totalValue: 0,
    successRate: 0
  });
  const [timeRange, setTimeRange] = useState<'1d' | '1w' | '1m' | 'all'>('all');
  
  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);
  
  // Fetch user orders
  useEffect(() => {
    const fetchOrders = async () => {
      if (status !== 'authenticated') return;
      
      try {
        setLoading(true);
        // Apply filter and time range to API call
        let endpoint = '/api/orders';
        const params = new URLSearchParams();
        
        if (filter !== 'all') {
          params.append('status', filter);
        }
        
        if (timeRange !== 'all') {
          params.append('timeRange', timeRange);
        }
        
        if (params.toString()) {
          endpoint += `?${params.toString()}`;
        }
        
        const response = await fetch(endpoint);
        
        if (!response.ok) {
          throw new Error('Failed to fetch orders');
        }
        
        const data = await response.json();
        setOrders(data.orders || []);
        
        // Calculate order statistics
        calculateOrderStats(data.orders || []);
      } catch (error) {
        console.error('Error fetching orders:', error);
        toast.error('Failed to load orders');
      } finally {
        setLoading(false);
      }
    };
    
    fetchOrders();
  }, [status, filter, timeRange]);
  
  // Calculate order statistics
  const calculateOrderStats = (ordersList: Order[]) => {
    if (!ordersList.length) {
      setOrderStats({
        total: 0,
        open: 0,
        filled: 0,
        cancelled: 0,
        totalValue: 0,
        successRate: 0
      });
      return;
    }
    
    const stats = {
      total: ordersList.length,
      open: ordersList.filter(o => o.status === 'open').length,
      filled: ordersList.filter(o => o.status === 'filled').length,
      cancelled: ordersList.filter(o => o.status === 'cancelled').length,
      totalValue: 0,
      successRate: 0
    };
    
    // Calculate total value of filled orders
    stats.totalValue = ordersList
      .filter(o => o.status === 'filled')
      .reduce((sum, order) => {
        const price = parseFloat(order.price || '0');
        const quantity = parseFloat(order.filledQuantity);
        return sum + (price * quantity);
      }, 0);
    
    // Calculate success rate (filled orders / (filled + cancelled) * 100)
    const completedOrders = stats.filled + stats.cancelled;
    stats.successRate = completedOrders > 0 
      ? (stats.filled / completedOrders) * 100 
      : 0;
    
    setOrderStats(stats);
  };
  
  const handleCancelOrder = async (orderId: number) => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to cancel order');
      }
      
      toast.success('Order cancelled successfully');
      
      // Refresh orders
      setOrders(orders.map(order => 
        order.id === orderId ? { ...order, status: 'cancelled' } : order
      ));
      
      // Update statistics
      calculateOrderStats(orders.map(order => 
        order.id === orderId ? { ...order, status: 'cancelled' } : order
      ));
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast.error('Failed to cancel order');
    }
  };
  
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!session) {
    return null; // Will redirect in the useEffect
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
          <p className="text-gray-600">Track and manage your trading orders</p>
        </div>
        
        {/* Order Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-md">
            <h3 className="text-sm font-medium text-gray-500">Total Orders</h3>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{orderStats.total}</p>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow-md">
            <h3 className="text-sm font-medium text-gray-500">Open Orders</h3>
            <p className="mt-1 text-2xl font-semibold text-blue-600">{orderStats.open}</p>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow-md">
            <h3 className="text-sm font-medium text-gray-500">Filled Orders</h3>
            <p className="mt-1 text-2xl font-semibold text-green-600">{orderStats.filled}</p>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow-md">
            <h3 className="text-sm font-medium text-gray-500">Success Rate</h3>
            <p className="mt-1 text-2xl font-semibold text-indigo-600">
              {orderStats.successRate.toFixed(1)}%
            </p>
          </div>
        </div>
        
        {/* Time Range Filter */}
        <div className="mb-4 flex items-center space-x-2">
          <span className="text-sm text-gray-500">Time Range:</span>
          <button
            className={`px-3 py-1 text-xs font-medium rounded ${
              timeRange === '1d' 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setTimeRange('1d')}
          >
            1 Day
          </button>
          <button
            className={`px-3 py-1 text-xs font-medium rounded ${
              timeRange === '1w' 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setTimeRange('1w')}
          >
            1 Week
          </button>
          <button
            className={`px-3 py-1 text-xs font-medium rounded ${
              timeRange === '1m' 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setTimeRange('1m')}
          >
            1 Month
          </button>
          <button
            className={`px-3 py-1 text-xs font-medium rounded ${
              timeRange === 'all' 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setTimeRange('all')}
          >
            All Time
          </button>
        </div>
        
        {/* Filter Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <div className="flex space-x-8">
            <button
              className={`border-b-2 px-1 pb-4 text-sm font-medium ${
                filter === 'all'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
              onClick={() => setFilter('all')}
            >
              All Orders
            </button>
            <button
              className={`border-b-2 px-1 pb-4 text-sm font-medium ${
                filter === 'open'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
              onClick={() => setFilter('open')}
            >
              Open
            </button>
            <button
              className={`border-b-2 px-1 pb-4 text-sm font-medium ${
                filter === 'filled'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
              onClick={() => setFilter('filled')}
            >
              Filled
            </button>
            <button
              className={`border-b-2 px-1 pb-4 text-sm font-medium ${
                filter === 'cancelled'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
              onClick={() => setFilter('cancelled')}
            >
              Cancelled
            </button>
          </div>
        </div>
        
        {orders.length === 0 ? (
          <div className="rounded-lg bg-white p-8 shadow-md text-center">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No Orders Found</h2>
            <p className="text-gray-600 mb-4">You don't have any orders with the selected filter.</p>
            <Link 
              href="/markets" 
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Explore Markets
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Market / Option
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Side
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Filled
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">
                          <Link href={`/markets/${order.marketId}`} className="hover:text-blue-600">
                            {order.market?.name || 'Unknown Market'}
                          </Link>
                        </div>
                        <div className="text-sm text-gray-500">
                          {order.marketOption?.name || 'Unknown Option'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="capitalize">{order.type}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          order.side === 'buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {order.side.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.type === 'market' ? 'Market' : `$${parseFloat(order.price).toFixed(2)}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {parseFloat(order.quantity).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {parseFloat(order.filledQuantity).toFixed(2)}
                        {order.status !== 'open' && (
                          <span className="text-xs text-gray-400 ml-1">
                            ({(parseFloat(order.filledQuantity) / parseFloat(order.quantity) * 100).toFixed(0)}%)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          order.status === 'open' ? 'bg-blue-100 text-blue-800' :
                          order.status === 'filled' ? 'bg-green-100 text-green-800' :
                          order.status === 'partially_filled' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {getOrderStatusDisplay(order.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleString()}
                        {order.expiresAt && (
                          <div className="text-xs text-gray-400">
                            Expires: {new Date(order.expiresAt).toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {(order.status === 'open' || order.status === 'partially_filled') && (
                          <button
                            onClick={() => handleCancelOrder(order.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Cancel
                          </button>
                        )}
                        <Link
                          href={`/markets/${order.marketId}/trade`}
                          className="text-blue-600 hover:text-blue-900 ml-4"
                        >
                          Trade
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}