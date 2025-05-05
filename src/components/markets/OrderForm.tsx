import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';

interface OrderFormProps {
  marketId: number;
  marketOptionId: number;
  optionName: string;
  currentPrice: string;
  initialPrice?: string;
  initialSide?: 'buy' | 'sell';
  accountBalance?: string;
  onOrderPlaced?: () => void;
}

// Available order types
type OrderType = 'market' | 'limit' | 'stop' | 'trailing';

export default function OrderForm({
  marketId,
  marketOptionId,
  optionName,
  currentPrice,
  initialPrice,
  initialSide = 'buy',
  accountBalance,
  onOrderPlaced
}: OrderFormProps) {
  const { data: session } = useSession();
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [orderType, setOrderType] = useState<OrderType>('limit');
  const [side, setSide] = useState<'buy' | 'sell'>(initialSide);
  const [price, setPrice] = useState(initialPrice || currentPrice);
  const [stopPrice, setStopPrice] = useState('');
  const [trailingAmount, setTrailingAmount] = useState('0.5');
  const [trailingPercent, setTrailingPercent] = useState(true);
  const [quantity, setQuantity] = useState('1');
  const [total, setTotal] = useState<string | number>('0');
  const [timeInForce, setTimeInForce] = useState<'gtc' | 'day' | 'ioc' | 'fok'>('gtc');
  const [expiration, setExpiration] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Calculate total value
  useEffect(() => {
    if (orderType === 'market') {
      setTotal('Market Price');
      return;
    }
    
    const priceValue = parseFloat(price) || 0;
    const quantityValue = parseFloat(quantity) || 0;
    const totalValue = priceValue * quantityValue;
    
    setTotal(totalValue.toFixed(2));
  }, [price, quantity, orderType]);
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!session?.user?.id) {
      toast.error('You must be logged in to place orders');
      return;
    }
    
    if (parseFloat(quantity) <= 0) {
      toast.error('Quantity must be greater than zero');
      return;
    }
    
    if (orderType === 'limit' && parseFloat(price) <= 0) {
      toast.error('Price must be greater than zero');
      return;
    }
    
    if (orderType === 'stop' && parseFloat(stopPrice) <= 0) {
      toast.error('Stop price must be greater than zero');
      return;
    }
    
    if (orderType === 'trailing' && parseFloat(trailingAmount) <= 0) {
      toast.error('Trailing amount must be greater than zero');
      return;
    }
    
    try {
      setSubmitting(true);
      
      // Prepare order data based on order type
      const orderData: Record<string, any> = {
        marketId,
        marketOptionId,
        type: orderType,
        side,
        quantity,
        timeInForce,
      };
      
      // Add price for limit orders
      if (orderType === 'limit') {
        orderData.price = price;
        
        // Add expiration if set
        if (timeInForce === 'gtc' && expiration) {
          orderData.expiresAt = new Date(expiration).toISOString();
        }
      }
      
      // Add stop price for stop orders
      if (orderType === 'stop') {
        orderData.stopPrice = stopPrice;
        orderData.price = price; // Limit price if it's a stop-limit
      }
      
      // Add trailing data for trailing stop orders
      if (orderType === 'trailing') {
        orderData.trailingAmount = trailingAmount;
        orderData.trailingPercent = trailingPercent;
      }
      
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to place order');
      }
      
      const data = await response.json();
      
      // Success!
      toast.success(`Order placed successfully!`);
      
      // Reset form
      setQuantity('1');
      if (orderType === 'limit' && !initialPrice) {
        setPrice(currentPrice);
      }
      if (orderType === 'stop') {
        setStopPrice('');
      }
      
      // Notify parent component
      if (onOrderPlaced) {
        onOrderPlaced();
      }
      
    } catch (error: any) {
      console.error('Error placing order:', error);
      toast.error(error.message || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Get button text based on order type and side
  const getButtonText = () => {
    if (submitting) return 'Processing...';
    
    let text = side === 'buy' ? 'Buy' : 'Sell';
    
    switch (orderType) {
      case 'market':
        return `${text} Market`;
      case 'limit':
        return `${text} Limit`;
      case 'stop':
        return `${text} Stop`;
      case 'trailing':
        return `${text} Trailing Stop`;
      default:
        return text;
    }
  };
  
  // Get button color class based on side
  const getButtonColorClass = () => {
    return side === 'buy'
      ? 'bg-green-600 hover:bg-green-700'
      : 'bg-red-600 hover:bg-red-700';
  };
  
  return (
    <div className="rounded-lg bg-white p-4 shadow-md">
      <div className="mb-2 text-lg font-semibold text-gray-900">
        Place Order: {optionName}
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <div className="flex space-x-2 mb-4">
            {/* Order Type Selection */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Order Type
              </label>
              <div className="flex flex-wrap rounded-md shadow-sm">
                <button
                  type="button"
                  className={`flex-1 py-2 px-3 text-xs font-medium rounded-l-md border ${
                    orderType === 'limit'
                      ? 'bg-blue-50 text-blue-700 border-blue-300'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => setOrderType('limit')}
                >
                  Limit
                </button>
                <button
                  type="button"
                  className={`flex-1 py-2 px-3 text-xs font-medium border-t border-b ${
                    orderType === 'market'
                      ? 'bg-blue-50 text-blue-700 border-blue-300'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => setOrderType('market')}
                >
                  Market
                </button>
                <button
                  type="button"
                  className={`flex-1 py-2 px-3 text-xs font-medium border-t border-b ${
                    orderType === 'stop'
                      ? 'bg-blue-50 text-blue-700 border-blue-300'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => setOrderType('stop')}
                >
                  Stop
                </button>
                <button
                  type="button"
                  className={`flex-1 py-2 px-3 text-xs font-medium rounded-r-md border ${
                    orderType === 'trailing'
                      ? 'bg-blue-50 text-blue-700 border-blue-300'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => setOrderType('trailing')}
                >
                  Trailing
                </button>
              </div>
            </div>
            
            {/* Trade Side Selection */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Side
              </label>
              <div className="flex rounded-md shadow-sm">
                <button
                  type="button"
                  className={`flex-1 py-2 px-4 text-sm font-medium rounded-l-md border ${
                    side === 'buy'
                      ? 'bg-green-50 text-green-700 border-green-300'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => setSide('buy')}
                >
                  Buy
                </button>
                <button
                  type="button"
                  className={`flex-1 py-2 px-4 text-sm font-medium rounded-r-md border ${
                    side === 'sell'
                      ? 'bg-red-50 text-red-700 border-red-300'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => setSide('sell')}
                >
                  Sell
                </button>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            {/* Price Inputs based on Order Type */}
            {orderType === 'limit' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Limit Price
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  required
                />
              </div>
            )}
            
            {orderType === 'stop' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stop Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={stopPrice}
                    onChange={(e) => setStopPrice(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {side === 'buy' ? 'Triggers when price rises to this value' : 'Triggers when price falls to this value'}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Limit Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    required
                  />
                </div>
              </>
            )}
            
            {orderType === 'trailing' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Trailing Amount {trailingPercent ? '(%)' : '($)'}
                </label>
                <div className="flex">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={trailingAmount}
                    onChange={(e) => setTrailingAmount(e.target.value)}
                    className="block w-full rounded-l-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    required
                  />
                  <button
                    type="button"
                    className="px-3 py-2 border border-l-0 border-gray-300 bg-gray-50 text-gray-500 text-sm"
                    onClick={() => setTrailingPercent(!trailingPercent)}
                  >
                    {trailingPercent ? '%' : '$'}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {side === 'buy' 
                    ? 'Buy when price rises by this amount from lowest point' 
                    : 'Sell when price falls by this amount from highest point'}
                </p>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                required
              />
            </div>
            
            {/* Advanced Settings Toggle */}
            <div>
              <button
                type="button"
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
                <svg 
                  className={`ml-1 w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            
            {/* Advanced Settings Section */}
            {showAdvanced && (
              <div className="pt-3 border-t border-gray-200 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time in Force
                  </label>
                  <select
                    value={timeInForce}
                    onChange={(e) => setTimeInForce(e.target.value as any)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  >
                    <option value="gtc">Good Till Canceled</option>
                    <option value="day">Day Order</option>
                    <option value="ioc">Immediate or Cancel</option>
                    <option value="fok">Fill or Kill</option>
                  </select>
                </div>
                
                {timeInForce === 'gtc' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expiration (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={expiration || ''}
                      onChange={(e) => setExpiration(e.target.value || null)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                )}
              </div>
            )}
            
            <div className="pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center text-sm mb-2">
                <span className="text-gray-700">Current Market Price:</span>
                <span className="font-medium">${currentPrice}</span>
              </div>
              
              <div className="flex justify-between items-center text-sm mb-4">
                <span className="text-gray-700">Total Value:</span>
                <span className="font-medium">{typeof total === 'string' ? total : `$${total}`}</span>
              </div>
              
              {accountBalance && (
                <div className="flex justify-between items-center text-sm mb-4">
                  <span className="text-gray-700">Account Balance:</span>
                  <span className="font-medium">${accountBalance}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className={`inline-flex justify-center rounded-md border border-transparent ${
              getButtonColorClass()
            } py-2 px-4 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              submitting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {getButtonText()}
          </button>
        </div>
      </form>
    </div>
  );
} 