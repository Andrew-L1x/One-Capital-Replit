import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import PortfolioChart, { AssetAllocation } from "@/components/ui/portfolio-chart";
import AllocationCard from "@/components/dashboard/allocation-card";
import AllocationList from "@/components/dashboard/allocation-list";
import TakeProfitForm from "@/components/forms/take-profit-form";
import RebalanceSettingsForm from "@/components/forms/rebalance-settings-form";
import { Vault, Asset, Allocation, TakeProfitSetting, RebalanceHistory } from "@shared/schema";
import { ArrowLeft, RefreshCw, Coins, Lock, Unlock } from "lucide-react";

// Type for wouter route match
type RouteMatch = {
  params: {
    id: string;
  }
};

export default function VaultPage() {
  const [, setLocation] = useLocation();
  const [match] = useRoute("/vaults/:id");
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  
  // Get vault ID from URL
  const params = match && typeof match !== 'boolean' ? (match as RouteMatch).params : null;
  const vaultId = params ? parseInt(params.id) : undefined;
  
  // Debug log to check vault ID extraction
  console.log("Vault ID:", vaultId, "Match:", match, "Params:", params);
  
  // Check if user is authenticated
  const { data: user, isLoading: isLoadingUser, isError: isUserError } = useQuery({
    queryKey: ["/api/auth/me"],
  });
  
  // Redirect to home if not authenticated
  useEffect(() => {
    if (isUserError) {
      setLocation("/");
    }
  }, [isUserError, setLocation]);
  
  // Fetch vault details
  const { 
    data: vault, 
    isLoading: isLoadingVault, 
    isError: isVaultError,
    error: vaultError
  } = useQuery<Vault>({
    queryKey: [`/api/vaults/${vaultId}`],
    enabled: !!vaultId && !!user,
    retry: 1
  });
  
  // Fetch assets
  const { 
    data: assets = [], 
    isLoading: isLoadingAssets 
  } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
    enabled: !!user,
  });
  
  // Fetch allocations
  const { 
    data: allocations = [], 
    isLoading: isLoadingAllocations,
    refetch: refetchAllocations
  } = useQuery<Allocation[]>({
    queryKey: [`/api/vaults/${vaultId}/allocations`],
    enabled: !!vaultId && !!user,
  });
  
  // Fetch take profit settings
  const { 
    data: takeProfitSettings, 
    isLoading: isLoadingTakeProfit,
    refetch: refetchTakeProfit
  } = useQuery<TakeProfitSetting>({
    queryKey: [`/api/vaults/${vaultId}/take-profit`],
    enabled: !!vaultId && !!user,
    retry: false, // Don't retry on error - settings might not exist yet
  });
  
  // Fetch rebalance history
  const { 
    data: rebalanceHistory = [], 
    isLoading: isLoadingRebalanceHistory,
    refetch: refetchRebalanceHistory
  } = useQuery<RebalanceHistory[]>({
    queryKey: [`/api/vaults/${vaultId}/rebalance-history`],
    enabled: !!vaultId && !!user,
    retry: 1
  });
  
  // Rebalance mutation
  const rebalanceMutation = useMutation({
    mutationFn: async () => {
      if (!vaultId) return;
      return apiRequest("POST", `/api/vaults/${vaultId}/rebalance`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/vaults/${vaultId}/rebalance-history`] });
      toast({
        title: "Rebalance triggered",
        description: "Portfolio rebalance has been triggered successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Rebalance failed",
        description: error.message || "Failed to trigger rebalance. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Map allocations to chart data
  const getAllocationChartData = (): AssetAllocation[] => {
    if (!allocations || !assets) return [];
    
    return allocations.map((allocation) => {
      const asset = assets.find((a) => a.id === allocation.assetId);
      return {
        id: allocation.id,
        assetId: allocation.assetId,
        name: asset?.name || "Unknown",
        symbol: asset?.symbol || "???",
        percentage: parseFloat(allocation.targetPercentage.toString()),
      };
    });
  };
  
  // Go back to dashboard
  const handleBackToDashboard = () => {
    setLocation("/dashboard");
  };
  
  // Trigger rebalance
  const handleRebalance = () => {
    rebalanceMutation.mutate();
  };
  
  // Handle allocation updated
  const handleAllocationUpdated = () => {
    refetchAllocations();
  };

  // Loading state
  if (isLoadingUser || (isLoadingVault && !isVaultError)) {
    return (
      <div className="container mx-auto p-4 py-8">
        <div className="flex items-center mb-8">
          <Button variant="ghost" onClick={handleBackToDashboard} className="mr-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }
  
  // Log the state variables for debugging
  useEffect(() => {
    console.log("Vault page state:", {
      vaultId,
      match,
      params,
      isVaultError,
      isLoadingVault,
      vaultError,
      vault
    });
  }, [vaultId, match, params, isVaultError, isLoadingVault, vaultError, vault]);

  // Error state
  if (isVaultError || (!vault && !isLoadingVault)) {
    return (
      <div className="container mx-auto p-4 py-8">
        <div className="flex items-center mb-8">
          <Button variant="ghost" onClick={handleBackToDashboard}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Vault Not Found</CardTitle>
            <CardDescription>
              The vault you're looking for doesn't exist or you don't have access to it.
              (ID: {vaultId})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleBackToDashboard}>
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Safety check - don't proceed if vault is undefined
  if (!vault) {
    return (
      <div className="container mx-auto p-4 py-8">
        <div className="flex items-center mb-8">
          <Button variant="ghost" onClick={handleBackToDashboard}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Vault Not Found</CardTitle>
            <CardDescription>
              The vault you're looking for doesn't exist or you don't have access to it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleBackToDashboard}>
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <Button variant="ghost" onClick={handleBackToDashboard} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-3xl font-bold flex items-center">
              {vault.name}
              <Badge variant={vault.isCustodial ? "default" : "outline"} className="ml-3">
                {vault.isCustodial ? (
                  <Lock className="h-3 w-3 mr-1" />
                ) : (
                  <Unlock className="h-3 w-3 mr-1" />
                )}
                {vault.isCustodial ? "Custodial" : "Non-Custodial"}
              </Badge>
            </h2>
            {vault.description && (
              <p className="text-muted-foreground mt-1">{vault.description}</p>
            )}
          </div>
        </div>
        <Button 
          onClick={handleRebalance} 
          disabled={rebalanceMutation.isPending || allocations.length === 0}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          {rebalanceMutation.isPending ? "Rebalancing..." : "Rebalance Portfolio"}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="allocations">Allocations</TabsTrigger>
          <TabsTrigger value="settings">Take Profit Settings</TabsTrigger>
          <TabsTrigger value="rebalance">My Rebalance Strategy</TabsTrigger>
          <TabsTrigger value="history">Rebalance History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <PortfolioChart
              allocations={getAllocationChartData()}
              isLoading={isLoadingAllocations || isLoadingAssets}
              title="Vault Allocation"
              description="Current asset allocation in this vault"
            />
            
            <Card>
              <CardHeader>
                <CardTitle>Vault Details</CardTitle>
                <CardDescription>
                  Information about this investment vault
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-sm">Vault Type</span>
                    <span className="font-medium">
                      {vault.isCustodial ? "Custodial (Managed)" : "Non-Custodial"}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-sm">Created</span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(vault.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-sm">Assets</span>
                    <span className="font-medium">
                      {allocations.length} Asset{allocations.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Take Profit Strategy</span>
                    <span className="font-medium">
                      {takeProfitSettings && 'type' in takeProfitSettings
                        ? takeProfitSettings.type.charAt(0).toUpperCase() + takeProfitSettings.type.slice(1)
                        : "Not set"
                      }
                    </span>
                  </div>
                  
                  {rebalanceHistory.length > 0 && (
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-sm">Last Rebalance</span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(rebalanceHistory[0].timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  
                  {vault.contractAddress && (
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-sm">Contract Address</span>
                      <span className="text-sm font-mono">
                        {vault.contractAddress.slice(0, 6)}...{vault.contractAddress.slice(-4)}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          
          {allocations.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>No Allocations</CardTitle>
                <CardDescription>
                  This vault doesn't have any asset allocations yet
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Button onClick={() => setActiveTab("allocations")}>
                  <Coins className="h-4 w-4 mr-2" />
                  Add Assets
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="allocations" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <AllocationList 
              allocations={allocations} 
              assets={assets}
              isLoading={isLoadingAllocations || isLoadingAssets}
              onAllocationUpdated={handleAllocationUpdated}
            />
            
            <AllocationCard 
              vaultId={vault.id} 
              assets={assets} 
              allocations={allocations}
              onAllocationAdded={handleAllocationUpdated}
            />
          </div>
        </TabsContent>
        
        <TabsContent value="settings" className="space-y-6">
          <TakeProfitForm 
            vaultId={vault.id}
            initialData={takeProfitSettings as TakeProfitSetting | undefined}
            onSubmitSuccess={() => refetchTakeProfit()}
          />
        </TabsContent>
        
        <TabsContent value="rebalance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>My Rebalance Strategy</CardTitle>
              <CardDescription>
                Configure your portfolio rebalancing strategy
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RebalanceSettingsForm 
                vault={vault}
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: [`/api/vaults/${vault.id}`] });
                  toast({
                    title: "Rebalance strategy updated",
                    description: "Your portfolio rebalance strategy has been updated"
                  });
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Rebalance History</CardTitle>
              <CardDescription>
                Record of portfolio rebalancing events
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingRebalanceHistory ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : rebalanceHistory.length > 0 ? (
                <div className="space-y-4">
                  {rebalanceHistory.map((record) => (
                    <div 
                      key={record.id} 
                      className="p-4 border rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium">
                          Rebalance #{record.id}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(record.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant={record.status === "completed" ? "default" : "outline"}>
                        {record.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No rebalance history yet</p>
                  <Button 
                    variant="outline" 
                    className="mt-4" 
                    onClick={handleRebalance}
                    disabled={rebalanceMutation.isPending || allocations.length === 0}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Trigger First Rebalance
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
