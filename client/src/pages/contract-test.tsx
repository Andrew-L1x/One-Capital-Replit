import ContractTester from "../components/contracts/ContractTester";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function ContractTestPage() {
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
        This page allows you to test the connection to your deployed L1X smart contracts.
        Enter your contract address and interact with its functions directly from this interface.
      </p>
      
      <div className="py-4">
        <ContractTester />
      </div>
    </div>
  );
}