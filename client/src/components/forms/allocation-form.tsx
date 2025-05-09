import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Asset, Allocation } from "@shared/schema";

import {
  Form,
  FormControl,
  FormDescription,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const allocationFormSchema = z.object({
  assetId: z.string().min(1, { message: "Please select an asset" }),
  targetPercentage: z
    .string()
    .min(1, { message: "Please enter a target percentage" })
    .refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0 && num <= 100;
      },
      { message: "Target percentage must be between 0 and 100" }
    ),
});

type AllocationFormValues = z.infer<typeof allocationFormSchema>;

interface AllocationFormProps {
  vaultId: number;
  assets: Asset[];
  existingAllocations: Allocation[];
  onSubmitSuccess: () => void;
}

export default function AllocationForm({
  vaultId,
  assets,
  existingAllocations,
  onSubmitSuccess,
}: AllocationFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Calculate current total allocation
  const currentTotal = existingAllocations.reduce(
    (sum, allocation) => sum + parseFloat(allocation.targetPercentage.toString()),
    0
  );
  
  // Filter out assets that are already allocated
  const availableAssets = assets.filter(
    (asset) => !existingAllocations.some((alloc) => alloc.assetId === asset.id)
  );
  
  const form = useForm<AllocationFormValues>({
    resolver: zodResolver(allocationFormSchema),
    defaultValues: {
      assetId: "",
      targetPercentage: "",
    },
  });
  
  const onSubmit = async (data: AllocationFormValues) => {
    setIsSubmitting(true);
    
    try {
      const assetId = parseInt(data.assetId);
      const targetPercentage = parseFloat(data.targetPercentage);
      
      // Validate that the total allocation doesn't exceed 100%
      if (currentTotal + targetPercentage > 100) {
        toast({
          title: "Allocation Error",
          description: `Total allocation cannot exceed 100%. Current total: ${currentTotal.toFixed(2)}%`,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      await apiRequest("POST", `/api/vaults/${vaultId}/allocations`, {
        assetId,
        targetPercentage,
      });
      
      queryClient.invalidateQueries({ queryKey: [`/api/vaults/${vaultId}/allocations`] });
      
      toast({
        title: "Allocation Added",
        description: "Asset allocation has been successfully added to your vault",
      });
      
      form.reset();
      onSubmitSuccess();
    } catch (error: any) {
      console.error("Error adding allocation:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add allocation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Asset Allocation</CardTitle>
        <CardDescription>
          Define the allocation percentages for your portfolio
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <p className="text-sm text-muted-foreground mb-2">
            Current Total Allocation: {currentTotal.toFixed(2)}%
          </p>
          <p className="text-sm text-muted-foreground">
            Remaining: {(100 - currentTotal).toFixed(2)}%
          </p>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="assetId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Asset</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={availableAssets.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an asset" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableAssets.map((asset) => (
                        <SelectItem key={asset.id} value={asset.id.toString()}>
                          {asset.name} ({asset.symbol})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose an asset from the available options
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="targetPercentage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Percentage</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        min="0.01"
                        max="100"
                        placeholder="25.00"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        %
                      </div>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Percentage of your portfolio to allocate to this asset
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button
              type="submit"
              disabled={isSubmitting || availableAssets.length === 0 || currentTotal >= 100}
              className="w-full"
            >
              {isSubmitting ? "Adding..." : "Add Allocation"}
            </Button>
            
            {availableAssets.length === 0 && (
              <p className="text-sm text-muted-foreground text-center">
                All available assets have been allocated
              </p>
            )}
            
            {currentTotal >= 100 && (
              <p className="text-sm text-muted-foreground text-center">
                Total allocation has reached 100%
              </p>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
