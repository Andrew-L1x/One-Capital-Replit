import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ArrowDown, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePrices, formatPrice } from "@/lib/priceService";

// Define form schema with zod
const swapFormSchema = z.object({
  fromAsset: z.string({
    required_error: "Please select an asset to swap from",
  }),
  toAsset: z.string({
    required_error: "Please select an asset to swap to",
  }),
  amount: z.string().refine(
    (val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    },
    {
      message: "Amount must be a positive number",
    }
  ),
  targetChain: z.string({
    required_error: "Please select a target blockchain",
  }),
});

type SwapFormValues = z.infer<typeof swapFormSchema>;

// Chain information
interface Chain {
  id: string;
  name: string;
  logo: string;
}

// Available chains for cross-chain swaps
const availableChains: Chain[] = [
  { id: "l1x", name: "Layer One X", logo: "/chain-logos/l1x.png" },
  { id: "ethereum", name: "Ethereum", logo: "/chain-logos/ethereum.png" },
  { id: "solana", name: "Solana", logo: "/chain-logos/solana.png" },
  { id: "polygon", name: "Polygon", logo: "/chain-logos/polygon.png" },
  { id: "avalanche", name: "Avalanche", logo: "/chain-logos/avalanche.png" },
];

interface CrossChainSwapProps {
  vaultId: number;
}

export function CrossChainSwap({ vaultId }: CrossChainSwapProps) {
  const [assets, setAssets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fromPrice, setFromPrice] = useState<number | null>(null);
  const [toPrice, setToPrice] = useState<number | null>(null);
  const [estimatedReceivedAmount, setEstimatedReceivedAmount] = useState<number | null>(null);
  const { toast } = useToast();
  
  // Initialize form
  const form = useForm<SwapFormValues>({
    resolver: zodResolver(swapFormSchema),
    defaultValues: {
      fromAsset: "",
      toAsset: "",
      amount: "",
      targetChain: "",
    },
  });
  
  // Watch form values for realtime calculations
  const fromAsset = form.watch("fromAsset");
  const toAsset = form.watch("toAsset");
  const amount = form.watch("amount");
  
  // Load assets for the vault
  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const response = await apiRequest({
          url: '/assets',
          method: 'GET',
        });
        setAssets(response as any[]);
      } catch (error) {
        console.error('Error fetching assets:', error);
        toast({
          variant: "destructive",
          title: "Failed to load assets",
          description: "Please try again later.",
        });
      }
    };
    
    fetchAssets();
  }, [toast]);
  
  // Get prices using the hook
  const { prices, isLoading: isPricesLoading } = usePrices();
  
  // Update local prices when selected assets or prices change
  useEffect(() => {
    if (prices && fromAsset && prices[fromAsset]) {
      setFromPrice(prices[fromAsset]);
    } else {
      setFromPrice(null);
    }
    
    if (prices && toAsset && prices[toAsset]) {
      setToPrice(prices[toAsset]);
    } else {
      setToPrice(null);
    }
  }, [prices, fromAsset, toAsset]);
  
  // Calculate estimated received amount
  useEffect(() => {
    if (fromPrice && toPrice && amount) {
      try {
        const amountNum = parseFloat(amount);
        if (!isNaN(amountNum) && amountNum > 0) {
          // Apply a mock 0.5% swap fee
          const valueInUSD = amountNum * fromPrice;
          const estimatedAmount = (valueInUSD * 0.995) / toPrice;
          setEstimatedReceivedAmount(estimatedAmount);
        }
      } catch (e) {
        setEstimatedReceivedAmount(null);
      }
    } else {
      setEstimatedReceivedAmount(null);
    }
  }, [fromPrice, toPrice, amount]);
  
  // Form submission handler
  const onSubmit = async (values: SwapFormValues) => {
    setIsLoading(true);
    
    try {
      // This would call the backend to initiate the cross-chain swap
      const response = await apiRequest({
        url: `/vaults/${vaultId}/cross-chain-swap`,
        method: 'POST',
        data: {
          fromAsset: values.fromAsset,
          toAsset: values.toAsset,
          amount: parseFloat(values.amount),
          targetChainId: values.targetChain,
        },
      });
      
      toast({
        title: "Swap Initiated",
        description: `Your cross-chain swap has been initiated. Transaction ID: ${response.txHash?.substring(0, 10)}...`,
      });
      
      // Reset form after successful submission
      form.reset();
    } catch (error) {
      console.error('Error initiating swap:', error);
      toast({
        variant: "destructive",
        title: "Swap Failed",
        description: "Failed to initiate cross-chain swap. Please try again later.",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Swap from/to assets
  const handleSwapDirection = () => {
    const currentFromAsset = form.getValues("fromAsset");
    const currentToAsset = form.getValues("toAsset");
    
    form.setValue("fromAsset", currentToAsset);
    form.setValue("toAsset", currentFromAsset);
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cross-Chain Swap</CardTitle>
        <CardDescription>Swap assets across different blockchains</CardDescription>
      </CardHeader>
      
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* From Asset */}
            <FormField
              control={form.control}
              name="fromAsset"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From Asset</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select asset to swap from" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {assets.map((asset) => (
                        <SelectItem key={asset.id} value={asset.symbol}>
                          {asset.name} ({asset.symbol})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {fromPrice ? `Current price: ${formatUSD(fromPrice)}` : 'Select an asset to see price'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Swap Direction Button */}
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleSwapDirection}
                className="rounded-full"
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            </div>
            
            {/* To Asset */}
            <FormField
              control={form.control}
              name="toAsset"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To Asset</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select asset to receive" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {assets.map((asset) => (
                        <SelectItem key={asset.id} value={asset.symbol}>
                          {asset.name} ({asset.symbol})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {toPrice ? `Current price: ${formatUSD(toPrice)}` : 'Select an asset to see price'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Amount */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter amount to swap"
                      {...field}
                      type="number"
                      step="0.000001"
                      min="0"
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormDescription>
                    {estimatedReceivedAmount !== null
                      ? `You will receive approximately ${estimatedReceivedAmount.toFixed(6)} ${toAsset}`
                      : 'Enter an amount to see estimate'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Target Blockchain */}
            <FormField
              control={form.control}
              name="targetChain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Blockchain</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select target blockchain" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableChains.map((chain) => (
                        <SelectItem key={chain.id} value={chain.id}>
                          {chain.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select the blockchain you want to receive assets on
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Initiating Swap...
                </>
              ) : (
                'Swap Assets'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      
      <CardFooter className="flex flex-col items-start">
        <p className="text-xs text-muted-foreground">
          Note: Cross-chain swaps typically settle within 2-5 minutes. A 0.5% fee is applied to all swaps.
        </p>
      </CardFooter>
    </Card>
  );
}