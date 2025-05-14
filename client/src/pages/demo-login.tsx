import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from '@/lib/queryClient';

export default function DemoLoginPage() {
  const [location, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleDemoLogin = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'demo@example.com',
          password: 'password123',
        }),
        credentials: 'include',
      });
      
      // Check if login was successful
      if (res.ok) {
        toast({
          title: "Demo Login Successful",
          description: "You are now logged in with presentation data",
        });
        
        // Redirect to dashboard
        setLocation('/dashboard');
      } else {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Login failed');
      }
    } catch (error: any) {
      toast({
        title: "Demo Login Failed",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container flex items-center justify-center min-h-screen py-12">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Demo Login</CardTitle>
          <CardDescription className="text-center">
            Access the presentation version with enhanced mock data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-center">
            <p>This will log you in with a demo account populated with presentation-ready data including:</p>
            <ul className="list-disc text-left pl-6 space-y-1">
              <li>Multiple portfolio types with realistic allocations</li>
              <li>Enhanced performance metrics and trade history</li>
              <li>Detailed asset allocations with profit/loss indicators</li>
              <li>Cross-chain capabilities demonstration</li>
              <li>Simulated rebalancing and take-profit history</li>
            </ul>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full" 
            onClick={handleDemoLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Logging in...
              </>
            ) : (
              "Enter Demo with Presentation Data"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}