import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";

// Vault form schema
const vaultFormSchema = z.object({
  name: z.string()
    .min(3, { message: "Name must be at least 3 characters long" })
    .max(50, { message: "Name must be less than 50 characters" }),
  description: z.string()
    .max(500, { message: "Description must be less than 500 characters" })
    .optional(),
  isCustodial: z.boolean().default(true),
  contractAddress: z.string().optional(),
});

type VaultFormValues = z.infer<typeof vaultFormSchema>;

interface VaultFormProps {
  editMode?: boolean;
  initialData?: VaultFormValues & { id: number };
}

export function VaultForm({ editMode = false, initialData }: VaultFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Default form values
  const defaultValues: Partial<VaultFormValues> = {
    name: initialData?.name || "",
    description: initialData?.description || "",
    isCustodial: initialData?.isCustodial !== undefined ? initialData.isCustodial : true,
    contractAddress: initialData?.contractAddress || "",
  };

  const form = useForm<VaultFormValues>({
    resolver: zodResolver(vaultFormSchema),
    defaultValues,
  });

  const onSubmit = async (data: VaultFormValues) => {
    setIsSubmitting(true);
    try {
      if (editMode && initialData) {
        await apiRequest("PUT", `/api/vaults/${initialData.id}`, data);
        queryClient.invalidateQueries({ queryKey: ['/api/vaults'] });
        queryClient.invalidateQueries({ queryKey: [`/api/vaults/${initialData.id}`] });
        
        toast({
          title: "Vault updated",
          description: "Your vault has been updated successfully.",
        });
      } else {
        const response = await apiRequest("POST", "/api/vaults", data);
        const vault = await response.json();
        
        queryClient.invalidateQueries({ queryKey: ['/api/vaults'] });
        
        toast({
          title: "Vault created",
          description: "Your new vault has been created successfully.",
        });
        
        // Navigate to the vault page
        setLocation(`/vaults/${vault.id}`);
      }
    } catch (error: any) {
      console.error("Error submitting vault form:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save vault. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editMode ? "Edit Vault" : "Create Vault"}</CardTitle>
        <CardDescription>
          {editMode
            ? "Update your investment vault details"
            : "Create a new investment vault to manage your assets"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vault Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My Investment Vault" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the purpose of this vault..."
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="isCustodial"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Custodial Vault</FormLabel>
                    <FormDescription>
                      Enable for managed vault with automated rebalancing
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            
            {!form.watch("isCustodial") && (
              <FormField
                control={form.control}
                name="contractAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract Address</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="0x..."
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editMode ? "Update Vault" : "Create Vault"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
