import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PortfolioProvider } from "@/lib/portfolioContext";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import Vault from "@/pages/vault";
import VaultCreation from "@/pages/vault-creation";
import ContractTest from "@/pages/contract-test";
import WalletDashboard from "@/pages/wallet-dashboard";
import MainLayout from "@/components/layout/main-layout";

// Dynamic Labs and Wallet Integration
import {
  DynamicContextProvider,
  DynamicWidget,
} from "@dynamic-labs/sdk-react-core";
import { DynamicWagmiConnector } from "@dynamic-labs/wagmi-connector";
import { createConfig, WagmiProvider } from "wagmi";
import { http } from "viem";
import { mainnet } from "viem/chains";
import { BitcoinWalletConnectors } from "@dynamic-labs/bitcoin";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { SolanaWalletConnectors } from "@dynamic-labs/solana";

// Define L1X chains - L1X Testnet chain ID 1777 (0x6f1)
const l1xTestnet = {
  id: 1777,
  name: 'L1X Testnet',
  network: 'l1x-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'L1X',
    symbol: 'L1X',
  },
  rpcUrls: {
    public: { http: ['https://v2.testnet.l1x.foundation'] },
    default: { http: ['https://v2.testnet.l1x.foundation'] },
  },
  blockExplorers: {
    default: { name: 'L1X Explorer', url: 'https://explorer.testnet.l1x.foundation' },
  },
};

// Create Wagmi config
const wagmiConfig = createConfig({
  chains: [mainnet, l1xTestnet],
  multiInjectedProviderDiscovery: false,
  transports: {
    [mainnet.id]: http(),
    [l1xTestnet.id]: http(),
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/vaults/new" component={VaultCreation} />
      <Route path="/vaults/:id" component={Vault} />
      <Route path="/contract-test" component={ContractTest} />
      <Route path="/wallet" component={WalletDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <DynamicContextProvider
      settings={{
        environmentId: "e24ef9b0-333d-4618-8677-c155bcc3ad3b",
        walletConnectors: [
          EthereumWalletConnectors,
        ]
      }}
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <DynamicWagmiConnector>
            <PortfolioProvider>
              <TooltipProvider>
                <Toaster />
                <MainLayout>
                  <Router />
                </MainLayout>
              </TooltipProvider>
            </PortfolioProvider>
          </DynamicWagmiConnector>
        </QueryClientProvider>
      </WagmiProvider>
    </DynamicContextProvider>
  );
}

export default App;
