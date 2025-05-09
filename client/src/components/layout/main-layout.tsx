import { ReactNode } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [location] = useLocation();
  
  // Only check auth status on protected routes
  const shouldCheckAuth = !['/', '/login', '/register'].includes(location);
  
  // Auth check for protected routes
  const { data: user } = useQuery({
    queryKey: ["/api/auth/me"],
    enabled: shouldCheckAuth,
    // Auth failure is handled in individual protected pages
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}
