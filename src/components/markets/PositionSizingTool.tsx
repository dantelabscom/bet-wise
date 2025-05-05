import { useState, useEffect } from 'react';

interface PositionSizingToolProps {
  currentPrice: string;
  accountBalance?: string;
  defaultRiskAmount?: string;
  defaultRiskPercent?: string;
  onPositionSizeCalculated?: (positionSize: number, totalCost: number) => void;
}

export default function PositionSizingTool({
  currentPrice,
  accountBalance,
  defaultRiskAmount = '10.00',
  defaultRiskPercent = '2',
  onPositionSizeCalculated
}: PositionSizingToolProps) {
  const [riskAmount, setRiskAmount] = useState(defaultRiskAmount);
  const [riskPercent, setRiskPercent] = useState(defaultRiskPercent);
  const [stopPrice, setStopPrice] = useState('');
  const [takeProfitPrice, setTakeProfitPrice] = useState('');
  const [usePercentageRisk, setUsePercentageRisk] = useState(false);
  const [positionSize, setPositionSize] = useState(0);
  const [riskRewardRatio, setRiskRewardRatio] = useState<number | null>(null);
  
  // Update risk amount when risk percentage changes and vice versa
  useEffect(() => {
    if (!accountBalance || !usePercentageRisk) return;
    
    const balanceValue = parseFloat(accountBalance);
    if (isNaN(balanceValue)) return;
    
    const percentValue = parseFloat(riskPercent);
    if (isNaN(percentValue)) return;
    
    // Update risk amount based on percentage
    const calculatedRiskAmount = (balanceValue * percentValue / 100).toFixed(2);
    setRiskAmount(calculatedRiskAmount);
  }, [riskPercent, accountBalance, usePercentageRisk]);
  
  // Update risk percentage when risk amount changes
  useEffect(() => {
    if (!accountBalance || usePercentageRisk) return;
    
    const balanceValue = parseFloat(accountBalance);
    if (isNaN(balanceValue)) return;
    
    const amountValue = parseFloat(riskAmount);
    if (isNaN(amountValue)) return;
    
    // Update risk percentage based on amount
    const calculatedRiskPercent = (amountValue / balanceValue * 100).toFixed(2);
    setRiskPercent(calculatedRiskPercent);
  }, [riskAmount, accountBalance, usePercentageRisk]);
  
  // Calculate position size and risk/reward ratio
  useEffect(() => {
    if (!stopPrice) {
      setPositionSize(0);
      setRiskRewardRatio(null);
      return;
    }
    
    const currentPriceValue = parseFloat(currentPrice);
    const stopPriceValue = parseFloat(stopPrice);
    const riskAmountValue = parseFloat(riskAmount);
    
    if (isNaN(currentPriceValue) || isNaN(stopPriceValue) || isNaN(riskAmountValue) || 
        stopPriceValue === currentPriceValue) {
      setPositionSize(0);
      setRiskRewardRatio(null);
      return;
    }
    
    // Calculate position size: Risk amount / (Entry price - Stop price)
    const priceDiff = Math.abs(currentPriceValue - stopPriceValue);
    const calculatedPositionSize = riskAmountValue / priceDiff;
    
    setPositionSize(calculatedPositionSize);
    
    // Calculate risk/reward ratio if take profit is set
    if (takeProfitPrice) {
      const takeProfitValue = parseFloat(takeProfitPrice);
      if (!isNaN(takeProfitValue) && takeProfitValue !== currentPriceValue) {
        const reward = Math.abs(takeProfitValue - currentPriceValue) * calculatedPositionSize;
        const risk = riskAmountValue;
        setRiskRewardRatio(reward / risk);
      }
    }
    
    // Notify parent component
    if (onPositionSizeCalculated) {
      const totalCost = calculatedPositionSize * currentPriceValue;
      onPositionSizeCalculated(calculatedPositionSize, totalCost);
    }
    
  }, [currentPrice, stopPrice, takeProfitPrice, riskAmount, onPositionSizeCalculated]);
  
  // Get risk/reward color class
  const getRiskRewardClass = () => {
    if (!riskRewardRatio) return 'text-gray-600';
    if (riskRewardRatio >= 2) return 'text-green-600';
    if (riskRewardRatio >= 1) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Position Sizing Tool</h2>
        
        {accountBalance && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">Account Balance: ${accountBalance}</span>
          </div>
        )}
      </div>
      
      {accountBalance && (
        <div className="flex items-center space-x-2">
          <button
            className={`px-3 py-1 text-xs font-medium rounded ${
              !usePercentageRisk 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-gray-100 text-gray-700'
            }`}
            onClick={() => setUsePercentageRisk(false)}
          >
            Fixed Amount
          </button>
          <button
            className={`px-3 py-1 text-xs font-medium rounded ${
              usePercentageRisk 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-gray-100 text-gray-700'
            }`}
            onClick={() => setUsePercentageRisk(true)}
          >
            Percentage
          </button>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {usePercentageRisk && accountBalance ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Risk Percentage (%)
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="100"
              value={riskPercent}
              onChange={(e) => setRiskPercent(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Risk Amount ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={riskAmount}
              onChange={(e) => setRiskAmount(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
        )}
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stop Loss Price
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={stopPrice}
            onChange={(e) => setStopPrice(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="Enter your stop price"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Take Profit Price (optional)
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={takeProfitPrice}
            onChange={(e) => setTakeProfitPrice(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="Enter take profit price"
          />
        </div>
      </div>
      
      <div className="pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center text-sm mb-2">
          <span className="text-gray-700">Entry Price:</span>
          <span className="font-medium">${currentPrice}</span>
        </div>
        
        <div className="flex justify-between items-center text-sm mb-2">
          <span className="text-gray-700">Risk Amount:</span>
          <span className="font-medium">${riskAmount}</span>
        </div>
        
        {riskRewardRatio !== null && (
          <div className="flex justify-between items-center text-sm mb-2">
            <span className="text-gray-700">Risk/Reward Ratio:</span>
            <span className={`font-medium ${getRiskRewardClass()}`}>
              1:{riskRewardRatio.toFixed(2)}
            </span>
          </div>
        )}
        
        <div className="flex justify-between items-center text-sm mb-2">
          <span className="text-gray-700">Recommended Position Size:</span>
          <span className="font-medium">{positionSize.toFixed(2)} shares</span>
        </div>
        
        <div className="flex justify-between items-center text-sm mb-4">
          <span className="text-gray-700">Total Cost:</span>
          <span className="font-medium">
            ${(positionSize * parseFloat(currentPrice)).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
} 