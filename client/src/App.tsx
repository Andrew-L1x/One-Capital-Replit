import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "@/lib/walletContext";
import { PortfolioProvider } from "@/lib/portfolioContext";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import Vault from "@/pages/vault";
import VaultCreation from "@/pages/vault-creation";
import ContractTest from "@/pages/contract-test";
import MainLayout from "@/components/layout/main-layout";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/vaults/new" component={VaultCreation} />
      <Route path="/vaults/:id" component={Vault} />
      <Route path="/contract-test" component={ContractTest} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <PortfolioProvider>
          <TooltipProvider>
            <Toaster />
            <MainLayout>
              <Router />
            </MainLayout>
          </TooltipProvider>
        </PortfolioProvider>
      </WalletProvider>
    </QueryClientProvider>
  );
}

export default App;
