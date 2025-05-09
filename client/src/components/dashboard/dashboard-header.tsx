import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowUpRight, 
  Wallet, 
  ChevronUp, 
  ChevronDown, 
  ArrowRight,
  UserCircle
} from "lucide-react";

// Mock wallet amount and growth for demo
const MOCK_WALLET = {
  balance: 10420.87,
  growth: 5.2,
  address: "0x1a2b3c4d5e6f7890123456789abcdef0123456789"
};

export default function DashboardHeader() {
  const [, setLocation] = useLocation();
  
  // Check if user is authenticated
  const { data: user } = useQuery({
    queryKey: ["/api/auth/me"],
  });
  
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
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">One Capital</h1>
            <div className="hidden sm:flex space-x-2">
              <Button variant="ghost" size="sm" onClick={() => setLocation("/dashboard")}>
                Dashboard
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/vaults/new")}>
                Create Vault
              </Button>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="hidden md:block">
              <Card className="rounded-full border-none shadow-none bg-transparent">
                <CardContent className="p-2 flex items-center space-x-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">${MOCK_WALLET.balance.toFixed(2)}</p>
                    <div className="flex items-center">
                      <Badge 
                        variant={MOCK_WALLET.growth >= 0 ? "default" : "destructive"}
                        className="text-xs px-1 py-0 h-4"
                      >
                        {MOCK_WALLET.growth >= 0 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {Math.abs(MOCK_WALLET.growth)}%
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-1">24h</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="flex items-center space-x-2 p-2 rounded-full bg-muted/30">
              <div className="text-right">
                <p className="text-sm font-medium">{(user as any)?.username || 'User'}</p>
                <p className="text-xs text-muted-foreground flex items-center">
                  <span className="hidden sm:inline">{formatWalletAddress(MOCK_WALLET.address)}</span>
                  <span className="sm:hidden">L1X Wallet</span>
                  <ArrowRight className="h-3 w-3 ml-1" />
                </p>
              </div>
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <UserCircle className="h-6 w-6 text-primary" />
              </div>
            </div>
            
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