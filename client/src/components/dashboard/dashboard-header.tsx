import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowUpRight, 
  Wallet, 
  ArrowRight,
  UserCircle
} from "lucide-react";
import { WalletConnection } from "@/components/wallet/WalletConnection";
import { useWallet } from "@/lib/walletContext";

export default function DashboardHeader() {
  const [, setLocation] = useLocation();
  
  // Check if user is authenticated
  const { data: user } = useQuery({
    queryKey: ["/api/auth/me"],
  });
  
  // Get wallet information
  const { walletAddress, walletType, isConnected } = useWallet();
  
  // Format wallet address
  const formatWalletAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="border-b bg-card dark:bg-card/90 sticky top-0 z-10 backdrop-blur-sm">
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 
              className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent cursor-pointer"
              onClick={() => setLocation("/")}
            >
              One Capital
            </h1>
            <div className="hidden sm:flex space-x-2">
              <Button variant="ghost" size="sm" onClick={() => setLocation("/dashboard")}>
                Dashboard
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/vaults/new")}>
                Create Vault
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/contract-test")}>
                Contract Testing
              </Button>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Balance card - shown when wallet is connected */}
            {isConnected && walletAddress && (
              <div className="hidden md:block">
                <Card className="rounded-full border-none shadow-none bg-transparent">
                  <CardContent className="p-2 flex items-center space-x-2">
                    <Wallet className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Connected</p>
                      <div className="flex items-center">
                        <Badge 
                          variant={walletType === 'l1x' ? "default" : "secondary"}
                          className="text-xs px-2 py-0 h-4"
                        >
                          {walletType === 'l1x' ? 'L1X' : 'ETH'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
            
            {/* User profile */}
            <div className="flex items-center space-x-2 p-2 rounded-full bg-muted/30">
              <div className="text-right">
                <p className="text-sm font-medium">{(user as any)?.username || 'User'}</p>
                <p className="text-xs text-muted-foreground flex items-center">
                  {isConnected && walletAddress ? (
                    <>
                      <span className="hidden sm:inline">{formatWalletAddress(walletAddress)}</span>
                      <span className="sm:hidden">{walletType === 'l1x' ? 'L1X' : 'ETH'}</span>
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </>
                  ) : (
                    <span>Not connected</span>
                  )}
                </p>
              </div>
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <UserCircle className="h-6 w-6 text-primary" />
              </div>
            </div>
            
            {/* Wallet connection button */}
            <WalletConnection />
            
            {/* Logout button */}
            <Button variant="outline" size="sm" onClick={() => setLocation("/")}>
              <ArrowUpRight className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}