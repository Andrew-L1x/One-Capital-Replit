import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Asset } from "@shared/schema";
import { CurrentHoldings } from "@/components/dashboard/CurrentHoldings";
import { HistoricalPerformance } from "@/components/dashboard/HistoricalPerformance";
import { PortfolioChart } from "@/components/dashboard/PortfolioChart";
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

import { Trash2, PlusCircle, DollarSign, PercentIcon, RefreshCw, ArrowRightLeft } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
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

// Portfolio Manager component
// This component manages the portfolio allocation logic and UI

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
    // Using a flat amount since we don't have real values yet
    return watchedAllocations?.reduce((total, allocation) => {
      const asset = assets.find(a => a.id === allocation.assetId);
      if (!asset) return total;
      
      // Just use the percentage of a standard portfolio size
      const amount = (allocation.percentage / 100) * 10000; // Assuming $10,000 portfolio for demo
      
      return total + amount;
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
      // Get the first vault (for demo purposes, we'll use the first vault)
      const vaults = await apiRequest("/api/vaults");
      
      if (vaults.length === 0) {
        throw new Error("No vaults found. Please create a vault first.");
      }
      
      const targetVaultId = vaultId || vaults[0].id;
      
      // Clear existing allocations for this vault
      const existingAllocations = await apiRequest(`/api/vaults/${targetVaultId}/allocations`);
      
      // Delete existing allocations
      for (const allocation of existingAllocations) {
        await apiRequest(`/api/allocations/${allocation.id}`, { method: "DELETE" });
      }
      
      // Create new allocations
      for (const allocation of data.allocations) {
        await apiRequest(`/api/vaults/${targetVaultId}/allocations`, { 
          method: "POST",
          data: {
            assetId: allocation.assetId,
            targetPercentage: allocation.percentage.toString(),
          }
        });
      }
      
      // Invalidate cache for allocations
      queryClient.invalidateQueries({
        queryKey: [`/api/vaults/${targetVaultId}/allocations`]
      });
      
      // Invalidate the portfolio data as well to update all components
      queryClient.invalidateQueries({
        queryKey: ["/api/vaults"]
      });
      
      // Show success message
      toast({
        title: "Allocations Saved",
        description: "Your portfolio allocations have been updated successfully.",
        variant: "default"
      });
      
      if (onSave) {
        onSave();
      }
    } catch (err: any) {
      console.error("Error saving portfolio:", err);
      setError(err.message || "Failed to save portfolio allocation");
      
      toast({
        title: "Error Saving Allocations",
        description: err.message || "There was a problem saving your allocations. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Available percentage options (0% to 100% in 5% increments)
  const percentageOptions = Array.from({ length: 21 }, (_, i) => i * 5);

  return (
    <div className="space-y-8">
      {/* Current Holdings Section */}
      <div className="w-full">
        <CurrentHoldings />
      </div>
      
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        {/* Portfolio Chart with Real Data */}
        <PortfolioChart />
        
        {/* Historical Performance */}
        <HistoricalPerformance />
      </div>
      
      {/* Display allocation form for more advanced users */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Allocation Settings</CardTitle>
          <CardDescription>Adjust your target allocations for each asset</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Show error message if allocation doesn't equal 100% */}
              {totalPercentage !== 100 && (
                <Alert className={totalPercentage > 100 ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"}>
                  <AlertDescription>
                    Total allocation: <strong>{totalPercentage}%</strong> 
                    {totalPercentage > 100 ? " (over-allocated)" : " (under-allocated)"}
                  </AlertDescription>
                </Alert>
              )}
              
              {/* List of allocations */}
              <div className="space-y-4">
                <div className="grid grid-cols-8 gap-2 text-sm font-medium text-muted-foreground pb-2 border-b">
                  <div className="col-span-3">Asset</div>
                  <div className="col-span-3">Target %</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>
                
                {fields.map((field, index) => {
                  const assetId = form.watch(`allocations.${index}.assetId`);
                  const asset = assets.find(a => a.id === assetId);
                  
                  return (
                    <div key={field.id} className="grid grid-cols-8 gap-2 items-center">
                      <div className="col-span-3">
                        <FormField
                          control={form.control}
                          name={`allocations.${index}.assetId`}
                          render={({ field }) => (
                            <FormItem>
                              <Select
                                value={field.value.toString()}
                                onValueChange={(val) => field.onChange(parseInt(val))}
                              >
                                <SelectTrigger>
                                  <SelectValue>{asset?.symbol || "Select asset"}</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {assets.map((asset) => (
                                    <SelectItem key={asset.id} value={asset.id.toString()}>
                                      {asset.symbol} - {asset.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="col-span-3">
                        <FormField
                          control={form.control}
                          name={`allocations.${index}.percentage`}
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center space-x-2">
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="1"
                                    max="100"
                                    {...field}
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  />
                                </FormControl>
                                <PercentIcon className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="col-span-2 flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => remove(index)}
                          disabled={fields.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Button to add new allocation */}
              <Button
                type="button"
                variant="outline"
                onClick={handleAddAllocation}
                disabled={assets.length === fields.length}
                className="w-full"
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Asset
              </Button>
              
              {/* Error message */}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              {/* Submit button */}
              <Button
                type="submit"
                disabled={isSubmitting || !form.formState.isDirty || totalPercentage !== 100}
                className="w-full"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Save Allocations
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}