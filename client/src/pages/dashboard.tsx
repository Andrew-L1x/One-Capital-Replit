import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import VaultCard from "@/components/dashboard/vault-card";
import PortfolioManager from "@/components/dashboard/portfolio-manager";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import { PortfolioValue } from "@/components/dashboard/PortfolioValue";
import { AssetAllocationTable } from "@/components/dashboard/AssetAllocationTable";
import { CurrentPortfolio } from "@/components/dashboard/CurrentPortfolio";
import { CrossChainSwap } from "@/components/dashboard/CrossChainSwap";
import { PerformanceMetrics } from "@/components/dashboard/PerformanceMetrics";
import { PortfolioBalance } from "@/components/dashboard/PortfolioBalance";
import PortfolioChart, { AssetAllocation } from "@/components/ui/portfolio-chart";
import TakeProfitForm from "@/components/forms/take-profit-form";
import { 
  PlusCircle, 
  ArrowUpRight, 
  RefreshCcw, 
  BarChart3, 
  Wallet,
  History,
  Settings,
  Circle,
  ArrowRightLeft,
  LineChart
} from "lucide-react";
import { Vault, Asset } from "@shared/schema";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<string>("portfolio");

  // Check if user is authenticated
  const { data: user, isLoading: isLoadingUser, isError: isUserError } = useQuery({
    queryKey: ["/api/auth/me"],
  });

  // Fetch vaults
  const { data: vaults = [], isLoading: isLoadingVaults } = useQuery<Vault[]>({
    queryKey: ["/api/vaults"],
    enabled: !!user,
  });

  // Fetch assets
  const { data: assets = [], isLoading: isLoadingAssets } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
    enabled: !!user,
  });

  // Redirect to home if not authenticated
  useEffect(() => {
    if (isUserError) {
      setLocation("/");
    }
  }, [isUserError, setLocation]);

  // Create chart data
  const getAllChartData = (): AssetAllocation[] => {
    // This is simplified - in a real app, we would get actual allocation values
    // by querying allocations for each vault and aggregating
    const assetMap = new Map<number, { count: number; symbol: string; name: string }>();
    
    vaults.forEach(vault => {
      // In a real application, we would fetch actual allocations for each vault
      // For now, just generate mock data based on assets
      assets.slice(0, 3).forEach(asset => {
        const existing = assetMap.get(asset.id);
        if (existing) {
          existing.count += 1;
        } else {
          assetMap.set(asset.id, { count: 1, symbol: asset.symbol, name: asset.name });
        }
      });
    });
    
    const totalCount = Array.from(assetMap.values()).reduce((sum, item) => sum + item.count, 0);
    
    return Array.from(assetMap.entries()).map(([id, { count, symbol, name }]) => ({
      id,
      symbol,
      name,
      percentage: (count / totalCount) * 100,
    }));
  };

  const handleCreateVault = () => {
    setLocation("/vaults/new");
  };

  if (isLoadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin mr-2">
          <RefreshCcw className="h-8 w-8 text-primary" />
        </div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      
      <main className="container mx-auto p-4 py-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 space-y-4 sm:space-y-0">
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">Portfolio Dashboard</h2>
            <p className="text-muted-foreground">
              Manage your digital asset investments and allocations
            </p>
          </div>
          
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => setLocation("/contract-test")}>
              <ArrowUpRight className="h-4 w-4 mr-2" />
              Contract Testing
            </Button>
            <Button onClick={handleCreateVault}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Create Vault
            </Button>
          </div>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="allocation">
              <Wallet className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Allocation</span>
              <span className="sm:hidden">Alloc</span>
            </TabsTrigger>
            <TabsTrigger value="move-assets">
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Move Assets</span>
              <span className="sm:hidden">Move</span>
            </TabsTrigger>
            <TabsTrigger value="portfolio">
              <LineChart className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Portfolio</span>
              <span className="sm:hidden">Portfolio</span>
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Rebalance</span>
              <span className="sm:hidden">Rebalance</span>
            </TabsTrigger>
          </TabsList>
          
          {/* Portfolio Balance Bar */}
          <PortfolioBalance />
          
          {/* Portfolio Allocation Tab */}
          <TabsContent value="allocation" className="space-y-8">
            <PortfolioManager />
          </TabsContent>
          
          {/* Move Assets Tab */}
          <TabsContent value="move-assets" className="space-y-8">
            <h3 className="text-lg font-medium mb-4 flex items-center">
              <ArrowRightLeft className="h-5 w-5 mr-2" />
              Cross-Chain Operations
            </h3>
            <div className="grid gap-6 md:grid-cols-1">
              <CrossChainSwap />
            </div>
            
            {vaults.length === 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>No Vaults Available</CardTitle>
                  <CardDescription>
                    Create a vault to enable cross-chain operations and asset movement
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <Button onClick={handleCreateVault}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Create Vault
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          {/* Portfolio Tab */}
          <TabsContent value="portfolio" className="space-y-8">
            {/* Real-time current portfolio with chart and table */}
            <CurrentPortfolio />
            
            {/* Add Performance Metrics */}
            {vaults.length > 0 && (
              <div className="mt-8">
                <PerformanceMetrics />
              </div>
            )}
            
            {/* Show message if no vaults exist */}
            {vaults.length === 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>No Portfolio Data</CardTitle>
                  <CardDescription>
                    Create a vault to see your portfolio overview
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <Button onClick={handleCreateVault}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Create Vault
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          {/* Rebalance Tab */}
          <TabsContent value="settings" className="space-y-8">
            <div className="grid gap-6 md:grid-cols-2">
              
              {vaults.length > 0 && (
                <Card className="md:col-span-1">
                  <CardHeader>
                    <CardTitle>My Rebalance Strategy</CardTitle>
                    <CardDescription>
                      Configure your portfolio rebalancing strategy
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="pb-4">
                        <div className="space-y-4">
                          {/* Rebalance Frequency */}
                          <div>
                            <label className="text-sm block mb-2">Frequency</label>
                            <select 
                              className="w-full p-2 rounded-md border border-input bg-background" 
                              defaultValue={vaults[0]?.rebalanceFrequency || "manual"}
                              id="rebalance-frequency"
                            >
                              <option value="manual">Manual</option>
                              <option value="daily">Daily</option>
                              <option value="weekly">Weekly</option>
                              <option value="monthly">Monthly</option>
                              <option value="quarterly">Quarterly</option>
                            </select>
                          </div>
                          
                          {/* Drift Threshold */}
                          <div>
                            <label className="text-sm block mb-2">Drift Threshold</label>
                            <select 
                              className="w-full p-2 rounded-md border border-input bg-background" 
                              defaultValue={vaults[0]?.driftThreshold?.toString() || "0"}
                              id="drift-threshold"
                            >
                              <option value="0">0%</option>
                              <option value="1">1%</option>
                              <option value="2">2%</option>
                              <option value="3">3%</option>
                              <option value="5">5%</option>
                              <option value="10">10%</option>
                              <option value="15">15%</option>
                              <option value="20">20%</option>
                            </select>
                          </div>
                          
                          <Button 
                            variant="default" 
                            size="sm" 
                            className="w-full mt-4"
                            onClick={() => {
                              if (vaults.length > 0) {
                                const frequencyValue = document.getElementById('rebalance-frequency') as HTMLSelectElement;
                                const thresholdValue = document.getElementById('drift-threshold') as HTMLSelectElement;
                                
                                // In a real app, we would update via API
                                console.log("Updating rebalance strategy:", {
                                  frequency: frequencyValue.value,
                                  threshold: thresholdValue.value
                                });
                                
                                // Show success message
                                alert("Rebalance strategy updated successfully!");
                              }
                            }}
                            disabled={vaults.length === 0}
                          >
                            <RefreshCcw className="h-4 w-4 mr-2" />
                            Update Rebalance Strategy
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {vaults.length > 0 && (
                <Card className="md:col-span-1">
                  <CardHeader>
                    <CardTitle>My Take Profit Strategy</CardTitle>
                    <CardDescription>
                      Configure when and how to take profits from your portfolio
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {vaults[0]?.id && (
                        <TakeProfitForm 
                          vaultId={vaults[0].id}
                          initialData={undefined}
                          onSubmitSuccess={() => {
                            // Success handling
                          }}
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
            
            {/* Portfolio Settings at the bottom */}
            <div className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Portfolio Settings</CardTitle>
                  <CardDescription>
                    Configure your portfolio and notification preferences
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="text-sm">Default Currency</span>
                      <span className="font-medium">USD</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Transaction Notifications</span>
                      <span className="font-medium">Enabled</span>
                    </div>
                    
                    <div className="pt-4 mt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Note: These settings are simulated for demo purposes. 
                        A future version will allow full customization of these options.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
