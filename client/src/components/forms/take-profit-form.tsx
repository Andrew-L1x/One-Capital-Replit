import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { TakeProfitSetting } from "@shared/schema";

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
import { Skeleton } from "@/components/ui/skeleton";

// Take profit form schema
const takeProfitSchema = z.object({
  type: z.enum(["manual", "time", "percentage"]),
  percentage: z.string().optional()
    .refine(val => {
      if (val === undefined || val === "") return true;
      const num = parseFloat(val);
      return !isNaN(num) && num > 0 && num <= 100;
    }, { message: "Percentage must be between 0 and 100" }),
  interval: z.enum(["daily", "weekly", "monthly"]).optional(),
});

type TakeProfitFormValues = z.infer<typeof takeProfitSchema>;

interface TakeProfitFormProps {
  vaultId: number;
  initialData?: TakeProfitSetting;
  isLoading?: boolean;
  onSubmitSuccess?: () => void;
}

export default function TakeProfitForm({
  vaultId,
  initialData,
  isLoading = false,
  onSubmitSuccess,
}: TakeProfitFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const editMode = !!initialData;
  
  // Default form values
  const defaultValues: TakeProfitFormValues = {
    type: initialData?.type as "manual" | "time" | "percentage" || "manual",
    percentage: initialData?.percentage ? initialData.percentage.toString() : undefined,
    interval: initialData?.interval as "daily" | "weekly" | "monthly" | undefined,
  };
  
  const form = useForm<TakeProfitFormValues>({
    resolver: zodResolver(takeProfitSchema),
    defaultValues,
  });
  
  const watchType = form.watch("type");
  
  // Submit handler
  const onSubmit = async (data: TakeProfitFormValues) => {
    setIsSubmitting(true);
    
    try {
      const payload = {
        ...data,
        percentage: data.percentage ? parseFloat(data.percentage) : undefined,
      };
      
      if (editMode) {
        await apiRequest("PUT", `/api/vaults/${vaultId}/take-profit`, payload);
      } else {
        await apiRequest("POST", `/api/vaults/${vaultId}/take-profit`, payload);
      }
      
      queryClient.invalidateQueries({ queryKey: [`/api/vaults/${vaultId}/take-profit`] });
      
      toast({
        title: editMode ? "Settings updated" : "Settings created",
        description: `Take profit settings ${editMode ? "updated" : "created"} successfully`,
      });
      
      if (onSubmitSuccess) {
        onSubmitSuccess();
      }
    } catch (error: any) {
      console.error("Error submitting take profit form:", error);
      toast({
        title: "Error",
        description: error.message || `Failed to ${editMode ? "update" : "create"} take profit settings. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Take Profit Settings</CardTitle>
        <CardDescription>
          Configure when and how to realize gains from your portfolio
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Take Profit Strategy</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a strategy" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="manual">Manual (On-Demand)</SelectItem>
                      <SelectItem value="percentage">Percentage Gain</SelectItem>
                      <SelectItem value="time">Time-Based</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose when to trigger profit-taking
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {watchType === "percentage" && (
              <FormField
                control={form.control}
                name="percentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gain Percentage</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type="number"
                          min="0.1"
                          max="100"
                          step="0.1"
                          placeholder="10.0"
                          value={field.value || ""}
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                          %
                        </div>
                      </div>
                    </FormControl>
                    <FormDescription>
                      Take profit when the portfolio gains this percentage
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            {watchType === "time" && (
              <FormField
                control={form.control}
                name="interval"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time Interval</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an interval" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Take profit at this regular interval
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting 
                ? "Saving..." 
                : editMode 
                  ? "Update Settings" 
                  : "Save Settings"
              }
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
