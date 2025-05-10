import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

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
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [isGeneratingData, setIsGeneratingData] = useState(true);
  const [percentChange, setPercentChange] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Generate sample historical data
  // In a real app, this would be fetched from an API
  useEffect(() => {
    const generateData = () => {
      setIsGeneratingData(true);
      
      // Current date
      const now = new Date();
      const data: any[] = [];
      
      let days = 0;
      switch (activeTimeRange) {
        case "7d": days = 7; break;
        case "30d": days = 30; break;
        case "90d": days = 90; break;
        case "1y": days = 365; break;
      }
      
      const btcStartPrice = 65421.37 * (1 - Math.random() * 0.2);
      const ethStartPrice = 3512.89 * (1 - Math.random() * 0.2);
      const solStartPrice = 142.67 * (1 - Math.random() * 0.2);
      
      // First data point to avoid the undefined error
      data.push({
        date: new Date(now).setDate(now.getDate() - days),
        formattedDate: formatDate(new Date(now).setDate(now.getDate() - days)),
        btc: btcStartPrice,
        eth: ethStartPrice,
        sol: solStartPrice,
        portfolio: btcStartPrice * 0.4 + ethStartPrice * 0.4 + solStartPrice * 0.2,
      });
      
      // Generate historical prices with realistic, slightly volatile movements
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        
        // Random price movement factor (more volatility for longer timeframes)
        const volatilityFactor = activeTimeRange === "1y" ? 0.03 : activeTimeRange === "90d" ? 0.02 : 0.01;
        
        // Create price movements that are somewhat correlated but not identical
        const btcChange = 1 + (Math.random() * 2 - 1) * volatilityFactor;
        const ethChange = 1 + (Math.random() * 2 - 1) * volatilityFactor;
        const solChange = 1 + (Math.random() * 2 - 1) * volatilityFactor;
        
        // Calculate prices for this day
        const btcPrice = data[data.length - 1].btc * btcChange;
        const ethPrice = data[data.length - 1].eth * ethChange;
        const solPrice = data[data.length - 1].sol * solChange;
        
        // Calculate portfolio value based on allocation percentages (here we assume a simple 40/40/20 split)
        const portfolioValue = btcPrice * 0.4 + ethPrice * 0.4 + solPrice * 0.2;
        
        data.push({
          date: date.getTime(),
          formattedDate: formatDate(date.getTime()),
          btc: btcPrice,
          eth: ethPrice,
          sol: solPrice,
          portfolio: portfolioValue,
        });
      }
      
      setHistoricalData(data);
      setIsGeneratingData(false);
    };
    
    generateData();
  }, [activeTimeRange]);
  
  // Calculate performance metrics when historical data changes
  useEffect(() => {
    if (historicalData.length < 2) {
      setPercentChange(0);
      return;
    }
    
    const startValue = historicalData[0].portfolio;
    const endValue = historicalData[historicalData.length - 1].portfolio;
    const change = ((endValue - startValue) / startValue) * 100;
    
    setPercentChange(parseFloat(change.toFixed(2)));
    setIsLoading(false);
  }, [historicalData]);
  
  const isPositive = percentChange >= 0;

  if (isLoading || isGeneratingData) {
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
                  tickFormatter={(value) => {
                    // Only show some of the dates based on the time range
                    if (activeTimeRange === "7d") return value;
                    if (activeTimeRange === "30d" && historicalData.indexOf(historicalData.find(d => d.formattedDate === value)!) % 5 === 0) return value;
                    if (activeTimeRange === "90d" && historicalData.indexOf(historicalData.find(d => d.formattedDate === value)!) % 15 === 0) return value;
                    if (activeTimeRange === "1y" && historicalData.indexOf(historicalData.find(d => d.formattedDate === value)!) % 30 === 0) return value;
                    return "";
                  }}
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
                  dataKey="portfolio" 
                  name="Portfolio" 
                  stroke={COLORS[0]} 
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 8 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="btc" 
                  name="BTC" 
                  stroke={COLORS[1]} 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="eth" 
                  name="ETH" 
                  stroke={COLORS[2]} 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="sol" 
                  name="SOL" 
                  stroke={COLORS[3]} 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}