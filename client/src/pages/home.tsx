import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import FirebaseLogin from "@/components/auth/firebase-login";
import Web3Login from "@/components/auth/web3-login";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronRight, ArrowRight, BarChart3, Shield, LineChart } from "lucide-react";

export default function Home() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<string>("web2");
  
  // Check if user is already logged in
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    retry: false,
    gcTime: 0,
  });

  // Removed auto-redirect to allow viewing home page while logged in

  const handleLoginSuccess = () => {
    setLocation("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navigation */}
      <header className="w-full py-4 px-6 border-b sticky top-0 bg-background z-50">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold cursor-pointer" onClick={() => setLocation("/")}>One Capital</h1>
          <nav className="hidden md:flex items-center space-x-6">
            <a href="#investment" className="text-sm font-medium hover:text-primary">Investing</a>
            <a href="#features" className="text-sm font-medium hover:text-primary">Features</a>
            <a href="#performance" className="text-sm font-medium hover:text-primary">Performance</a>
            <a href="#pricing" className="text-sm font-medium hover:text-primary">Pricing</a>
          </nav>
          <div className="flex items-center space-x-4">
            {!isLoading && !user ? (
              <>
                <Button variant="ghost" onClick={() => setLocation("/dashboard")}>
                  Try Demo
                </Button>
                <Button onClick={() => {
                  // Scroll to login section
                  document.getElementById('login')?.scrollIntoView({ behavior: 'smooth' });
                }}>
                  Get Started
                </Button>
              </>
            ) : user && (
              <>
                <Button variant="outline" onClick={() => setLocation("/dashboard")}>
                  Go to Dashboard
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
      
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative bg-gradient-to-b from-white to-slate-50 dark:from-background dark:to-background/80 py-16 md:py-24 overflow-hidden">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid gap-8 md:grid-cols-2 md:gap-12 items-center">
              <div className="relative z-10">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
                  <span className="text-primary">Automated</span> investing for digital assets
                </h1>
                <p className="text-xl text-muted-foreground mb-8 max-w-md">
                  One Capital helps you build long-term wealth by making it easy to create and automate your crypto investment strategy.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button size="lg" className="bg-primary hover:bg-primary/90 text-white" onClick={() => {
                    document.getElementById('login')?.scrollIntoView({ behavior: 'smooth' });
                  }}>
                    Get Started <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => setLocation("/dashboard")}>
                    View Demo
                  </Button>
                </div>
              </div>
              
              <div className="relative">
                <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-16 -left-12 w-72 h-72 bg-primary/10 rounded-full blur-3xl"></div>
                
                <div className="relative z-10 bg-white dark:bg-black/40 shadow-xl rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-xl">Portfolio Preview</h3>
                    <span className="text-sm text-primary">+12.4% YTD</span>
                  </div>
                  <div className="mb-6">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Total Value</span>
                      <span className="font-semibold">$24,680.55</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{width: '65%'}}></div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 mr-3">
                          <span className="text-xs font-bold">BTC</span>
                        </div>
                        <div>
                          <div className="font-medium">Bitcoin</div>
                          <div className="text-xs text-muted-foreground">40% Allocation</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">$9,872.22</div>
                        <div className="text-xs text-green-500">+15.2%</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mr-3">
                          <span className="text-xs font-bold">ETH</span>
                        </div>
                        <div>
                          <div className="font-medium">Ethereum</div>
                          <div className="text-xs text-muted-foreground">35% Allocation</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">$8,638.19</div>
                        <div className="text-xs text-green-500">+8.7%</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-purple-600 dark:text-purple-400 mr-3">
                          <span className="text-xs font-bold">SOL</span>
                        </div>
                        <div>
                          <div className="font-medium">Solana</div>
                          <div className="text-xs text-muted-foreground">25% Allocation</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">$6,170.14</div>
                        <div className="text-xs text-green-500">+22.6%</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* Why One Capital Section */}
        <section className="py-16 md:py-24" id="investment">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Investing Made Effortless</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                One Capital combines intelligent automation with powerful crypto investing features to help you achieve your financial goals.
              </p>
            </div>
            
            <div className="grid gap-8 md:grid-cols-3">
              <Card className="p-6 border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">Automated Rebalancing</h3>
                <p className="text-muted-foreground mb-4">
                  Automatically maintain your target allocation with scheduled rebalancing, keeping your portfolio on track without manual work.
                </p>
                <a href="#" className="text-primary flex items-center text-sm font-medium">
                  Learn more <ChevronRight className="h-4 w-4 ml-1" />
                </a>
              </Card>
              
              <Card className="p-6 border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <LineChart className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">Take-Profit Strategies</h3>
                <p className="text-muted-foreground mb-4">
                  Set custom price targets and automatically capture gains when your investments reach specified thresholds.
                </p>
                <a href="#" className="text-primary flex items-center text-sm font-medium">
                  Learn more <ChevronRight className="h-4 w-4 ml-1" />
                </a>
              </Card>
              
              <Card className="p-6 border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">Smart Contract Security</h3>
                <p className="text-muted-foreground mb-4">
                  Our Rust-based smart contracts on L1X provide enterprise-grade security for your assets and transactions.
                </p>
                <a href="#" className="text-primary flex items-center text-sm font-medium">
                  Learn more <ChevronRight className="h-4 w-4 ml-1" />
                </a>
              </Card>
            </div>
          </div>
        </section>
        
        {/* How it Works Section */}
        <section className="py-16 md:py-24 bg-slate-50 dark:bg-slate-900/30" id="features">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">How One Capital Works</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Our platform simplifies crypto investing with a powerful yet easy-to-use approach
              </p>
            </div>
            
            <div className="grid gap-12 md:grid-cols-2 md:gap-8 lg:gap-16 items-center">
              <div>
                <div className="space-y-12">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">1</div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">Create Your Strategy</h3>
                      <p className="text-muted-foreground">
                        Choose from a selection of pre-built portfolios or create your own custom allocations of cryptocurrencies.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">2</div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">Set Your Parameters</h3>
                      <p className="text-muted-foreground">
                        Configure rebalancing frequency, drift thresholds, and take-profit settings to match your investment goals.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">3</div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">Fund Your Portfolio</h3>
                      <p className="text-muted-foreground">
                        Connect your wallet and fund your portfolio. We handle the asset purchases according to your strategy.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">4</div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">Automated Management</h3>
                      <p className="text-muted-foreground">
                        Sit back as One Capital automatically manages your portfolio, rebalancing and taking profits according to your strategy.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-lg bg-white dark:bg-black/40">
                <div className="p-1 bg-slate-100 dark:bg-slate-800 flex">
                  <div className="h-3 w-3 rounded-full bg-rose-500 mx-1"></div>
                  <div className="h-3 w-3 rounded-full bg-amber-500 mx-1"></div>
                  <div className="h-3 w-3 rounded-full bg-emerald-500 mx-1"></div>
                </div>
                <div className="p-6">
                  <div className="mb-6">
                    <h4 className="font-bold mb-3">Rebalancing Configuration</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Rebalancing Frequency</span>
                        <span className="text-sm font-medium">Monthly</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Drift Threshold</span>
                        <span className="text-sm font-medium">5%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Take-Profit Threshold</span>
                        <span className="text-sm font-medium">15%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-bold mb-3">Auto-Investing Settings</h4>
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <div className="w-4 h-4 rounded mr-2 bg-blue-500"></div>
                        <span className="text-sm flex-grow">Bitcoin (BTC)</span>
                        <span className="text-sm font-medium">40%</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-4 h-4 rounded mr-2 bg-indigo-500"></div>
                        <span className="text-sm flex-grow">Ethereum (ETH)</span>
                        <span className="text-sm font-medium">35%</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-4 h-4 rounded mr-2 bg-purple-500"></div>
                        <span className="text-sm flex-grow">Solana (SOL)</span>
                        <span className="text-sm font-medium">25%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* Performance Section */}
        <section className="py-16 md:py-24" id="performance">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Performance That Delivers</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Our strategies are designed to optimize for long-term growth while managing volatility
              </p>
            </div>
            
            <div className="grid gap-8 lg:grid-cols-2 items-center">
              <div className="space-y-8">
                <div className="bg-white dark:bg-black/40 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow">
                  <h3 className="text-xl font-bold mb-4">Aggressive Growth Strategy</h3>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-3xl font-bold text-green-500">+32.6%</p>
                      <p className="text-sm text-muted-foreground">12-month return</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold">vs. +21.4%</p>
                      <p className="text-sm text-muted-foreground">Cryptocurrency Index</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    High-growth portfolio focused on emerging Layer 1 blockchains and DeFi projects with strong fundamentals.
                  </p>
                  <Button variant="outline" size="sm" className="w-full">
                    View Strategy Details
                  </Button>
                </div>
                
                <div className="bg-white dark:bg-black/40 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow">
                  <h3 className="text-xl font-bold mb-4">Balanced Strategy</h3>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-3xl font-bold text-green-500">+24.8%</p>
                      <p className="text-sm text-muted-foreground">12-month return</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold">vs. +19.2%</p>
                      <p className="text-sm text-muted-foreground">Cryptocurrency Index</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Moderate-growth portfolio with focus on established cryptocurrencies and select growth assets.
                  </p>
                  <Button variant="outline" size="sm" className="w-full">
                    View Strategy Details
                  </Button>
                </div>
              </div>
              
              <div className="bg-white dark:bg-black/40 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold">Strategy Performance</h3>
                  <div className="flex text-sm space-x-2">
                    <span className="inline-flex items-center">
                      <span className="w-3 h-3 rounded-full bg-primary mr-1"></span>
                      Aggressive
                    </span>
                    <span className="inline-flex items-center">
                      <span className="w-3 h-3 rounded-full bg-blue-400 mr-1"></span>
                      Balanced
                    </span>
                    <span className="inline-flex items-center">
                      <span className="w-3 h-3 rounded-full bg-gray-400 mr-1"></span>
                      Index
                    </span>
                  </div>
                </div>
                
                <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    [Performance Chart]
                  </div>
                </div>
                
                <div className="mt-6 grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">1 Month</p>
                    <p className="font-bold text-green-500">+5.2%</p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">6 Months</p>
                    <p className="font-bold text-green-500">+18.7%</p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">1 Year</p>
                    <p className="font-bold text-green-500">+32.6%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* Pricing Section */}
        <section className="py-16 md:py-24 bg-slate-50 dark:bg-slate-900/30" id="pricing">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                No hidden fees. Just straightforward pricing to help you build wealth.
              </p>
            </div>
            
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
              <Card className="p-6 border border-slate-200 dark:border-slate-800 shadow-lg">
                <div className="mb-4">
                  <h3 className="text-xl font-bold">Basic</h3>
                  <p className="text-muted-foreground mb-4">For new crypto investors</p>
                  <div className="mb-4">
                    <span className="text-4xl font-bold">$0</span>
                    <span className="text-muted-foreground">/mo</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center">
                    <svg className="h-5 w-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <span>Up to $10,000 in assets</span>
                  </li>
                  <li className="flex items-center">
                    <svg className="h-5 w-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <span>Quarterly rebalancing</span>
                  </li>
                  <li className="flex items-center">
                    <svg className="h-5 w-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <span>3 portfolio strategies</span>
                  </li>
                  <li className="flex items-center text-muted-foreground">
                    <svg className="h-5 w-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                    <span>Advanced take-profit</span>
                  </li>
                </ul>
                <Button className="w-full">Get Started</Button>
              </Card>
              
              <Card className="p-6 border-2 border-primary shadow-lg relative">
                <div className="absolute -top-3 right-4 bg-primary text-white text-xs font-bold py-1 px-3 rounded-full">
                  POPULAR
                </div>
                <div className="mb-4">
                  <h3 className="text-xl font-bold">Pro</h3>
                  <p className="text-muted-foreground mb-4">For serious investors</p>
                  <div className="mb-4">
                    <span className="text-4xl font-bold">$9</span>
                    <span className="text-muted-foreground">/mo</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center">
                    <svg className="h-5 w-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <span>Up to $100,000 in assets</span>
                  </li>
                  <li className="flex items-center">
                    <svg className="h-5 w-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <span>Monthly rebalancing</span>
                  </li>
                  <li className="flex items-center">
                    <svg className="h-5 w-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <span>All portfolio strategies</span>
                  </li>
                  <li className="flex items-center">
                    <svg className="h-5 w-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <span>Advanced take-profit</span>
                  </li>
                </ul>
                <Button className="w-full bg-primary">Get Started</Button>
              </Card>
              
              <Card className="p-6 border border-slate-200 dark:border-slate-800 shadow-lg">
                <div className="mb-4">
                  <h3 className="text-xl font-bold">Enterprise</h3>
                  <p className="text-muted-foreground mb-4">For institutions</p>
                  <div className="mb-4">
                    <span className="text-4xl font-bold">Custom</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center">
                    <svg className="h-5 w-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <span>Unlimited assets</span>
                  </li>
                  <li className="flex items-center">
                    <svg className="h-5 w-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <span>Custom rebalancing</span>
                  </li>
                  <li className="flex items-center">
                    <svg className="h-5 w-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <span>Custom strategies</span>
                  </li>
                  <li className="flex items-center">
                    <svg className="h-5 w-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <span>Dedicated support</span>
                  </li>
                </ul>
                <Button className="w-full" variant="outline">
                  Contact Sales
                </Button>
              </Card>
            </div>
          </div>
        </section>
        
        {/* CTA & Login Section */}
        <section className="py-16 md:py-24" id="login">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid gap-12 md:grid-cols-2 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Start?</h2>
                <p className="text-lg text-muted-foreground mb-6">
                  Join thousands of investors building wealth with One Capital's intelligent portfolio management.
                </p>
                <div className="space-y-4 mb-6">
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
                  <div className="flex items-center">
                    <svg className="h-5 w-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <span>Enterprise-grade security for your assets</span>
                  </div>
                </div>
                <div className="flex items-center space-x-4 mt-8">
                  <Button variant="outline" onClick={() => setLocation("/dashboard")}>
                    Try Demo Account
                  </Button>
                </div>
              </div>
              
              <div className="bg-white dark:bg-black/40 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg p-6">
                <div className="w-full max-w-md mx-auto">
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
      </main>
      
      <footer className="border-t py-12 bg-slate-50 dark:bg-slate-900/30">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-bold mb-4">One Capital</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="text-muted-foreground hover:text-foreground">About Us</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground">Careers</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground">Press</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground">Contact</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4">Products</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="text-muted-foreground hover:text-foreground">Automated Investing</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground">Take-Profit Strategies</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground">Smart Contracts</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4">Resources</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="text-muted-foreground hover:text-foreground">Help Center</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground">Blog</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground">Guides</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="text-muted-foreground hover:text-foreground">Privacy Policy</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground">Terms of Service</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground">Cookie Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-muted-foreground mb-4 md:mb-0">
              &copy; {new Date().getFullYear()} One Capital Auto-Investing. All rights reserved.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-muted-foreground hover:text-foreground">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"></path>
                </svg>
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 5.302 3.438 9.8 8.205 11.387.6.11.819-.26.819-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.332-1.756-1.332-1.756-1.087-.744.083-.729.083-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.807 1.305 3.492.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.468-2.38 1.236-3.22-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.3 1.23.956-.266 1.983-.399 3.003-.404 1.02.005 2.046.138 3.005.404 2.29-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.22 0 4.61-2.806 5.625-5.478 5.92.43.372.824 1.102.824 2.222 0 1.604-.015 2.897-.015 3.29 0 .32.216.694.825.577C20.565 21.795 24 17.298 24 12c0-6.627-5.373-12-12-12z"></path>
                </svg>
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"></path>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
