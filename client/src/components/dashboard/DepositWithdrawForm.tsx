import { useState } from "react";
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowDownToLine, ArrowUpFromLine, CircleDollarSign } from "lucide-react";
import { usePortfolio } from "@/lib/portfolioContext";
import { formatPrice } from "@/lib/usePriceDetails";

interface Asset {
  id: number;
  symbol: string;
  name: string;
}

export function DepositWithdrawForm() {
  const [activeTab, setActiveTab] = useState("deposit");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<string>("");
  const [withdrawMethod, setWithdrawMethod] = useState<"percentage" | "specific">("percentage");
  const [withdrawPercentage, setWithdrawPercentage] = useState("10");
  
  const { assetAllocations, portfolioValue, priceDetails } = usePortfolio();
  
  // Format assets for display and selection
  const assets = assetAllocations.map(allocation => ({
    id: allocation.asset.id,
    symbol: allocation.asset.symbol,
    name: allocation.asset.name,
    percentage: allocation.percentOfPortfolio,
    amount: allocation.amount,
    value: allocation.valueUSD
  }));
  
  // Handle deposit submission
  const handleDeposit = () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid deposit amount");
      return;
    }
    
    // In a real app, we would call an API to process the deposit
    // For now, just show a success message
    alert(`Successfully deposited ${formatPrice(amount)} following current allocation ratios`);
    setDepositAmount("");
  };
  
  // Handle custom asset deposit
  const handleCustomDeposit = () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid deposit amount");
      return;
    }
    
    if (!selectedAsset) {
      alert("Please select an asset to deposit into");
      return;
    }
    
    // In a real app, we would call an API to process the deposit
    // For now, just show a success message
    alert(`Successfully deposited ${formatPrice(amount)} to ${selectedAsset}`);
    setDepositAmount("");
    setSelectedAsset("");
  };
  
  // Handle withdrawal
  const handleWithdraw = () => {
    if (withdrawMethod === "percentage") {
      const percentage = parseFloat(withdrawPercentage);
      if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
        alert("Please enter a valid percentage (1-100)");
        return;
      }
      
      const withdrawValue = (portfolioValue * percentage) / 100;
      
      // In a real app, we would call an API to process the withdrawal
      // For now, just show a success message
      alert(`Successfully withdrew ${formatPrice(withdrawValue)} (${percentage}% of portfolio)`);
      setWithdrawPercentage("10");
    } else {
      const amount = parseFloat(withdrawAmount);
      if (isNaN(amount) || amount <= 0 || amount > portfolioValue) {
        alert("Please enter a valid withdrawal amount");
        return;
      }
      
      if (!selectedAsset) {
        alert("Please select an asset to withdraw from");
        return;
      }
      
      // In a real app, we would call an API to process the withdrawal
      // For now, just show a success message
      alert(`Successfully withdrew ${formatPrice(amount)} from ${selectedAsset}`);
      setWithdrawAmount("");
      setSelectedAsset("");
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Deposit & Withdraw</CardTitle>
        <CardDescription>
          Manage your investments with easy deposits and withdrawals
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="deposit">
              <ArrowDownToLine className="h-4 w-4 mr-2" />
              Deposit
            </TabsTrigger>
            <TabsTrigger value="withdraw">
              <ArrowUpFromLine className="h-4 w-4 mr-2" />
              Withdraw
            </TabsTrigger>
          </TabsList>
          
          {/* Deposit Tab */}
          <TabsContent value="deposit" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="deposit-amount">Deposit Amount (USD)</Label>
                <div className="flex mt-1">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                      <CircleDollarSign className="h-5 w-5 text-gray-400" />
                    </div>
                    <Input
                      id="deposit-amount"
                      type="number"
                      placeholder="0.00"
                      className="pl-8"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Deposit Method</Label>
                <RadioGroup defaultValue="current" className="flex flex-col space-y-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="current" id="current-allocation" />
                    <Label htmlFor="current-allocation" className="cursor-pointer">
                      Follow Current Allocation
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="custom" id="custom-asset" />
                    <Label htmlFor="custom-asset" className="cursor-pointer">
                      Specific Asset
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="deposit-asset">Select Asset</Label>
                <Select value={selectedAsset} onValueChange={setSelectedAsset}>
                  <SelectTrigger id="deposit-asset">
                    <SelectValue placeholder="Select an asset" />
                  </SelectTrigger>
                  <SelectContent>
                    {assets.map((asset) => (
                      <SelectItem key={asset.id} value={asset.symbol}>
                        {asset.symbol} - {asset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex space-x-2 pt-2">
                <Button
                  className="flex-1"
                  onClick={handleDeposit}
                  disabled={!depositAmount || parseFloat(depositAmount) <= 0}
                >
                  Deposit to All Assets
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCustomDeposit}
                  disabled={!depositAmount || !selectedAsset || parseFloat(depositAmount) <= 0}
                >
                  Deposit to Specific Asset
                </Button>
              </div>
            </div>
          </TabsContent>
          
          {/* Withdraw Tab */}
          <TabsContent value="withdraw" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Withdrawal Method</Label>
                <RadioGroup 
                  value={withdrawMethod} 
                  onValueChange={(value) => setWithdrawMethod(value as "percentage" | "specific")}
                  className="flex flex-col space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="percentage" id="percentage-withdrawal" />
                    <Label htmlFor="percentage-withdrawal" className="cursor-pointer">
                      Percentage of Portfolio
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="specific" id="specific-asset-withdrawal" />
                    <Label htmlFor="specific-asset-withdrawal" className="cursor-pointer">
                      Specific Asset and Amount
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              
              {withdrawMethod === "percentage" ? (
                <div>
                  <Label htmlFor="withdraw-percentage">Percentage to Withdraw</Label>
                  <div className="flex items-center mt-1">
                    <Input
                      id="withdraw-percentage"
                      type="number"
                      min="1"
                      max="100"
                      placeholder="10"
                      value={withdrawPercentage}
                      onChange={(e) => setWithdrawPercentage(e.target.value)}
                      className="flex-1"
                    />
                    <span className="ml-2">%</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Approximate value: {formatPrice((portfolioValue * parseFloat(withdrawPercentage || "0")) / 100)}
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <Label htmlFor="withdraw-amount">Withdrawal Amount (USD)</Label>
                    <div className="flex mt-1">
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                          <CircleDollarSign className="h-5 w-5 text-gray-400" />
                        </div>
                        <Input
                          id="withdraw-amount"
                          type="number"
                          placeholder="0.00"
                          className="pl-8"
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="withdraw-asset">Select Asset</Label>
                    <Select value={selectedAsset} onValueChange={setSelectedAsset}>
                      <SelectTrigger id="withdraw-asset">
                        <SelectValue placeholder="Select an asset" />
                      </SelectTrigger>
                      <SelectContent>
                        {assets.map((asset) => (
                          <SelectItem key={asset.id} value={asset.symbol}>
                            {asset.symbol} - {asset.name} ({formatPrice(asset.value)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              
              <div className="pt-2">
                <Button
                  className="w-full"
                  onClick={handleWithdraw}
                  disabled={
                    withdrawMethod === "percentage"
                      ? !withdrawPercentage || 
                        parseFloat(withdrawPercentage) <= 0 || 
                        parseFloat(withdrawPercentage) > 100
                      : !withdrawAmount || 
                        !selectedAsset || 
                        parseFloat(withdrawAmount) <= 0 || 
                        parseFloat(withdrawAmount) > portfolioValue
                  }
                >
                  {withdrawMethod === "percentage" ? "Withdraw by Percentage" : "Withdraw from Asset"}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}