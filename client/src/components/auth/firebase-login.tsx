import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithRedirect, 
  getRedirectResult,
  User as FirebaseUser
} from "firebase/auth";

// Import the Firebase config
import { firebaseApp } from "@/lib/firebase";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Login form schema
const loginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

// Register form schema
const registerSchema = z.object({
  username: z.string().min(3, { message: "Username must be at least 3 characters" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

interface FirebaseLoginProps {
  onSuccess?: () => void;
}

export default function FirebaseLogin({ onSuccess }: FirebaseLoginProps) {
  const [activeTab, setActiveTab] = useState<string>("login");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Login form
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Register form
  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const handleLogin = async (data: LoginFormValues) => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      // First authenticate with Firebase
      const firebaseUser = await firebaseLogin(data.email, data.password);
      
      // Then authenticate with our backend using Firebase
      const idToken = await firebaseUser.getIdToken();
      
      await apiRequest("POST", "/api/auth/firebase-link", {
        firebaseUid: firebaseUser.uid,
        email: firebaseUser.email,
        idToken,
      });
      
      // Update auth state
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      
      toast({
        title: "Login successful",
        description: "You have successfully logged in.",
      });
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "Failed to login. Please check your credentials and try again.");
      
      toast({
        title: "Login failed",
        description: err.message || "Failed to login. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (data: RegisterFormValues) => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      console.log("Attempting to register with Firebase:", data.email);
      
      // First register with Firebase
      const firebaseUser = await firebaseRegister(data.email, data.password);
      console.log("Firebase registration successful, user:", firebaseUser.uid);
      
      // Get the ID token
      const idToken = await firebaseUser.getIdToken();
      
      console.log("Got ID token, linking with backend...");
      
      // Link the account with the backend using our firebase-link endpoint
      await apiRequest("POST", "/api/auth/firebase-link", {
        firebaseUid: firebaseUser.uid,
        email: data.email,
        idToken,
        username: data.username // Pass the username for account creation
      });
      
      console.log("Account linked with backend successfully");
      
      // Update auth state
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      
      toast({
        title: "Registration successful",
        description: "Your account has been created and you are now logged in.",
      });
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error("Registration error:", err);
      
      // Provide a more user-friendly error message
      let errorMessage = "Failed to register. Please try again.";
      
      // Handle specific Firebase error codes
      if (err.code) {
        switch (err.code) {
          case 'auth/email-already-in-use':
            errorMessage = "This email is already registered. Please try logging in instead.";
            break;
          case 'auth/invalid-email':
            errorMessage = "Please provide a valid email address.";
            break;
          case 'auth/weak-password':
            errorMessage = "Password is too weak. Please use a stronger password.";
            break;
          case 'auth/configuration-not-found':
            errorMessage = "Firebase configuration issue. Please check your network connection and try again.";
            break;
          default:
            errorMessage = `Registration failed: ${err.message || err.code || "Unknown error"}`;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      
      toast({
        title: "Registration failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check for Google redirect result on component mount
  useEffect(() => {
    const checkRedirectResult = async () => {
      try {
        const firebaseUser = await handleGoogleRedirect();
        if (firebaseUser) {
          // Got redirect result, handle it
          setIsSubmitting(true);
          
          // We've already checked that firebaseUser is not null above
          const idToken = await firebaseUser!.getIdToken();
          
          await apiRequest("POST", "/api/auth/firebase-link", {
            idToken,
            email: firebaseUser!.email,
            firebaseUid: firebaseUser!.uid,
          });
          
          // Update auth state
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
          
          toast({
            title: "Google login successful",
            description: "You have successfully logged in with Google.",
          });
          
          if (onSuccess) {
            onSuccess();
          }
          
          setIsSubmitting(false);
        }
      } catch (err: any) {
        console.error("Google redirect error:", err);
        setError(err.message || "Failed to login with Google. Please try again.");
        
        toast({
          title: "Google login failed",
          description: err.message || "Failed to login with Google. Please try again.",
          variant: "destructive",
        });
        
        setIsSubmitting(false);
      }
    };
    
    checkRedirectResult();
  }, [onSuccess]);

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Start Google redirect flow
      await firebaseGoogleLogin();
      // The page will redirect, so we'll handle the result in the useEffect
    } catch (err: any) {
      console.error("Google login error:", err);
      setError(err.message || "Failed to login with Google. Please try again.");
      
      toast({
        title: "Google login failed",
        description: err.message || "Failed to login with Google. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>One Capital</CardTitle>
        <CardDescription>
          Sign in or create an account to manage your investments
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>
          
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <TabsContent value="login" className="mt-4">
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="you@example.com" {...field} type="email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </Form>
          </TabsContent>
          
          <TabsContent value="register" className="mt-4">
            <Form {...registerForm}>
              <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                <FormField
                  control={registerForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="username" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={registerForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="you@example.com" {...field} type="email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={registerForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={registerForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Creating Account..." : "Create Account"}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
        
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>
        
        <Button
          variant="outline"
          className="w-full"
          onClick={handleGoogleLogin}
          disabled={isSubmitting}
        >
          <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z" />
          </svg>
          Continue with Google
        </Button>
      </CardContent>
    </Card>
  );
}
