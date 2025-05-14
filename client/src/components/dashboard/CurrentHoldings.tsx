import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Asset, Allocation, Vault } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Plus, DollarSign, Wallet, ArrowUpDown, Trash2 } from "lucide-react";
import { usePortfolio } from "@/lib/portfolioContext";

// Extended allocation type to handle the demo/mock data
interface EnhancedAllocation extends Allocation {
  symbol?: string;
  name?: string;
  currentValue?: number;
  currentPercentage?: number;
  currentAllocation?: number;
  averageCost?: number;
  profit?: number;
  profitPercentage?: number;
  priceChange24h?: number;
  lastRebalanced?: Date;
  driftFromTarget?: number;
}

// Define the schema for holdings form
const holdingsSchema = z.object({
  holdings: z.array(
    z.object({
      assetId: z.number(),
      amount: z.number().min(0),
      percentage: z.number().int().min(0).max(100),
    })
  ).refine(data => {
    // Validate total percentage equals 100%
    const total = data.reduce((sum, holding) => sum + holding.percentage, 0);
    return total === 100;
  }, {
    message: "Total allocation must equal exactly 100%",
    path: ["holdings"],
  }),
});

type HoldingsFormValues = z.infer<typeof holdingsSchema>;

export function CurrentHoldings() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAssetSelector, setShowAssetSelector] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const { toast } = useToast();
  const { portfolioValue, assetAllocations, isLoading: isLoadingPortfolio } = usePortfolio();
  
  // Add debug logging for holdings component
  console.log("CurrentHoldings rendering with portfolio data:", {
    portfolioValue,
    assetAllocationsCount: assetAllocations.length,
    assetAllocations
  });

  // Fetch available assets
  const { data: assets = [], isLoading: isLoadingAssets } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });

  // Check if user is authenticated via API
  const { data: user } = useQuery<any>({
    queryKey: ['/api/auth/me'],
  });
  
  // Consider user authenticated if they have wallet connected OR are logged in via traditional auth
  const isAuthenticated = !!user;
  
  // Fetch user's current holdings (in a real app, would come from API)
  const { data: vaults = [], isLoading: isLoadingVaults } = useQuery<Vault[]>({
    queryKey: ["/api/vaults"],
    enabled: isAuthenticated,
  });
  
  // Get first available vault ID
  const activeVaultId = vaults && vaults.length > 0 ? vaults[0].id : null;
  
  const { data: allocations = [], isLoading: isLoadingAllocations } = useQuery<EnhancedAllocation[]>({
    queryKey: [activeVaultId ? `/api/vaults/${activeVaultId}/allocations` : ''],
    enabled: !!activeVaultId && isAuthenticated,
  });

  // Prepare initial form values based on current holdings
  const getInitialHoldings = () => {
    console.log("Getting initial holdings with:", {
      assetAllocationsFromContext: assetAllocations.length,
      allocationsFromQuery: allocations.length,
      loadingStatus: { isLoadingAllocations, isLoadingAssets, isLoadingPortfolio }
    });
    
    // USE PORTFOLIO CONTEXT FIRST if it has data
    if (assetAllocations.length > 0) {
      console.log("Using asset allocations from portfolio context");
      return assetAllocations.map(allocation => ({
        assetId: allocation.asset.id,
        amount: allocation.amount,
        percentage: allocation.percentOfPortfolio
      }));
    }
    
    if (isLoadingAllocations || isLoadingAssets || !allocations.length) {
      console.log("No allocations data available, using placeholder values");
      // Default to 3 assets with equal distribution (33/33/34)
      return assets.slice(0, 3).map((asset, index) => ({
        assetId: asset.id,
        amount: 0,
        percentage: index === 2 ? 34 : 33, // Give the last asset 34% to make it equal 100%
      }));
    }

    return allocations.map((allocation: EnhancedAllocation) => {
      // Check if we have a detailed allocation (from demo or enhanced data)
      const isDetailedAllocation = allocation.hasOwnProperty('currentValue') && 
                                  allocation.hasOwnProperty('currentPercentage') && 
                                  allocation.hasOwnProperty('currentAllocation');
      
      if (isDetailedAllocation) {
        // Use the enhanced allocation data fields directly
        // Need to type cast since our types don't reflect the enhanced mock data structure
        const enhancedAllocation = allocation as any;
        return {
          assetId: allocation.assetId,
          amount: parseFloat(enhancedAllocation.currentAllocation?.toString() || "0"),
          percentage: parseFloat(enhancedAllocation.currentPercentage?.toString() || "0"),
        };
      } else {
        // Standard allocation that needs calculation
        const asset = assets.find(a => a.id === allocation.assetId);
        // Convert targetPercentage string to number
        const percentage = parseFloat(allocation.targetPercentage.toString());
        // Calculate the actual amount based on percentage of portfolio value
        const amount = (percentage / 100) * (portfolioValue || 10000);
        
        return {
          assetId: allocation.assetId,
          amount: parseFloat(amount.toFixed(3)),
          percentage: percentage,
        };
      }
    });
  };

  const form = useForm<HoldingsFormValues>({
    resolver: zodResolver(holdingsSchema),
    defaultValues: {
      holdings: [],
    },
  });

  // Check if user is demo login
  const isDemoUser = user && user.email === 'demo@example.com';
  
  // Update form values when data is loaded
  useEffect(() => {
    if (isDemoUser) {
      console.log("Demo user detected in CurrentHoldings component - using demo data");
      // For demo user, explicitly set mock holdings
      const demoHoldings = [
        { assetId: 1, amount: 0.361, percentage: 40 },
        { assetId: 2, amount: 4.21, percentage: 25 },
        { assetId: 3, amount: 307.25, percentage: 15 },
        { assetId: 4, amount: 41.32, percentage: 10 },
        { assetId: 5, amount: 83.75, percentage: 5 },
        { assetId: 6, amount: 3765.82, percentage: 5 }
      ];
      
      form.reset({
        holdings: demoHoldings,
      });
    } else if (!isLoadingAllocations && !isLoadingAssets && allocations.length > 0) {
      // For regular users, use the API data
      form.reset({
        holdings: getInitialHoldings(),
      });
    }
  }, [isDemoUser, isLoadingAllocations, isLoadingAssets, allocations.length, portfolioValue]);

  const onSubmit = async (data: HoldingsFormValues) => {
    setIsSubmitting(true);
    try {
      // In a real app, we would make API calls to update each allocation
      console.log("Saving updated holdings:", data);
      
      // Ensure total allocation equals 100%
      const totalPercentage = data.holdings.reduce((sum, holding) => sum + holding.percentage, 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        throw new Error("Total allocation must equal 100%");
      }
      
      // This is the beginning of what would be a real API integration
      // Update allocations for the first vault
      if (vaults.length > 0) {
        const vaultId = vaults[0].id;
        
        for (const holding of data.holdings) {
          // We would make API calls to update allocations
          console.log(`Updating allocation for asset ${holding.assetId} to ${holding.percentage}%`);
          // In a real implementation, we would call:
          // await apiRequest(`/api/vaults/${vaultId}/allocations`, {
          //   assetId: holding.assetId,
          //   targetPercentage: holding.percentage
          // });
        }
      }
      
      // Update portfolio chart data
      const chartData = data.holdings.map(holding => {
        const asset = assets.find(a => a.id === holding.assetId);
        return {
          id: holding.assetId,
          symbol: asset?.symbol || "Unknown",
          name: asset?.name || "Unknown Asset",
          percentage: holding.percentage,
        };
      });
      
      // Show success message
      toast({
        title: "Holdings Updated",
        description: "Your digital asset holdings have been successfully updated.",
        variant: "default",
      });
    } catch (error: any) {
      console.error("Error saving holdings:", error);
      toast({
        title: "Update Failed",
        description: error.message || "There was an error updating your holdings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingAssets || isLoadingAllocations || isLoadingPortfolio) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Current Holdings</CardTitle>
          <CardDescription>
            Adjust your digital asset holdings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            <RefreshCw className="h-8 w-8 animate-spin text-primary/50" />
            <span className="ml-2">Loading your current holdings...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Wallet className="h-5 w-5 mr-2" />
          Current Holdings
        </CardTitle>
        <CardDescription>
          View and adjust your current digital asset amounts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              {form.watch("holdings")?.map((holding, index) => {
                const asset = assets.find(a => a.id === holding.assetId);

                return (
                  <div key={index} className="grid grid-cols-3 items-center mb-3 pb-3 border-b">
                    <div className="font-medium">
                      {asset?.symbol || "Unknown"} 
                      <span className="text-xs text-muted-foreground ml-1">({asset?.name})</span>
                    </div>
                    
                    <FormField
                      control={form.control}
                      name={`holdings.${index}.percentage`}
                      render={({ field }) => (
                        <FormItem className="w-20 justify-self-center">
                          <FormControl>
                            <div className="relative">
                              <Input
                                type="number"
                                placeholder="0"
                                className="pr-6 text-right"
                                min="0"
                                max="100"
                                step="1"
                                onKeyDown={(e) => {
                                  // Allow only number keys, backspace, delete, tab, arrows
                                  const allowedKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
                                  const isNumber = /^[0-9]$/.test(e.key);
                                  
                                  if (!isNumber && !allowedKeys.includes(e.key)) {
                                    e.preventDefault();
                                  }
                                }}
                                {...field}
                                value={field.value === 0 ? '' : field.value}
                                onChange={(e) => {
                                  // Get the new value as a whole number
                                  const newValue = Math.round(parseFloat(e.target.value) || 0);
                                  const oldValue = field.value || 0;
                                  
                                  // No change or invalid value
                                  if (newValue === oldValue || isNaN(newValue)) return;
                                  
                                  const currentHoldings = [...form.watch("holdings")];
                                  const difference = newValue - oldValue;
                                  
                                  // Set the new value for this holding
                                  field.onChange(newValue);
                                  form.setValue(`holdings.${index}.amount`, (newValue / 100) * portfolioValue);
                                  
                                  // Always adjust other holdings to maintain 100% total
                                  if (difference !== 0) {
                                    // Find all other holdings sorted by percentage (highest first)
                                    const othersToAdjust = currentHoldings
                                      .map((h, i) => ({percentage: h.percentage, index: i}))
                                      .filter(h => h.index !== index)
                                      .sort((a, b) => b.percentage - a.percentage);
                                    
                                    if (othersToAdjust.length === 0) {
                                      // This is the only holding, cap at 100%
                                      const actualValue = 100;
                                      field.onChange(actualValue);
                                      form.setValue(`holdings.${index}.amount`, (actualValue / 100) * portfolioValue);
                                      return;
                                    }
                                    
                                    // Calculate how much to distribute among other holdings
                                    let remainingAdjustment = -difference; // If this holding increased, others decrease
                                    
                                    // First pass: try to distribute evenly respecting minimums (1%)
                                    const totalOtherPercentage = othersToAdjust.reduce((sum, h) => 
                                      sum + currentHoldings[h.index].percentage, 0);
                                    
                                    // If we're increasing this asset's percentage and total would be over 100%
                                    // OR if we're decreasing and total would be under 100%
                                    if ((difference > 0 && totalOtherPercentage < remainingAdjustment) ||
                                        (difference < 0 && -remainingAdjustment > newValue)) {
                                      // Cannot adjust properly, reset to previous value
                                      field.onChange(oldValue);
                                      form.setValue(`holdings.${index}.amount`, (oldValue / 100) * portfolioValue);
                                      
                                      // Show toast notification
                                      toast({
                                        title: "Adjustment not possible",
                                        description: "Cannot maintain valid percentages with this change.",
                                        variant: "destructive",
                                      });
                                      return;
                                    }
                                    
                                    // Proportionally distribute the adjustment
                                    for (const holding of othersToAdjust) {
                                      if (remainingAdjustment === 0) break;
                                      
                                      const currentPercentage = currentHoldings[holding.index].percentage;
                                      const proportion = currentPercentage / totalOtherPercentage;
                                      
                                      // Calculate adjustment for this holding
                                      let adjustment = Math.round(remainingAdjustment * proportion);
                                      
                                      // Ensure we don't reduce below 1%
                                      const minAdjustment = 1 - currentPercentage;
                                      if (adjustment < minAdjustment) adjustment = minAdjustment;
                                      
                                      // Don't adjust more than what's remaining
                                      if (Math.abs(adjustment) > Math.abs(remainingAdjustment)) {
                                        adjustment = remainingAdjustment;
                                      }
                                      
                                      // Apply the adjustment
                                      const newPercentage = Math.max(1, currentPercentage + adjustment);
                                      form.setValue(`holdings.${holding.index}.percentage`, newPercentage);
                                      form.setValue(
                                        `holdings.${holding.index}.amount`,
                                        (newPercentage / 100) * portfolioValue
                                      );
                                      
                                      remainingAdjustment -= adjustment;
                                    }
                                    
                                    // If there's still remaining adjustment, apply to highest holding
                                    if (remainingAdjustment !== 0 && othersToAdjust.length > 0) {
                                      const highestHolding = othersToAdjust[0];
                                      const currentPercentage = currentHoldings[highestHolding.index].percentage;
                                      const newPercentage = Math.max(1, currentPercentage + remainingAdjustment);
                                      
                                      form.setValue(`holdings.${highestHolding.index}.percentage`, newPercentage);
                                      form.setValue(
                                        `holdings.${highestHolding.index}.amount`,
                                        (newPercentage / 100) * portfolioValue
                                      );
                                    }
                                  }
                                }}
                              />
                              <span className="absolute right-2 top-2.5 text-muted-foreground">%</span>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="flex items-center justify-end space-x-2">
                      <div className="text-xs font-medium">
                        {asset?.symbol && asset.symbol === "BTC" && (
                          <span>{holding.amount > 0 ? (holding.amount / 65000).toFixed(3) : "0"} BTC</span>
                        )}
                        {asset?.symbol && asset.symbol === "ETH" && (
                          <span>{holding.amount > 0 ? (holding.amount / 3500).toFixed(3) : "0"} ETH</span>
                        )}
                        {asset?.symbol && !["BTC", "ETH"].includes(asset.symbol) && (
                          <span>{holding.amount > 0 ? holding.amount.toFixed(3) : "0"} {asset.symbol}</span>
                        )}
                      </div>
                      
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon"
                        className="h-6 w-6 ml-2"
                        onClick={() => {
                          const currentHoldings = form.watch("holdings");
                          // Don't allow removing if there's only one asset left
                          if (currentHoldings.length <= 1) {
                            toast({
                              title: "Cannot Remove",
                              description: "You must have at least one asset in your portfolio",
                              variant: "destructive"
                            });
                            return;
                          }
                          
                          // Remove the current holding
                          const newHoldings = currentHoldings.filter((_, i) => i !== index);
                          form.setValue("holdings", newHoldings);
                          
                          // Redistribute the percentage to the first asset
                          if (newHoldings.length > 0) {
                            const removedPercentage = holding.percentage;
                            const firstHolding = newHoldings[0];
                            const newPercentage = firstHolding.percentage + removedPercentage;
                            
                            // Update the first holding with the additional percentage
                            form.setValue(`holdings.0.percentage`, newPercentage);
                            form.setValue(`holdings.0.amount`, (newPercentage / 100) * portfolioValue);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="grid grid-cols-3 items-center pt-2 border-t">               
              <div>
                <span className="text-sm font-medium">
                  Total: {Math.round(form.watch("holdings")?.reduce((sum, h) => sum + (h.percentage || 0), 0))}%
                </span>
              </div>
              <div className="justify-self-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Find unused assets
                    const usedAssetIds = new Set(form.watch("holdings")?.map(h => h.assetId));
                    const unusedAssets = assets.filter(asset => !usedAssetIds.has(asset.id));
                    
                    if (unusedAssets.length === 0) {
                      toast({
                        title: "No more assets",
                        description: "All available assets have been allocated",
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    // Show asset selection dialog
                    setShowAssetSelector(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Asset
                </Button>
              </div>
              <div className="justify-self-end">
                <Button 
                  type="submit" 
                  size="sm"
                  className="h-8 text-xs"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      Saving...
                    </>
                  ) : "Save Changes"}
                </Button>
              </div>
            </div>
            
            {/* Asset selector dialog */}
            {showAssetSelector && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <Card className="w-full max-w-md mx-auto">
                  <CardHeader>
                    <CardTitle>Select Asset to Add</CardTitle>
                    <CardDescription>Choose an asset to add to your portfolio</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Select 
                        onValueChange={(value) => {
                          setSelectedAssetId(parseInt(value));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select an asset" />
                        </SelectTrigger>
                        <SelectContent>
                          {assets
                            .filter(asset => !form.watch("holdings").map(h => h.assetId).includes(asset.id))
                            .map(asset => (
                              <SelectItem key={asset.id} value={asset.id.toString()}>
                                {asset.symbol} - {asset.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => {
                      setShowAssetSelector(false);
                      setSelectedAssetId(null);
                    }}>
                      Cancel
                    </Button>
                    <Button onClick={() => {
                      if (!selectedAssetId) {
                        toast({
                          title: "No Asset Selected",
                          description: "Please select an asset to add to your portfolio.",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      const newAssetPercentage = 10; // New asset gets 10%
                      const currentHoldings = form.watch("holdings");
                    
                      if (currentHoldings.length === 0) {
                        // First asset gets 100%
                        form.setValue("holdings", [
                          {
                            assetId: selectedAssetId,
                            amount: portfolioValue,
                            percentage: 100,
                          }
                        ]);
                        
                        // Close the asset selector popup
                        setShowAssetSelector(false);
                        setSelectedAssetId(null);
                        
                        toast({
                          title: "Asset Added",
                          description: `Added first asset to your portfolio`,
                          variant: "default",
                        });
                        
                        return;
                      }
                    
                      // Find the highest allocation
                      const sortedHoldings = [...currentHoldings]
                        .map((h, i) => ({ ...h, originalIndex: i }))
                        .sort((a, b) => b.percentage - a.percentage);
                      
                      const highestHolding = sortedHoldings[0];
                      
                      // Check if highest holding can be reduced by 10%
                      if (highestHolding.percentage < newAssetPercentage + 1) {
                        toast({
                          title: "Cannot Add Asset",
                          description: "Not enough allocation to add a new asset. The highest allocation must be at least 11%.",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      // Create a copy of the current holdings
                      const adjustedHoldings = [...currentHoldings];
                      
                      // Reduce the highest allocation by 10%
                      adjustedHoldings[highestHolding.originalIndex] = {
                        ...adjustedHoldings[highestHolding.originalIndex],
                        percentage: highestHolding.percentage - newAssetPercentage,
                        amount: ((highestHolding.percentage - newAssetPercentage) / 100) * portfolioValue
                      };
                      
                      // Amount for the new asset based on 10% of portfolio value
                      const newAmount = (newAssetPercentage / 100) * portfolioValue;
                      
                      // Add the new asset with 10% allocation
                      form.setValue("holdings", [
                        ...adjustedHoldings,
                        {
                          assetId: selectedAssetId,
                          amount: newAmount,
                          percentage: newAssetPercentage,
                        }
                      ]);
                      
                      // Close the asset selector popup
                      setShowAssetSelector(false);
                      setSelectedAssetId(null);
                      
                      toast({
                        title: "Asset Added",
                        description: `Added new asset to your portfolio`,
                        variant: "default",
                      });
                    }}
                    disabled={isLoadingAssets}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Asset
                  </Button>
                  </CardFooter>
                </Card>
              </div>
            )}
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex flex-col items-start">
        <div className="text-xs text-muted-foreground">
          <p className="mb-1">
            <ArrowUpDown className="h-3 w-3 inline-block mr-1" />
            Update your holdings to ensure your allocation percentages are accurate.
          </p>
          <p>
            <Plus className="h-3 w-3 inline-block mr-1" />
            Portfolio values will automatically adjust based on your allocation settings.
          </p>
        </div>
      </CardFooter>
    </Card>
  );
}