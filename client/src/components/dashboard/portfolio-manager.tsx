import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Asset } from "@shared/schema";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Trash2, PlusCircle, DollarSign, PercentIcon, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Define the form schema
const portfolioSchema = z.object({
  allocations: z.array(
    z.object({
      assetId: z.number(),
      percentage: z.number().min(0).max(100),
      amount: z.number().optional(),
    })
  ).refine(data => {
    // Only validate total percentage when submitting - we'll redistribute during editing
    const total = data.reduce((sum, allocation) => sum + allocation.percentage, 0);
    return total === 100;
  }, {
    message: "Total allocation must equal exactly 100%",
    path: ["allocations"],
  }),
});

type PortfolioFormValues = z.infer<typeof portfolioSchema>;

// Define colors for pie chart
const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A374DB',
  '#FF6B6B', '#4ECDC4', '#35A7FF', '#FFC857', '#7B68EE',
  '#FF7F50', '#6A0572', '#AB83A1'
];

// Mock prices for cryptocurrencies
const MOCK_PRICES: Record<string, number> = {
  BTC: 60000,
  ETH: 2500,
  ADA: 0.50,
  BNB: 350,
  USDT: 1,
  USDC: 1,
  L1X: 0.50,
  DOGE: 0.12,
  XRP: 0.55,
  SOL: 110,
  TRX: 0.08,
  SUI: 1.25,
  LINK: 15
};

// Mock portfolio performance data
const MOCK_PERFORMANCE = {
  totalValue: 0, // Will be calculated dynamically
  oneDayChange: 2.3,
  sevenDayChange: 5.7,
  thirtyDayChange: -1.2
};

interface PortfolioManagerProps {
  vaultId?: number;
  initialAllocations?: any[];
  onSave?: () => void;
}

