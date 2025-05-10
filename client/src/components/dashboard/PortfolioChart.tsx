import { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useWallet } from '@/lib/walletContext';
import { usePriceDetails } from '@/lib/usePriceDetails';

interface ChartData {
  name: string;
  symbol: string;
  value: number;
  valueUSD: number;
  color: string;
}

// Generate a consistent color from a string
function stringToColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 60%)`;
}

// Custom tooltip
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-card border rounded shadow p-3">
        <p className="font-medium">{data.name} ({data.symbol})</p>
        <p>Value: ${data.valueUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
        <p>Percentage: {data.value.toFixed(2)}%</p>
      </div>
    );
  }
  
  return null;
};

export function PortfolioChart() {
  const { isConnected } = useWallet();
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Fetch current prices with 24h history
  const { priceDetails, loading: pricesLoading } = usePriceDetails(30000);
  
  // Calculate portfolio distribution
  useEffect(() => {
    if (!isConnected || pricesLoading || Object.keys(priceDetails).length === 0) {
      return;
    }
    
    setIsLoading(true);
    
    // Define demo portfolio values
    const mockPortfolio = [
      { symbol: 'BTC', name: 'Bitcoin', amount: 0.5 },
      { symbol: 'ETH', name: 'Ethereum', amount: 5.0 },
      { symbol: 'L1X', name: 'Layer One X', amount: 500.0 },
      { symbol: 'SOL', name: 'Solana', amount: 15.0 },
      { symbol: 'USDC', name: 'USD Coin', amount: 1000.0 }
    ];
    
    // Calculate total portfolio value
    let totalValue = 0;
    mockPortfolio.forEach(asset => {
      if (priceDetails[asset.symbol]) {
        totalValue += asset.amount * priceDetails[asset.symbol].current;
      }
    });
    
    if (totalValue > 0) {
      // Create chart data
      const data: ChartData[] = mockPortfolio
        .filter(asset => priceDetails[asset.symbol]) // Only include assets with price data
        .map(asset => {
          const valueUSD = asset.amount * priceDetails[asset.symbol].current;
          const percentage = (valueUSD / totalValue) * 100;
          
          return {
            name: asset.name,
            symbol: asset.symbol,
            value: percentage,
            valueUSD: valueUSD,
            color: stringToColor(asset.symbol)
          };
        })
        .sort((a, b) => b.valueUSD - a.valueUSD); // Sort by value (highest first)
      
      setChartData(data);
    }
    
    setIsLoading(false);
  }, [isConnected, priceDetails, pricesLoading]);
  
  // Empty state when wallet is not connected
  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Distribution</CardTitle>
          <CardDescription>Connect your wallet to view your portfolio distribution</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-64">
          <p className="text-muted-foreground">No portfolio data available</p>
        </CardContent>
      </Card>
    );
  }
  
  // Loading state
  if (isLoading || pricesLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Distribution</CardTitle>
          <CardDescription>Loading portfolio data...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-64">
          <Skeleton className="h-full w-full rounded-md" />
        </CardContent>
      </Card>
    );
  }
  
  // Empty state when no data is available
  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Distribution</CardTitle>
          <CardDescription>No assets in your portfolio</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-64">
          <p className="text-muted-foreground">Add assets to your vaults to see distribution</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Distribution</CardTitle>
        <CardDescription>Asset allocation across your portfolio</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value, entry, index) => {
                  const item = chartData[index];
                  return `${item.name} (${item.value.toFixed(1)}%)`;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}