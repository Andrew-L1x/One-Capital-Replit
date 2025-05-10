import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";

// Define the form schema with validation
const takeProfitSchema = z.object({
  type: z.enum(["threshold", "scheduled", "manual"]),
  thresholdPercentage: z.string().optional()
    .refine(val => !val || (parseFloat(val) >= 1 && parseFloat(val) <= 100), {
      message: "Threshold must be between 1% and 100%",
    }),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly"]).optional(),
  percentageToSell: z.string()
    .refine(val => parseFloat(val) >= 1 && parseFloat(val) <= 100, {
      message: "Percentage to sell must be between 1% and 100%",
    }),
});

type TakeProfitFormValues = z.infer<typeof takeProfitSchema>;

interface TakeProfitFormProps {
  vaultId: number;
  initialData?: {
    id?: number;
    type: string;
    thresholdPercentage?: number;
    frequency?: string;
    percentageToSell: number;
  };
  onSubmitSuccess?: () => void;
}

export default function TakeProfitForm({ vaultId, initialData, onSubmitSuccess }: TakeProfitFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form with default values
  const form = useForm<TakeProfitFormValues>({
    resolver: zodResolver(takeProfitSchema),
    defaultValues: {
      type: (initialData?.type as "threshold" | "scheduled" | "manual") || "manual",
      thresholdPercentage: initialData?.thresholdPercentage?.toString() || "10",
      frequency: (initialData?.frequency as "daily" | "weekly" | "monthly" | "quarterly") || "weekly",
      percentageToSell: initialData?.percentageToSell?.toString() || "20",
    }
  });

  // Get current form values for conditional rendering
  const takeProfitType = form.watch("type");
  
  // Handle form submission
  const takeProfitMutation = useMutation({
    mutationFn: async (values: TakeProfitFormValues) => {
      const payload = {
        type: values.type,
        thresholdPercentage: values.type === "threshold" ? parseFloat(values.thresholdPercentage || "0") : null,
        frequency: values.type === "scheduled" ? values.frequency : null,
        percentageToSell: parseFloat(values.percentageToSell),
      };
      
      // If we have an existing ID, update it; otherwise create new
      if (initialData?.id) {
        return apiRequest("PUT", `/api/vaults/${vaultId}/take-profit`, payload);
      } else {
        return apiRequest("POST", `/api/vaults/${vaultId}/take-profit`, payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/vaults/${vaultId}/take-profit`] });
      if (onSubmitSuccess) {
        onSubmitSuccess();
      }
      setIsSubmitting(false);
    },
    onError: (error) => {
      console.error("Failed to save take profit settings:", error);
      setIsSubmitting(false);
    },
  });

  const onSubmit = (values: TakeProfitFormValues) => {
    setIsSubmitting(true);
    takeProfitMutation.mutate(values);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Take Profit Strategy</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your strategy for taking profits from your portfolio
        </p>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Take Profit Type */}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Take Profit Type</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="flex flex-col space-y-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="threshold" id="threshold" />
                      <FormLabel htmlFor="threshold" className="cursor-pointer">
                        Threshold-based (Take profit when gains reach a certain percentage)
                      </FormLabel>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="scheduled" id="scheduled" />
                      <FormLabel htmlFor="scheduled" className="cursor-pointer">
                        Scheduled (Take profit on a regular schedule)
                      </FormLabel>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="manual" id="manual" />
                      <FormLabel htmlFor="manual" className="cursor-pointer">
                        Manual Only (I'll decide when to take profits)
                      </FormLabel>
                    </div>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Threshold Percentage (only for threshold type) */}
          {takeProfitType === "threshold" && (
            <FormField
              control={form.control}
              name="thresholdPercentage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Profit Threshold</FormLabel>
                  <div className="flex items-center">
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        placeholder="10"
                        {...field}
                        className="w-24"
                      />
                    </FormControl>
                    <span className="ml-2">%</span>
                  </div>
                  <FormDescription>
                    Take profit when portfolio value increases by this percentage
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Frequency (only for scheduled type) */}
          {takeProfitType === "scheduled" && (
            <FormField
              control={form.control}
              name="frequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Take Profit Frequency</FormLabel>
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
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    How often to automatically take profits
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Percentage to Sell (for all types) */}
          <FormField
            control={form.control}
            name="percentageToSell"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Percentage to Sell</FormLabel>
                <div className="flex items-center">
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      placeholder="20"
                      {...field}
                      className="w-24"
                    />
                  </FormControl>
                  <span className="ml-2">%</span>
                </div>
                <FormDescription>
                  What percentage of each asset to sell when taking profits
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Take Profit Strategy"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}