import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useWallet } from '@/lib/walletContext';
import { PortfolioValue } from './PortfolioValue';
import { PortfolioChart } from './PortfolioChart';
import { AssetAllocationTable } from './AssetAllocationTable';
import { PerformanceMetrics } from './PerformanceMetrics';

export function CurrentPortfolio() {
  const { isConnected } = useWallet();
  
  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Current Portfolio</CardTitle>
          <CardDescription>
            Connect your wallet to view your portfolio details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 space-y-2">
            <p className="text-muted-foreground">
              Wallet not connected
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <PortfolioValue />
        </div>
        <PortfolioChart />
      </div>
      
      <Card>
        <PerformanceMetrics />
      </Card>
      
      <AssetAllocationTable />
    </div>
  );
}