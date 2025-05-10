import { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useWallet } from '@/lib/walletContext';
import { usePrices } from '@/lib/priceService';
import { useQuery } from '@tanstack/react-query';

interface Asset {
  id: number;
  name: string;
  symbol: string;
  type: string;
}

interface Vault {
  id: number;
  name: string;
  userId: number;
  description: string;
  type: string;
  rebalanceThreshold: number;
  rebalanceInterval: string;
}

interface Allocation {
  id: number;
  vaultId: number;
  assetId: number;
  targetPercentage: number;
  amount: number;
}

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
  
  // Fetch assets
  const { data: assets, isLoading: assetsLoading } = useQuery<Asset[]>({
    queryKey: ['/api/assets'],
    enabled: isConnected,
  });
  
  // Fetch vaults
  const { data: vaults, isLoading: vaultsLoading } = useQuery<Vault[]>({
    queryKey: ['/api/vaults'],
    enabled: isConnected,
  });
  
  // Fetch allocations for each vault
  const allocationsQueries = (vaults || []).map(vault => {
    return useQuery<Allocation[]>({
      queryKey: [`/api/vaults/${vault.id}/allocations`],
      enabled: isConnected && !!vaults?.length,
    });
  });
  
  // Get asset symbols
  const assetSymbols = assets ? assets.map(asset => asset.symbol) : [];
  
  // Fetch prices
  const { prices, loading: pricesLoading } = usePrices(assetSymbols, 30000);
  
  // Generate colors for each asset
  const assetColors = useMemo(() => {
    if (!assets) return {};
    return assets.reduce((acc, asset) => {
      acc[asset.id] = stringToColor(asset.symbol);
      return acc;
    }, {} as Record<number, string>);
  }, [assets]);
  
  // Calculate chart data
  useEffect(() => {
    if (!isConnected || assetsLoading || vaultsLoading || pricesLoading || !assets?.length || Object.keys(prices).length === 0) {
      return;
    }
    
    // Aggregate asset values across all vaults
    const assetValues: Record<number, { amount: number, valueUSD: number }> = {};
    let totalValue = 0;
    let hasAnyAllocations = false;
    
    // Process all allocations
    (vaults || []).forEach((vault, index) => {
      const allocationsQuery = allocationsQueries[index];
      if (allocationsQuery.data && allocationsQuery.data.length > 0) {
        hasAnyAllocations = true;
        allocationsQuery.data.forEach(allocation => {
          const asset = assets.find(a => a.id === allocation.assetId);
          if (asset && prices[asset.symbol]) {
            // Initialize if needed
            if (!assetValues[asset.id]) {
              assetValues[asset.id] = { amount: 0, valueUSD: 0 };
            }
            
            // Add to the amount
            assetValues[asset.id].amount += allocation.amount;
            
            // Calculate value
            const valueUSD = allocation.amount * prices[asset.symbol];
            assetValues[asset.id].valueUSD += valueUSD;
            totalValue += valueUSD;
          }
        });
      }
    });
    
    // If no allocations found but wallet is connected, create demo data
    if (!hasAnyAllocations) {
      // Create mock allocation data for demo purposes
      const mockAllocations = [
        { assetId: 1, amount: 0.5 },  // BTC
        { assetId: 2, amount: 5.0 },  // ETH
        { assetId: 3, amount: 500.0 }, // L1X
        { assetId: 4, amount: 15.0 },  // SOL
        { assetId: 5, amount: 1000.0 } // USDC
      ];
      
      mockAllocations.forEach(mockAllocation => {
        const asset = assets.find(a => a.id === mockAllocation.assetId);
        if (asset && prices[asset.symbol]) {
          // Initialize if needed
          if (!assetValues[asset.id]) {
            assetValues[asset.id] = { amount: 0, valueUSD: 0 };
          }
          
          // Add to the amount
          assetValues[asset.id].amount += mockAllocation.amount;
          
          // Calculate value
          const valueUSD = mockAllocation.amount * prices[asset.symbol];
          assetValues[asset.id].valueUSD += valueUSD;
          totalValue += valueUSD;
        }
      });
    }
    
    // Only proceed if we have any data to display
    if (totalValue > 0) {
      // Convert to chart data format
      const data: ChartData[] = [];
      
      Object.entries(assetValues).forEach(([assetId, values]) => {
        const assetIdNum = parseInt(assetId, 10);
        const asset = assets.find(a => a.id === assetIdNum);
        
        if (asset) {
          const percentage = (values.valueUSD / totalValue) * 100;
          data.push({
            name: asset.name,
            symbol: asset.symbol,
            value: percentage,
            valueUSD: values.valueUSD,
            color: assetColors[assetIdNum] || '#8884d8',
          });
        }
      });
      
      // Sort by value
      data.sort((a, b) => b.valueUSD - a.valueUSD);
      
      setChartData(data);
    }
  }, [
    isConnected,
    assets,
    vaults,
    prices,
    allocationsQueries,
    assetsLoading,
    vaultsLoading,
    pricesLoading,
    assetColors,
  ]);
  
  // Determine loading state
  const isLoading = assetsLoading || vaultsLoading || pricesLoading || 
    allocationsQueries.some(query => query.isLoading);
  
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