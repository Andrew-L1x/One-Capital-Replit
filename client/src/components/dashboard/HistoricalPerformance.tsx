import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { usePortfolio } from "@/lib/portfolioContext";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/lib/walletContext";

// Color palette for different assets in the chart
const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A374DB',
  '#FF6B6B', '#4ECDC4', '#35A7FF', '#FFC857', '#7B68EE',
];

// Date formatting helper
const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

type TimeRange = "7d" | "30d" | "90d" | "1y";

export function HistoricalPerformance() {
  const [activeTimeRange, setActiveTimeRange] = useState<TimeRange>("30d");
  const [percentChange, setPercentChange] = useState(0);
  const { isConnected } = useWallet();
  const { priceDetails, assetAllocations } = usePortfolio();

  // Fetch historical price data from API
  const { data: historicalData = [], isLoading: isLoadingHistory } = useQuery<any[]>({
    queryKey: [`/api/prices/history/${activeTimeRange}`],
    enabled: isConnected,
    refetchInterval: 60000, // Refresh every minute
  });

  // Calculate performance metrics when historical data changes
  useEffect(() => {
    if (historicalData.length < 2) {
      setPercentChange(0);
      return;
    }
    
    try {
      // Get the first and last data points
      const startValue = historicalData[0]?.portfolioValue || 0;
      const endValue = historicalData[historicalData.length - 1]?.portfolioValue || 0;
      
      if (startValue > 0 && endValue > 0) {
        const change = ((endValue - startValue) / startValue) * 100;
        setPercentChange(parseFloat(change.toFixed(2)));
      } else {
        setPercentChange(0);
      }
    } catch (error) {
      console.error("Error calculating performance change:", error);
      setPercentChange(0);
    }
  }, [historicalData]);
  
  const isPositive = percentChange >= 0;
  const isLoading = isLoadingHistory || !isConnected;

  // If not connected, show appropriate message
  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Historical Performance</CardTitle>
          <CardDescription>Connect your wallet to view performance data</CardDescription>
        </CardHeader>
        <CardContent className="h-[400px] flex items-center justify-center">
          <p className="text-muted-foreground">Wallet not connected</p>
        </CardContent>
      </Card>
    );
  }

  // If loading, show loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Historical Performance</CardTitle>
          <CardDescription>Portfolio performance over time</CardDescription>
        </CardHeader>
        <CardContent className="h-[400px] flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          <span className="ml-2">Loading chart data...</span>
        </CardContent>
      </Card>
    );
  }

  // If no data or empty portfolio, show appropriate message
  if (historicalData.length === 0 || assetAllocations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Historical Performance</CardTitle>
          <CardDescription>Portfolio performance over time</CardDescription>
        </CardHeader>
        <CardContent className="h-[400px] flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-2">No historical data available</p>
            <p className="text-sm text-muted-foreground">Create a portfolio to track performance</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get the asset symbols we want to display on the chart
  const assetSymbols = assetAllocations.slice(0, 3).map(alloc => alloc.asset.symbol);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Historical Performance</CardTitle>
            <CardDescription>Portfolio performance over time</CardDescription>
          </div>
          <div className="text-right">
            <div className={isPositive ? "text-green-600" : "text-red-600"}>
              <span className="text-xl font-bold">{isPositive ? "+" : ""}{Math.round(percentChange)}%</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {activeTimeRange} change
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="30d" value={activeTimeRange} onValueChange={(v) => setActiveTimeRange(v as TimeRange)}>
          <TabsList className="mb-4">
            <TabsTrigger value="7d">7D</TabsTrigger>
            <TabsTrigger value="30d">30D</TabsTrigger>
            <TabsTrigger value="90d">90D</TabsTrigger>
            <TabsTrigger value="1y">1Y</TabsTrigger>
          </TabsList>
          
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart 
                data={historicalData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis 
                  dataKey="formattedDate" 
                  tickMargin={10}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  tickFormatter={(value) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                  tick={{ fontSize: 12 }}
                  domain={['auto', 'auto']}
                />
                <Tooltip 
                  formatter={(value: any) => [`$${parseFloat(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, '']}
                  labelFormatter={(label) => {
                    const item = historicalData.find(d => d.formattedDate === label);
                    if (!item) return label;
                    return new Date(item.date).toLocaleDateString();
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="portfolioValue" 
                  name="Portfolio" 
                  stroke={COLORS[0]} 
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 8 }}
                />
                {assetSymbols.map((symbol, index) => (
                  <Line 
                    key={symbol}
                    type="monotone" 
                    dataKey={`assets.${symbol}`}
                    name={symbol} 
                    stroke={COLORS[index + 1]} 
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}