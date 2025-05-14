import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useWallet } from '@/lib/walletContext';
import { PortfolioChart } from './PortfolioChart';
import { CurrentHoldings } from './CurrentHoldings';
import { DepositWithdrawForm } from './DepositWithdrawForm';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';

export function CurrentPortfolio() {
  const { isConnected, connectL1X, connectMetaMask } = useWallet();
  const { data: user } = useQuery<any>({
    queryKey: ['/api/auth/me'],
  });
  
  // Show portfolio data if user is authenticated with either wallet or login
  const isAuthenticated = isConnected || !!user;
  
  if (!isAuthenticated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Current Portfolio</CardTitle>
          <CardDescription>
            Connect your wallet or login to view your portfolio details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <p className="text-muted-foreground mb-2">
              Not authenticated
            </p>
            <div className="flex gap-4 flex-wrap justify-center">
              <Button onClick={connectL1X} variant="default">
                Connect L1X Wallet
              </Button>
              <Button onClick={connectMetaMask} variant="outline">
                Connect MetaMask
              </Button>
              <Button onClick={() => window.location.href = '/demo-login'} variant="secondary">
                Use Demo Login
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
      <Card>
        <CardHeader>
          <CardTitle>Deposit & Withdraw</CardTitle>
          <CardDescription>Manage your investments with easy deposits and withdrawals</CardDescription>
        </CardHeader>
        <CardContent>
          <DepositWithdrawForm />
        </CardContent>
      </Card>
    </div>
  );
}