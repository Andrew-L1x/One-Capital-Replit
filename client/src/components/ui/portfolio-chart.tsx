import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  TooltipProps,
} from "recharts";
import {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export type AssetAllocation = {
  id: number;
  name: string;
  symbol: string;
  percentage: number;
  value?: number;
  color?: string;
};

interface PortfolioChartProps {
  allocations: AssetAllocation[];
  title?: string;
  description?: string;
  isLoading?: boolean;
  totalValue?: number;
}

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const CustomTooltip = ({
  active,
  payload,
}: TooltipProps<ValueType, NameType>) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as AssetAllocation;
    return (
      <div className="bg-popover p-2 rounded-md shadow-md border border-border">
        <p className="font-medium">{data.name} ({data.symbol})</p>
        <p className="text-sm text-muted-foreground">
          {data.percentage.toFixed(2)}%
        </p>
        {data.value !== undefined && (
          <p className="text-sm font-medium">${data.value.toFixed(2)}</p>
        )}
      </div>
    );
  }

  return null;
};

export default function PortfolioChart({
  allocations,
  title = "Portfolio Allocation",
  description = "Current asset allocation in your portfolio",
  isLoading = false,
  totalValue,
}: PortfolioChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-48" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-64" />
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Skeleton className="h-64 w-64 rounded-full" />
        </CardContent>
      </Card>
    );
  }

  // Assign colors to allocations if not already assigned
  const chartData = allocations.map((allocation, index) => ({
    ...allocation,
    color: allocation.color || CHART_COLORS[index % CHART_COLORS.length],
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        {totalValue !== undefined && (
          <p className="text-xl font-bold mt-2">
            ${totalValue.toFixed(2)}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="percentage"
                nameKey="symbol"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ symbol, percentage }) => `${symbol} ${percentage.toFixed(1)}%`}
                labelLine={false}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-muted-foreground mb-2">No allocations defined</p>
            <p className="text-sm text-muted-foreground">
              Add assets to your portfolio to see the allocation chart
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
