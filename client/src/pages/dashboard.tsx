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
import PortfolioChart, { AssetAllocation } from "@/components/ui/portfolio-chart";
import { 
  PlusCircle, 
  ArrowUpRight, 
  RefreshCcw, 
  BarChart3, 
  Wallet,
  History,
  Settings,
  Circle,
  DollarSign,
  ChevronUp,
  ChevronDown,
  ArrowRightLeft
} from "lucide-react";
import { Vault, Asset } from "@shared/schema";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<string>("allocation");

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
              Manage your cryptocurrency investments and allocations
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
            <TabsTrigger value="vaults">
              <BarChart3 className="h-4 w-4 mr-2" />
              <span>Vaults</span>
            </TabsTrigger>
            <TabsTrigger value="portfolio">
              <Circle className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Overview</span>
              <span className="sm:hidden">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Settings</span>
              <span className="sm:hidden">Settings</span>
            </TabsTrigger>
          </TabsList>
          
          {/* Portfolio Balance Bar */}
          <div className="bg-card rounded-lg border p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
              <div className="flex items-center gap-2 mb-2 sm:mb-0">
                <DollarSign className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Portfolio Balance</h3>
                  <p className="text-2xl font-bold">$10,420.87</p>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">24h Change</h3>
                  <p className="flex items-center text-lg font-medium text-green-600">
                    <ChevronUp className="h-4 w-4 mr-1" />
                    5.2%
                  </p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">7d Change</h3>
                  <p className="flex items-center text-lg font-medium text-green-600">
                    <ChevronUp className="h-4 w-4 mr-1" />
                    12.8%
                  </p>
                </div>
                
                <div className="hidden md:block">
                  <h3 className="text-sm font-medium text-muted-foreground">30d Change</h3>
                  <p className="flex items-center text-lg font-medium text-red-600">
                    <ChevronDown className="h-4 w-4 mr-1" />
                    2.4%
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Portfolio Allocation Tab */}
          <TabsContent value="allocation" className="space-y-8">
            <PortfolioManager />
          </TabsContent>
          
          {/* Vaults Tab */}
          <TabsContent value="vaults" className="space-y-8">
            {isLoadingVaults ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="h-48">
                    <CardHeader>
                      <div className="h-5 w-1/3 bg-muted rounded animate-pulse" />
                      <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="h-4 w-full bg-muted rounded animate-pulse" />
                        <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : vaults.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {vaults.map((vault) => (
                  <VaultCard key={vault.id} vault={vault} />
                ))}
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>No Vaults</CardTitle>
                  <CardDescription>
                    Create your first investment vault to get started
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
          
          {/* Portfolio Overview Tab */}
          <TabsContent value="portfolio" className="space-y-8">
            {/* Real-time current portfolio with chart and table */}
            <CurrentPortfolio />
            
            {/* Add Cross-Chain Swap section if vaults exist */}
            {vaults.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-medium mb-4 flex items-center">
                  <ArrowRightLeft className="h-5 w-5 mr-2" />
                  Cross-Chain Operations
                </h3>
                <div className="grid gap-6 md:grid-cols-2">
                  <CrossChainSwap />
                  
                  <Card className="md:col-span-1">
                    <PerformanceMetrics />
                  </Card>
                </div>
              </div>
            )}
            
            {/* Show message if no vaults exist */}
            {vaults.length === 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>No Portfolio Data</CardTitle>
                  <CardDescription>
                    Create a vault to see your portfolio overview and access cross-chain operations
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
          
          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-8">
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
                    <span className="text-sm">Auto-rebalancing</span>
                    <span className="font-medium text-green-600">Enabled</span>
                  </div>
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
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