export default function PortfolioManager({ 
  vaultId, 
  initialAllocations = [],
  onSave
}: PortfolioManagerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Fetch available assets
  const { data: assets = [], isLoading: isLoadingAssets } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });

  // Initialize form with default values or initial allocations
  const form = useForm<PortfolioFormValues>({
    resolver: zodResolver(portfolioSchema),
    defaultValues: {
      allocations: initialAllocations.length > 0 
        ? initialAllocations 
        : [
            { assetId: 1, percentage: 33 }, // BTC - 33%
            { assetId: 2, percentage: 33 }, // ETH - 33%
            { assetId: 3, percentage: 34 }, // L1X or other asset - 34%
          ]
    },
  });

  // Use useFieldArray hook instead of directly accessing fields
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "allocations"
  });
  const watchedAllocations = form.watch("allocations");
  
  // Calculate total percentage
  const totalPercentage = watchedAllocations?.reduce(
    (sum, allocation) => sum + (allocation.percentage || 0),
    0
  ) || 0;

  // Calculate remaining percentage
  const remainingPercentage = 100 - totalPercentage;

  // Calculate total portfolio value
  const calculateTotalValue = () => {
    return watchedAllocations?.reduce((total, allocation) => {
      const asset = assets.find(a => a.id === allocation.assetId);
      if (!asset) return total;
      
      const price = MOCK_PRICES[asset.symbol] || 1;
      const amount = (allocation.percentage / 100) * 10000; // Assuming $10,000 portfolio for demo
      
      return total + (amount);
    }, 0) || 0;
  };

  // Format the data for pie chart
  const getPieChartData = () => {
    return watchedAllocations?.map(allocation => {
      const asset = assets.find(a => a.id === allocation.assetId);
      return {
        name: asset?.symbol || "Unknown",
        value: allocation.percentage || 0
      };
    }) || [];
  };

  // Redistribute percentages to make room for a new allocation
  const redistributePercentages = (newAssetPercentage = 10) => {
    // If there's enough remaining percentage, no need to redistribute
    if (remainingPercentage >= newAssetPercentage) return;
    
    // Calculate how much we need to reduce from existing allocations
    const percentageToReduce = newAssetPercentage - remainingPercentage;
    
    // Get all current allocations
    const currentAllocations = [...watchedAllocations];
    
    // Calculate total current allocation (should be close to 100%)
    const totalBeforeReduction = currentAllocations.reduce(
      (sum, allocation) => sum + allocation.percentage, 0
    );
    
    // Reduce each allocation proportionally
    let reducedSoFar = 0;
    const updatedAllocations = currentAllocations.map((allocation, index) => {
      // Calculate the fair reduction based on the proportion this allocation represents
      const proportionalReduction = 
        Math.floor((allocation.percentage / totalBeforeReduction) * percentageToReduce);
      
      // Ensure we don't reduce below 5% minimum
      const actualReduction = Math.min(
        proportionalReduction, 
        allocation.percentage - 5 > 0 ? allocation.percentage - 5 : 0
      );
      
      reducedSoFar += actualReduction;
      
      return {
        ...allocation,
        percentage: allocation.percentage - actualReduction
      };
    });
    
    // If we couldn't reduce enough, take more from the largest allocations
    if (reducedSoFar < percentageToReduce) {
      const remaining = percentageToReduce - reducedSoFar;
      
      // Sort by percentage (highest first) and reduce from largest allocations
      updatedAllocations.sort((a, b) => b.percentage - a.percentage);
      
      let stillNeeded = remaining;
      for (let i = 0; i < updatedAllocations.length && stillNeeded > 0; i++) {
        if (updatedAllocations[i].percentage > 5) {
          const canReduce = Math.min(stillNeeded, updatedAllocations[i].percentage - 5);
          updatedAllocations[i].percentage -= canReduce;
          stillNeeded -= canReduce;
        }
      }
      
      // Resort back by index if needed (this preserves original order)
      // This step is optional as fieldArray will use the keys to maintain order
    }
    
    // Update the form with new values
    for (let i = 0; i < updatedAllocations.length; i++) {
      form.setValue(`allocations.${i}.percentage`, updatedAllocations[i].percentage);
    }
  };

  // Handle adding a new allocation
  const handleAddAllocation = () => {
    // Find unused assets
    const usedAssetIds = new Set(watchedAllocations?.map(a => a.assetId));
    const unusedAssets = assets.filter(asset => !usedAssetIds.has(asset.id));
    
    if (unusedAssets.length === 0) {
      setError("All available assets have been allocated");
      return;
    }
    
    // Default new asset allocation percentage
    const newAssetPercentage = 10;
    
    // If we're at or near 100%, redistribute to make room for the new asset
    if (remainingPercentage < newAssetPercentage) {
      redistributePercentages(newAssetPercentage);
      
      // Show toast notification about redistribution
      toast({
        title: "Allocations Adjusted",
        description: "Existing allocations were automatically adjusted to make room for the new asset.",
        variant: "default"
      });
    }
    
    // Find the asset we're adding for the toast
    const newAsset = assets.find(a => a.id === unusedAssets[0].id);
    
    // Add a new allocation with an unused asset
    append({ 
      assetId: unusedAssets[0].id, 
      percentage: newAssetPercentage
    });
    
    // Show toast for the added asset
    toast({
      title: "Asset Added",
      description: `Added ${newAsset?.symbol || 'new asset'} with ${newAssetPercentage}% allocation`,
      variant: "default"
    });
  };

  // Handle form submission
  const onSubmit = async (data: PortfolioFormValues) => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      // In a real application, we would save this data to the backend
      console.log("Saving portfolio allocation:", data);
      
      // Here you would use apiRequest to save the allocations to the backend
      if (vaultId) {
        // Save allocations to an existing vault
        // For each allocation in data.allocations, create/update via API
      } else {
        // Create a new vault with these allocations
      }
      
      if (onSave) {
        onSave();
      }
    } catch (err: any) {
      console.error("Error saving portfolio:", err);
      setError(err.message || "Failed to save portfolio allocation");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Available percentage options (0% to 100% in 5% increments)
  const percentageOptions = Array.from({ length: 21 }, (_, i) => i * 5);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Portfolio Form */}
        <Card>
          <CardHeader>
            <CardTitle>Cryptocurrency Allocations</CardTitle>
            <CardDescription>
              Allocate percentages to your desired cryptocurrencies
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-4">
                  {watchedAllocations?.map((allocation, index) => {
                    const asset = assets.find(a => a.id === allocation.assetId);
                    const price = MOCK_PRICES[asset?.symbol || ""] || 0;
                    const amount = ((allocation.percentage || 0) / 100) * 10000; // Assuming $10,000 portfolio
                    
                    return (
                      <div key={index} className="flex items-center space-x-3">
                        <FormField
                          control={form.control}
                          name={`allocations.${index}.assetId`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <Select
                                value={field.value?.toString() || "1"}
                                onValueChange={(value) => field.onChange(parseInt(value))}
                                disabled={isLoadingAssets}
                              >
                                <SelectTrigger>
                                  <SelectValue>
                                    {isLoadingAssets ? "Loading..." : 
                                     assets.find(a => a.id === field.value)?.symbol || "Select"}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {assets.map((asset) => (
                                    <SelectItem 
                                      key={asset.id} 
                                      value={asset.id.toString()}
                                    >
                                      {asset.symbol} - {asset.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name={`allocations.${index}.percentage`}
                          render={({ field }) => (
                            <FormItem className="w-28">
                              <Select
                                value={field.value?.toString() || "0"}
                                onValueChange={(value) => field.onChange(parseInt(value))}
                              >
                                <SelectTrigger>
                                  <SelectValue>
                                    {field.value ? `${field.value}%` : "0%"}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {percentageOptions.map((percent) => (
                                    <SelectItem 
                                      key={percent} 
                                      value={percent.toString()}
                                      disabled={percent > remainingPercentage + (allocation.percentage || 0)}
                                    >
                                      {percent}%
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <div className="flex items-center space-x-2 min-w-[120px]">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span>{amount.toFixed(2)}</span>
                        </div>
                        
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon"
                          onClick={() => remove(index)}
                          disabled={watchedAllocations.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
                
                <div className="flex justify-between items-center pt-2 border-t">
                  <div className="flex items-center space-x-2">
                    <PercentIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      Total: {totalPercentage}% 
                      {remainingPercentage > 0 
                        ? ` (${remainingPercentage}% remaining)` 
                        : " (adding will redistribute allocations)"}
                    </span>
                  </div>
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddAllocation}
                    disabled={isLoadingAssets}
                  >
                    <PlusCircle className="h-4 w-4 mr-1" />
                    Add Asset
                  </Button>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isSubmitting || totalPercentage !== 100}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : "Save Allocation"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        
        {/* Pie Chart and Performance */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Visualization</CardTitle>
              <CardDescription>
                Visual representation of your asset allocation
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={getPieChartData()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={90}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {getPieChartData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => [`${value}%`, 'Allocation']} 
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Allocation Preview</CardTitle>
              <CardDescription>
                Projected portfolio value based on your current allocation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-sm">Projected Portfolio Value</span>
                  <span className="font-medium text-lg">
                    ${calculateTotalValue().toFixed(2)}
                  </span>
                </div>
                
                <div className="text-xs text-muted-foreground mt-2">
                  Note: This is a preview based on your current allocation settings.
                  <br />
                  For detailed performance metrics, use the <strong>Portfolio</strong> tab with live data.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}