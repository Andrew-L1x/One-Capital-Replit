import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { VaultForm } from "@/components/forms/vault-form";

export default function VaultCreation() {
  const [, navigate] = useLocation();
  const [match] = useRoute("/vaults/new");
  
  // Check if user is authenticated
  const { data: user, isLoading: isLoadingUser, isError: isUserError } = useQuery({
    queryKey: ["/api/auth/me"],
  });
  
  // Redirect to home if not authenticated
  useEffect(() => {
    if (isUserError) {
      navigate("/");
    }
  }, [isUserError, navigate]);
  
  const handleBackToDashboard = () => {
    navigate("/dashboard");
  };
  
  if (isLoadingUser) {
    return (
      <div className="container mx-auto p-4 py-8">
        <div className="flex items-center mb-8">
          <Button variant="ghost" className="mr-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h2 className="text-3xl font-bold">Loading...</h2>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-4 py-8">
      <div className="flex items-center mb-8">
        <Button variant="ghost" onClick={handleBackToDashboard} className="mr-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h2 className="text-3xl font-bold">Create New Vault</h2>
      </div>
      
      <div className="max-w-2xl mx-auto">
        <VaultForm />
      </div>
    </div>
  );
}
