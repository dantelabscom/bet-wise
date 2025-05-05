import { useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, 
  AreaChart, Area, BarChart, Bar,
  ReferenceLine
} from 'recharts';

// Chart time range options
export const TIME_RANGES = [
  { label: '1H', value: '1h' },
  { label: '6H', value: '6h' },
  { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
  { label: '1M', value: '1m' },
  { label: 'ALL', value: 'all' },
];

// Chart types
export type ChartType = 'line' | 'area' | 'candle' | 'bar';

export interface PriceDataPoint {
  time: string;
  price: number;
  volume?: number;
  timestamp: number;
}

interface PriceChartProps {
  data: PriceDataPoint[];
  seriesName: string;
  timeRange: string;
  onTimeRangeChange: (range: string) => void;
  chartType?: ChartType;
  onChartTypeChange?: (type: ChartType) => void;
  height?: number | string;
  showVolume?: boolean;
  referencePrice?: number;
  referencePriceLabel?: string;
  colorScheme?: {
    lineColor?: string;
    areaColor?: string;
    volumeColor?: string;
    referenceLine?: string;
  };
}

export default function PriceChart({
  data,
  seriesName,
  timeRange,
  onTimeRangeChange,
  chartType = 'area',
  onChartTypeChange,
  height = 300,
  showVolume = false,
  referencePrice,
  referencePriceLabel,
  colorScheme = {
    lineColor: '#0088FE',
    areaColor: '#0088FE',
    volumeColor: '#8884d8',
    referenceLine: '#ff0000'
  }
}: PriceChartProps) {
  
  return (
    <div className="w-full">
      {/* Chart controls */}
      <div className="flex justify-between items-center px-4 py-2 border-b border-gray-200">
        <div className="flex space-x-1">
          {TIME_RANGES.map((range) => (
            <button
              key={range.value}
              className={`px-3 py-1 text-xs font-medium rounded ${
                timeRange === range.value 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
              onClick={() => onTimeRangeChange(range.value)}
            >
              {range.label}
            </button>
          ))}
        </div>
        
        {onChartTypeChange && (
          <div className="flex space-x-1">
            <button
              className={`p-2 text-xs rounded ${
                chartType === 'line' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'
              }`}
              onClick={() => onChartTypeChange('line')}
            >
              Line
            </button>
            <button
              className={`p-2 text-xs rounded ${
                chartType === 'area' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'
              }`}
              onClick={() => onChartTypeChange('area')}
            >
              Area
            </button>
            <button
              className={`p-2 text-xs rounded ${
                chartType === 'bar' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'
              }`}
              onClick={() => onChartTypeChange('bar')}
            >
              Bar
            </button>
          </div>
        )}
      </div>
      
      {/* Chart */}
      <div className="p-4" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'line' ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis domain={['auto', 'auto']} />
              <Tooltip 
                formatter={(value: any) => [`$${value}`, 'Price']}
                labelFormatter={(label) => `Time: ${label}`}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="price" 
                name={seriesName} 
                stroke={colorScheme.lineColor} 
                activeDot={{ r: 8 }} 
              />
              {referencePrice && (
                <ReferenceLine 
                  y={referencePrice} 
                  stroke={colorScheme.referenceLine} 
                  strokeDasharray="3 3" 
                  label={referencePriceLabel || 'Reference'} 
                />
              )}
            </LineChart>
          ) : chartType === 'area' ? (
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis domain={['auto', 'auto']} />
              <Tooltip 
                formatter={(value: any) => [`$${value}`, 'Price']}
                labelFormatter={(label) => `Time: ${label}`}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="price"
                name={seriesName}
                stroke={colorScheme.lineColor}
                fill={colorScheme.areaColor}
                fillOpacity={0.3}
              />
              {referencePrice && (
                <ReferenceLine 
                  y={referencePrice} 
                  stroke={colorScheme.referenceLine} 
                  strokeDasharray="3 3" 
                  label={referencePriceLabel || 'Reference'} 
                />
              )}
            </AreaChart>
          ) : (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              {showVolume && (
                <Bar dataKey="volume" name="Volume" fill={colorScheme.volumeColor} />
              )}
              {referencePrice && (
                <ReferenceLine 
                  y={referencePrice} 
                  stroke={colorScheme.referenceLine} 
                  strokeDasharray="3 3" 
                  label={referencePriceLabel || 'Reference'} 
                />
              )}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
} 