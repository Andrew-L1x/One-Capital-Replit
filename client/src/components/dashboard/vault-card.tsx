import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Vault } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { ChevronRight, DollarSign, BarChart3, Lock, Unlock } from "lucide-react";

interface VaultCardProps {
  vault: Vault;
}

export default function VaultCard({ vault }: VaultCardProps) {
  const [, setLocation] = useLocation();
  
  const handleViewVault = () => {
    setLocation(`/vaults/${vault.id}`);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="mb-2">{vault.name}</CardTitle>
            <CardDescription>
              {vault.description || "No description provided"}
            </CardDescription>
          </div>
          <Badge variant={vault.isCustodial ? "default" : "outline"}>
            {vault.isCustodial ? (
              <Lock className="h-3 w-3 mr-1" />
            ) : (
              <Unlock className="h-3 w-3 mr-1" />
            )}
            {vault.isCustodial ? "Custodial" : "Non-Custodial"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="space-y-4">
          <div className="flex items-center">
            <DollarSign className="h-4 w-4 mr-2 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Created on {new Date(vault.createdAt).toLocaleDateString()}
            </span>
          </div>
          
          {vault.contractAddress && (
            <div className="flex items-center">
              <BarChart3 className="h-4 w-4 mr-2 text-muted-foreground" />
              <span className="text-sm text-muted-foreground truncate">
                Contract: {vault.contractAddress.slice(0, 6)}...{vault.contractAddress.slice(-4)}
              </span>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" className="w-full" onClick={handleViewVault}>
          View Vault
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
