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
  const { assetAllocations, isLoading, portfolioValue } = usePortfolio();
  
  // Check if user is authenticated via API
  const { data: user } = useQuery<any>({
    queryKey: ['/api/auth/me'],
  });
  
  // Check if this is the demo user
  const isDemoUser = user && user.email === 'demo@example.com';
  
  // Log portfolio value and asset allocations for debugging
  console.log("Portfolio data:", { 
    portfolioValue, 
    assetCount: assetAllocations.length,
    isDemoUser,
    userEmail: user?.email
  });
  
  // Consider user authenticated if they have wallet connected OR are logged in via traditional auth
  const isAuthenticated = isConnected || !!user;
  
  // Demo chart data for presentation
  const demoChartData = [
    { name: "Bitcoin", symbol: "BTC", value: 40, valueUSD: 23500.10, color: stringToColor("BTC") },
    { name: "Ethereum", symbol: "ETH", value: 25, valueUSD: 14687.56, color: stringToColor("ETH") },
    { name: "Layer One X", symbol: "L1X", value: 15, valueUSD: 8812.53, color: stringToColor("L1X") },
    { name: "Solana", symbol: "SOL", value: 10, valueUSD: 5875.02, color: stringToColor("SOL") },
    { name: "Avalanche", symbol: "AVAX", value: 5, valueUSD: 2937.51, color: stringToColor("AVAX") },
    { name: "Polygon", symbol: "MATIC", value: 5, valueUSD: 2937.51, color: stringToColor("MATIC") }
  ];
  
  // Transform asset allocations into chart data
  const chartData = useMemo(() => {
    // If this is a demo user, return the demo chart data
    if (isDemoUser) {
      console.log("Using demo chart data for demo user");
      return demoChartData;
    }
    
    // Add logging to see what data we're receiving
    console.log("Transforming chart data from allocations:", assetAllocations);
    
    if (assetAllocations.length === 0) {
      console.log("No asset allocations, returning empty chart data");
      return [];
    }
    
    return assetAllocations.map(allocation => {
      // Create chart entry for this allocation
      const entry = {
        name: allocation.asset.name,
        symbol: allocation.asset.symbol,
        value: allocation.percentOfPortfolio,
        valueUSD: allocation.valueUSD,
        color: stringToColor(allocation.asset.symbol)
      };
      
      console.log(`Chart entry for ${allocation.asset.symbol}: value=${entry.value}%, valueUSD=${entry.valueUSD}`);
      return entry;
    });
  }, [assetAllocations, isDemoUser]);
  
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
  
  // Empty state when no data is available (and not a demo user)
  if (chartData.length === 0 && !isDemoUser) {
    console.log("Chart has no data - showing empty state");
    
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
  
  // Regular chart with data
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