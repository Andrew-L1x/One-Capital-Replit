import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Asset, Allocation } from "@shared/schema";

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

interface AllocationCardProps {
  vaultId: number;
  assets: Asset[];
  allocations: Allocation[];
  onAllocationAdded: () => void;
}

export default function AllocationCard({
  vaultId,
  assets,
  allocations,
  onAllocationAdded,
}: AllocationCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate total allocation percentage
  const totalAllocation = allocations.reduce(
    (sum, allocation) => sum + parseFloat(allocation.targetPercentage.toString()),
    0
  );

  // Filter out assets that are already allocated
  const availableAssets = assets.filter(
    (asset) => !allocations.some((alloc) => alloc.assetId === asset.id)
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
      
      // Validate that we don't exceed 100%
      if (totalAllocation + targetPercentage > 100) {
        toast({
          title: "Allocation Error",
          description: `Total allocation cannot exceed 100%. Current total: ${totalAllocation.toFixed(2)}%`,
          variant: "destructive",
        });
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
      onAllocationAdded();
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
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <p className="text-sm text-muted-foreground mb-2">
            Current Total Allocation: {totalAllocation.toFixed(2)}%
          </p>
          <p className="text-sm text-muted-foreground">
            Remaining: {(100 - totalAllocation).toFixed(2)}%
          </p>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        %
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button
              type="submit"
              disabled={isSubmitting || availableAssets.length === 0 || totalAllocation >= 100}
              className="w-full"
            >
              {isSubmitting ? "Adding..." : "Add Allocation"}
            </Button>
            
            {availableAssets.length === 0 && (
              <p className="text-sm text-muted-foreground text-center">
                All available assets have been allocated
              </p>
            )}
            
            {totalAllocation >= 100 && (
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
