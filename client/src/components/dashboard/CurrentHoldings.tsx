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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Asset, Allocation } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Plus, DollarSign, Wallet, ArrowUpDown } from "lucide-react";
import { usePortfolio } from "@/lib/portfolioContext";

// Define the schema for holdings form
const holdingsSchema = z.object({
  holdings: z.array(
    z.object({
      assetId: z.number(),
      amount: z.number().min(0),
    })
  ),
});

type HoldingsFormValues = z.infer<typeof holdingsSchema>;

export function CurrentHoldings() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { portfolioValue, isLoading: isLoadingPortfolio } = usePortfolio();

  // Fetch available assets
  const { data: assets = [], isLoading: isLoadingAssets } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });

  // Fetch user's current holdings (in a real app, would come from API)
  const { data: vaults = [], isLoading: isLoadingVaults } = useQuery({
    queryKey: ["/api/vaults"],
  });
  
  const { data: allocations = [], isLoading: isLoadingAllocations } = useQuery<Allocation[]>({
    queryKey: ["/api/vaults/1/allocations"],
    enabled: !!vaults && vaults.length > 0,
  });

  // Prepare initial form values based on current holdings
  const getInitialHoldings = () => {
    if (isLoadingAllocations || isLoadingAssets || !allocations.length) {
      return assets.slice(0, 3).map(asset => ({
        assetId: asset.id,
        amount: 0,
      }));
    }

    return allocations.map((allocation: Allocation) => {
      const asset = assets.find(a => a.id === allocation.assetId);
      // Calculate the actual amount based on percentage of portfolio value
      const amount = (allocation.percentage / 100) * (portfolioValue || 10000);
      
      return {
        assetId: allocation.assetId,
        amount: parseFloat(amount.toFixed(6)),
      };
    });
  };

  const form = useForm<HoldingsFormValues>({
    resolver: zodResolver(holdingsSchema),
    defaultValues: {
      holdings: [],
    },
  });

  // Update form values when data is loaded
  useEffect(() => {
    if (!isLoadingAllocations && !isLoadingAssets && allocations.length > 0) {
      form.reset({
        holdings: getInitialHoldings(),
      });
    }
  }, [isLoadingAllocations, isLoadingAssets, allocations.length, portfolioValue]);

  const onSubmit = async (data: HoldingsFormValues) => {
    setIsSubmitting(true);
    try {
      // In a real app, would save to API
      console.log("Saving updated holdings:", data);
      
      // Show success message
      toast({
        title: "Holdings Updated",
        description: "Your cryptocurrency holdings have been successfully updated.",
        variant: "default",
      });
    } catch (error) {
      console.error("Error saving holdings:", error);
      toast({
        title: "Update Failed",
        description: "There was an error updating your holdings. Please try again.",
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
            Adjust your cryptocurrency holdings
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
          View and adjust your current cryptocurrency amounts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              {form.watch("holdings")?.map((holding, index) => {
                const asset = assets.find(a => a.id === holding.assetId);

                return (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="flex-1 font-medium">
                      {asset?.symbol || "Unknown"} 
                      <span className="text-xs text-muted-foreground ml-1">({asset?.name})</span>
                    </div>
                    
                    <FormField
                      control={form.control}
                      name={`holdings.${index}.amount`}
                      render={({ field }) => (
                        <FormItem className="w-36">
                          <FormControl>
                            <div className="relative">
                              <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="number"
                                placeholder="0.00"
                                className="pl-8"
                                step="0.000001"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="w-20 text-xs font-medium text-right">
                      {asset?.symbol && asset.symbol === "BTC" && (
                        <span>{holding.amount > 0 ? (holding.amount / 65000).toFixed(8) : "0"} BTC</span>
                      )}
                      {asset?.symbol && asset.symbol === "ETH" && (
                        <span>{holding.amount > 0 ? (holding.amount / 3500).toFixed(6) : "0"} ETH</span>
                      )}
                      {asset?.symbol && !["BTC", "ETH"].includes(asset.symbol) && (
                        <span>{holding.amount > 0 ? holding.amount.toFixed(2) : "0"} USD</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="flex justify-between items-center pt-2 border-t">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  Current Value: ${portfolioValue.toFixed(2)}
                </span>
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : "Update Holdings"}
            </Button>
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