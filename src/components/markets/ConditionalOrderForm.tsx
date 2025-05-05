import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';

interface ConditionalOrderProps {
  marketId: number;
  marketOptionId: number;
  optionName: string;
  currentPrice: string;
  onOrderPlaced?: () => void;
}

type OrderConditionType = 'price' | 'time' | 'event';
type ConditionOperator = 'above' | 'below' | 'at_or_above' | 'at_or_below' | 'equals';
type OrderRelation = 'oco' | 'oso' | 'bracket';

// Conditional Order leg interface
interface OrderLeg {
  id: string;
  type: 'market' | 'limit' | 'stop' | 'trailing';
  side: 'buy' | 'sell';
  price: string;
  quantity: string;
  condition?: {
    type: OrderConditionType;
    operator: ConditionOperator;
    value: string;
  };
}

export default function ConditionalOrderForm({
  marketId,
  marketOptionId,
  optionName,
  currentPrice,
  onOrderPlaced
}: ConditionalOrderProps) {
  const { data: session } = useSession();
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [orderRelation, setOrderRelation] = useState<OrderRelation>('oco');
  const [legs, setLegs] = useState<OrderLeg[]>([
    {
      id: 'leg-1',
      type: 'limit',
      side: 'buy',
      price: currentPrice,
      quantity: '1',
    },
    {
      id: 'leg-2',
      type: 'limit',
      side: 'sell',
      price: currentPrice,
      quantity: '1',
    }
  ]);
  
  // Handle adding a new leg
  const handleAddLeg = () => {
    const newLeg: OrderLeg = {
      id: `leg-${legs.length + 1}`,
      type: 'limit',
      side: 'buy',
      price: currentPrice,
      quantity: '1',
    };
    
    setLegs([...legs, newLeg]);
  };
  
  // Handle removing a leg
  const handleRemoveLeg = (legId: string) => {
    if (legs.length <= 2) {
      toast.error('Conditional orders require at least two legs');
      return;
    }
    
    setLegs(legs.filter(leg => leg.id !== legId));
  };
  
  // Handle updating a leg
  const handleLegUpdate = (legId: string, field: keyof OrderLeg, value: any) => {
    setLegs(legs.map(leg => {
      if (leg.id === legId) {
        if (field === 'condition') {
          return { ...leg, condition: { ...leg.condition, ...value } };
        }
        return { ...leg, [field]: value };
      }
      return leg;
    }));
  };
  
  // Set up bracket order template
  const setupBracketOrder = () => {
    const entryPrice = parseFloat(currentPrice);
    const takeProfit = (entryPrice * 1.05).toFixed(2); // 5% profit target
    const stopLoss = (entryPrice * 0.95).toFixed(2); // 5% stop loss
    
    setLegs([
      {
        id: 'entry',
        type: 'limit',
        side: 'buy',
        price: currentPrice,
        quantity: '1',
      },
      {
        id: 'take-profit',
        type: 'limit',
        side: 'sell',
        price: takeProfit,
        quantity: '1',
        condition: {
          type: 'price',
          operator: 'above',
          value: takeProfit,
        },
      },
      {
        id: 'stop-loss',
        type: 'stop',
        side: 'sell',
        price: stopLoss,
        quantity: '1',
        condition: {
          type: 'price',
          operator: 'below',
          value: stopLoss,
        },
      }
    ]);
    
    setOrderRelation('bracket');
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!session?.user?.id) {
      toast.error('You must be logged in to place orders');
      return;
    }
    
    // Validate order legs
    for (const leg of legs) {
      if (parseFloat(leg.quantity) <= 0) {
        toast.error(`Quantity must be greater than zero for all legs`);
        return;
      }
      
      if (leg.type !== 'market' && parseFloat(leg.price) <= 0) {
        toast.error(`Price must be greater than zero for all non-market legs`);
        return;
      }
    }
    
    try {
      setSubmitting(true);
      
      // Prepare order data
      const orderData = {
        marketId,
        marketOptionId,
        type: 'conditional',
        relation: orderRelation,
        legs: legs.map(leg => ({
          type: leg.type,
          side: leg.side,
          price: leg.price,
          quantity: leg.quantity,
          condition: leg.condition
        }))
      };
      
      const response = await fetch('/api/orders/conditional', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to place conditional order');
      }
      
      const data = await response.json();
      
      // Success!
      toast.success(`Conditional order placed successfully!`);
      
      if (onOrderPlaced) {
        onOrderPlaced();
      }
      
    } catch (error: any) {
      console.error('Error placing conditional order:', error);
      toast.error(error.message || 'Failed to place conditional order');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Get relationship description
  const getRelationDescription = () => {
    switch (orderRelation) {
      case 'oco':
        return 'One-Cancels-Other: When one leg is executed, all other legs are canceled.';
      case 'oso':
        return 'One-Sends-Other: After the first leg is executed, the other legs become active.';
      case 'bracket':
        return 'Bracket Order: An entry order with take profit and stop loss orders.';
      default:
        return '';
    }
  };
  
  return (
    <div className="rounded-lg bg-white p-4 shadow-md">
      <div className="mb-2 text-lg font-semibold text-gray-900">
        Advanced Conditional Order: {optionName}
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          {/* Order Relation Type */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Order Relation
            </label>
            <div className="flex space-x-2 mb-2">
              <button
                type="button"
                className={`flex-1 py-2 px-3 text-xs font-medium rounded-md border ${
                  orderRelation === 'oco'
                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => setOrderRelation('oco')}
              >
                One-Cancels-Other (OCO)
              </button>
              <button
                type="button"
                className={`flex-1 py-2 px-3 text-xs font-medium rounded-md border ${
                  orderRelation === 'oso'
                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => setOrderRelation('oso')}
              >
                One-Sends-Other (OSO)
              </button>
              <button
                type="button"
                className={`flex-1 py-2 px-3 text-xs font-medium rounded-md border ${
                  orderRelation === 'bracket'
                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                onClick={setupBracketOrder}
              >
                Bracket Order
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">{getRelationDescription()}</p>
          </div>
          
          {/* Order Legs */}
          <div className="space-y-4">
            {legs.map((leg, index) => (
              <div key={leg.id} className="border border-gray-200 rounded-md p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium text-sm">
                    Order Leg {index + 1} 
                    {orderRelation === 'bracket' && index === 0 && ' (Entry)'}
                    {orderRelation === 'bracket' && index === 1 && ' (Take Profit)'}
                    {orderRelation === 'bracket' && index === 2 && ' (Stop Loss)'}
                  </h3>
                  {legs.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLeg(leg.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-2">
                  {/* Order Type */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Order Type
                    </label>
                    <select
                      value={leg.type}
                      onChange={(e) => handleLegUpdate(leg.id, 'type', e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    >
                      <option value="limit">Limit</option>
                      <option value="market">Market</option>
                      <option value="stop">Stop</option>
                      <option value="trailing">Trailing</option>
                    </select>
                  </div>
                  
                  {/* Order Side */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Side
                    </label>
                    <select
                      value={leg.side}
                      onChange={(e) => handleLegUpdate(leg.id, 'side', e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    >
                      <option value="buy">Buy</option>
                      <option value="sell">Sell</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-2">
                  {/* Price */}
                  {leg.type !== 'market' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Price
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={leg.price}
                        onChange={(e) => handleLegUpdate(leg.id, 'price', e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        required
                      />
                    </div>
                  )}
                  
                  {/* Quantity */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Quantity
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={leg.quantity}
                      onChange={(e) => handleLegUpdate(leg.id, 'quantity', e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      required
                    />
                  </div>
                </div>
                
                {/* Condition (only for OSO and specific bracket legs) */}
                {(orderRelation === 'oso' || (orderRelation === 'bracket' && index > 0)) && (
                  <div className="border-t border-gray-200 pt-2 mt-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Condition Type
                        </label>
                        <select
                          value={leg.condition?.type || 'price'}
                          onChange={(e) => handleLegUpdate(leg.id, 'condition', { type: e.target.value })}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        >
                          <option value="price">Price</option>
                          <option value="time">Time</option>
                          <option value="event">Event</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Operator
                        </label>
                        <select
                          value={leg.condition?.operator || 'above'}
                          onChange={(e) => handleLegUpdate(leg.id, 'condition', { operator: e.target.value as ConditionOperator })}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        >
                          <option value="above">Above</option>
                          <option value="below">Below</option>
                          <option value="at_or_above">At or Above</option>
                          <option value="at_or_below">At or Below</option>
                          <option value="equals">Equals</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Value
                        </label>
                        <input
                          type="text"
                          value={leg.condition?.value || ''}
                          onChange={(e) => handleLegUpdate(leg.id, 'condition', { value: e.target.value })}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          placeholder={leg.condition?.type === 'price' ? 'Price value' : leg.condition?.type === 'time' ? 'YYYY-MM-DD HH:MM' : 'Event name'}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {/* Add Leg button (only for OCO and OSO) */}
            {(orderRelation === 'oco' || orderRelation === 'oso') && (
              <button
                type="button"
                onClick={handleAddLeg}
                className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Another Leg
              </button>
            )}
          </div>
          
          <div className="pt-4 border-t border-gray-200 mt-4">
            <div className="flex justify-between items-center text-sm mb-2">
              <span className="text-gray-700">Current Market Price:</span>
              <span className="font-medium">${currentPrice}</span>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 hover:bg-blue-700 py-2 px-4 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {submitting ? 'Processing...' : 'Place Conditional Order'}
          </button>
        </div>
      </form>
    </div>
  );
} 