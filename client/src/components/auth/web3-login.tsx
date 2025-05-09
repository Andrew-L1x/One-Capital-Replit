import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { connectWallet, authenticateWithWallet } from "@/lib/web3";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Wallet } from "lucide-react";

interface Web3LoginProps {
  onSuccess?: () => void;
}

export default function Web3Login({ onSuccess }: Web3LoginProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      // First connect the wallet
      await connectWallet();
      
      // Then authenticate with the backend
      await authenticateWithWallet();
      
      // Update auth state
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      
      toast({
        title: "Wallet connected",
        description: "You have successfully connected your wallet and authenticated.",
      });
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error("Web3 login error:", err);
      setError(err.message || "Failed to connect wallet. Please try again.");
      
      toast({
        title: "Connection failed",
        description: err.message || "Failed to connect wallet. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect Wallet</CardTitle>
        <CardDescription>
          Connect your Web3 wallet to access the L1X blockchain
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <Button
          onClick={handleConnect}
          className="w-full"
          disabled={isConnecting}
          variant="outline"
          size="lg"
        >
          <Wallet className="mr-2 h-4 w-4" />
          {isConnecting ? "Connecting..." : "Connect Wallet"}
        </Button>
        
        <p className="text-xs text-muted-foreground text-center mt-4">
          By connecting your wallet, you agree to our Terms of Service and Privacy Policy
        </p>
      </CardContent>
    </Card>
  );
}
