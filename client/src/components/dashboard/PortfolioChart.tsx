import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useWallet } from '@/lib/walletContext';
import { usePortfolio } from '@/lib/portfolioContext';
import { useQuery } from '@tanstack/react-query';

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
        <p>Value: ${data.valueUSD.toLocaleString(undefined, { maximumFractionDigits: 3 })}</p>
        <p>Percentage: {Math.round(data.value)}%</p>
      </div>
    );
  }
  
  return null;
};

export function PortfolioChart() {
  const { isConnected } = useWallet();
  const { assetAllocations, isLoading } = usePortfolio();
  
  // Check if user is authenticated via API
  const { data: user } = useQuery<any>({
    queryKey: ['/api/auth/me'],
  });
  
  // Consider user authenticated if they have wallet connected OR are logged in via traditional auth
  const isAuthenticated = isConnected || !!user;
  
  // Transform asset allocations into chart data
  const chartData = useMemo(() => {
    return assetAllocations.map(allocation => ({
      name: allocation.asset.name,
      symbol: allocation.asset.symbol,
      value: allocation.percentOfPortfolio,
      valueUSD: allocation.valueUSD,
      color: stringToColor(allocation.asset.symbol)
    }));
  }, [assetAllocations]);
  
  // Empty state when not authenticated
  if (!isAuthenticated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Distribution</CardTitle>
          <CardDescription>Login or connect your wallet to view your portfolio distribution</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-64">
          <p className="text-muted-foreground">No portfolio data available</p>
        </CardContent>
      </Card>
    );
  }
  
  // Loading state
  if (isLoading) {
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
    // Create an empty/placeholder pie chart with a single 100% segment
    const emptyChartData = [
      {
        name: "Empty Portfolio",
        value: 100,
        color: "hsl(var(--muted))"
      }
    ];
    
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Distribution</CardTitle>
          <CardDescription>No assets in your portfolio</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={emptyChartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  <Cell fill="hsl(var(--muted))" />
                </Pie>
                <Legend content={() => (
                  <div className="flex justify-center mt-4">
                    <p className="text-muted-foreground">Add assets to your portfolio to see distribution</p>
                  </div>
                )} />
              </PieChart>
            </ResponsiveContainer>
          </div>
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
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${Math.round(percent * 100)}%`}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value, entry, index) => {
                  const item = chartData[index];
                  return `${item.name} (${Math.round(item.value)}%)`;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}