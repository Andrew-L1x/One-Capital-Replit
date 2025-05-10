import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";
import { Vault } from "@shared/schema";

// Form schema for rebalance settings
const rebalanceSettingsSchema = z.object({
  driftThreshold: z.coerce.number()
    .min(0.1, { message: "Drift threshold must be at least 0.1%" })
    .max(20, { message: "Drift threshold cannot exceed 20%" }),
  rebalanceFrequency: z.enum(["manual", "weekly", "monthly", "quarterly", "yearly"])
});

type RebalanceSettingsFormProps = {
  vault: Vault;
  onSuccess?: () => void;
};

export default function RebalanceSettingsForm({ vault, onSuccess }: RebalanceSettingsFormProps) {
  const { toast } = useToast();
  const [isRebalancing, setIsRebalancing] = useState(false);

  // Form setup
  const form = useForm<z.infer<typeof rebalanceSettingsSchema>>({
    resolver: zodResolver(rebalanceSettingsSchema),
    defaultValues: {
      driftThreshold: parseFloat(vault.driftThreshold?.toString() || "5.0"),
      rebalanceFrequency: (vault.rebalanceFrequency || "manual") as "manual" | "weekly" | "monthly" | "quarterly" | "yearly"
    }
  });

  // Update form when vault changes
  useEffect(() => {
    form.reset({
      driftThreshold: parseFloat(vault.driftThreshold?.toString() || "5.0"),
      rebalanceFrequency: (vault.rebalanceFrequency || "manual") as "manual" | "weekly" | "monthly" | "quarterly" | "yearly"
    });
  }, [vault, form]);

  // Mutation for updating rebalance settings
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: z.infer<typeof rebalanceSettingsSchema>) => {
      return apiRequest("PUT", `/api/vaults/${vault.id}/rebalance-settings`, data);
    },
    onSuccess: () => {
      toast({
        title: "Settings Updated",
        description: "Rebalance settings have been updated successfully.",
        variant: "default"
      });
      
      // Invalidate vault query to refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/vaults/${vault.id}`] });
      
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update rebalance settings. Please try again.",
        variant: "destructive"
      });
      console.error("Error updating rebalance settings:", error);
    }
  });

  // Mutation for manual rebalance
  const rebalanceMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/vaults/${vault.id}/rebalance`, "POST");
    },
    onSuccess: (data: any) => {
      const needsRebalance = data.needsRebalance;
      
      toast({
        title: "Rebalance Complete",
        description: needsRebalance 
          ? "Your portfolio has been rebalanced successfully." 
          : "Rebalance completed, but no adjustments were necessary.",
        variant: "default"
      });
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: [`/api/vaults/${vault.id}/rebalance-history`] });
      queryClient.invalidateQueries({ queryKey: [`/api/vaults/${vault.id}/allocations`] });
      
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to rebalance portfolio. Please try again.",
        variant: "destructive"
      });
      console.error("Error rebalancing portfolio:", error);
    }
  });

  // Handle form submission
  const onSubmit = (data: z.infer<typeof rebalanceSettingsSchema>) => {
    updateSettingsMutation.mutate(data);
  };

  // Handle manual rebalance
  const handleManualRebalance = () => {
    setIsRebalancing(true);
    rebalanceMutation.mutate(undefined, {
      onSettled: () => setIsRebalancing(false)
    });
  };

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="driftThreshold"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Drift Threshold ({field.value}%)</FormLabel>
                <FormControl>
                  <Slider
                    min={0.1}
                    max={20}
                    step={0.1}
                    value={[field.value]}
                    onValueChange={(value) => field.onChange(value[0])}
                    className="py-4"
                  />
                </FormControl>
                <p className="text-sm text-muted-foreground">
                  Rebalance when any asset drifts more than {field.value}% from its target allocation
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="rebalanceFrequency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rebalance Frequency</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="manual">Manual Only</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  How often your portfolio should automatically rebalance
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex space-x-4 pt-2">
            <Button 
              type="submit" 
              disabled={updateSettingsMutation.isPending}
              className="flex-1"
            >
              Save Settings
            </Button>
            
            <Button 
              type="button" 
              variant="outline" 
              disabled={rebalanceMutation.isPending || isRebalancing}
              onClick={handleManualRebalance}
              className="flex-1"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Rebalance Now
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}