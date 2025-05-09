import { useState } from "react";
import ContractTester from "../components/contracts/ContractTester";
import ContractDeployer from "../components/contracts/ContractDeployer";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ContractTestPage() {
  const [activeTab, setActiveTab] = useState<string>("deploy");
  
  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center">
        <Link href="/" className="flex items-center text-sm text-muted-foreground hover:text-primary mr-4">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold">L1X Contract Testing</h1>
      </div>
      
      <p className="text-muted-foreground">
        This page allows you to deploy and test your L1X smart contracts on the testnet.
        Upload your compiled WASM file, deploy it, and then interact with its functions.
      </p>
      
      <div className="py-4">
        <Tabs defaultValue="deploy" onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="deploy">Deploy Contract</TabsTrigger>
            <TabsTrigger value="test">Test Contract</TabsTrigger>
          </TabsList>
          
          <TabsContent value="deploy" className="pt-4">
            <ContractDeployer />
          </TabsContent>
          
          <TabsContent value="test" className="pt-4">
            <div className="mb-4">
              <p className="text-muted-foreground">
                {activeTab === "test" 
                  ? "Enter your contract address below or deploy a contract first."
                  : "First deploy your contract, then switch to this tab to test it."}
              </p>
            </div>
            <ContractTester />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}