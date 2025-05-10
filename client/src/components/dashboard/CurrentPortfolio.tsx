import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useWallet } from '@/lib/walletContext';
import { PortfolioChart } from './PortfolioChart';
import { CurrentHoldings } from './CurrentHoldings';
import { DepositWithdrawForm } from './DepositWithdrawForm';
import { Button } from '@/components/ui/button';

export function CurrentPortfolio() {
  const { isConnected, connectL1X, connectMetaMask } = useWallet();
  
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
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <p className="text-muted-foreground mb-2">
              Wallet not connected
            </p>
            <div className="flex gap-4">
              <Button onClick={connectL1X} variant="default">
                Connect L1X Wallet
              </Button>
              <Button onClick={connectMetaMask} variant="outline">
                Connect MetaMask
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="w-full h-full">
          <CurrentHoldings />
        </div>
        <div className="w-full">
          <PortfolioChart />
        </div>
      </div>
      
      {/* Deposit and Withdraw Section */}
      <DepositWithdrawForm />
    </div>
  );
}