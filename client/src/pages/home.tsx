import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import FirebaseLogin from "@/components/auth/firebase-login";
import Web3Login from "@/components/auth/web3-login";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Home() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<string>("web2");
  
  // Check if user is already logged in
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    retry: false,
    gcTime: 0,
  });

  // If user is logged in, redirect to dashboard
  useEffect(() => {
    if (user) {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  const handleLoginSuccess = () => {
    setLocation("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero Section */}
      <header className="w-full py-4 px-6 border-b">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">One Capital</h1>
          {!isLoading && !user && (
            <Button variant="outline" onClick={() => setLocation("/dashboard")}>
              Try Demo
            </Button>
          )}
        </div>
      </header>
      
      <main className="flex-grow">
        <section className="py-12 md:py-24">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid gap-8 md:grid-cols-2 md:gap-12 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                  <div>Automated Investing.</div>
                  <div>Native Assets.</div>
                  <div>Total Control.</div>
                </h2>
                <p className="text-lg text-muted-foreground mb-6">
                  One Capital Auto-Investing helps you manage your portfolio with automated rebalancing, take-profit strategies, and bridgeless swaps using L1X's X-Talk protocol.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <span>Automated portfolio rebalancing</span>
                  </div>
                  <div className="flex items-center">
                    <svg className="h-5 w-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <span>Take-profit strategies with multiple triggers</span>
                  </div>
                  <div className="flex items-center">
                    <svg className="h-5 w-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <span>Bridgeless cross-chain swaps via X-Talk</span>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-center md:justify-end">
                <div className="w-full max-w-md">
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="web2">Email Login</TabsTrigger>
                      <TabsTrigger value="web3">Wallet Login</TabsTrigger>
                    </TabsList>
                    <TabsContent value="web2">
                      <FirebaseLogin onSuccess={handleLoginSuccess} />
                    </TabsContent>
                    <TabsContent value="web3">
                      <Web3Login onSuccess={handleLoginSuccess} />
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* Features Section */}
        <section className="py-12 bg-muted">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-2xl font-bold text-center mb-8">Key Features</h2>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="bg-card p-6 rounded-lg shadow-sm">
                <h3 className="text-xl font-bold mb-3">Smart Contract Vaults</h3>
                <p className="text-muted-foreground">Secure and transparent vaults built on the L1X blockchain with Rust smart contracts</p>
              </div>
              <div className="bg-card p-6 rounded-lg shadow-sm">
                <h3 className="text-xl font-bold mb-3">Rebalancing Engine</h3>
                <p className="text-muted-foreground">Keep your portfolio aligned with your strategy through automated rebalancing</p>
              </div>
              <div className="bg-card p-6 rounded-lg shadow-sm">
                <h3 className="text-xl font-bold mb-3">X-Talk Integration</h3>
                <p className="text-muted-foreground">Seamless bridgeless swaps across chains using L1X's X-Talk protocol</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <footer className="border-t py-6">
        <div className="container mx-auto px-4 md:px-6">
          <p className="text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} One Capital Auto-Investing. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
