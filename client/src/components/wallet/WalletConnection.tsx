import React, { useState } from 'react';
import { WalletType, useWallet } from '@/lib/walletContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wallet, LogOut, ChevronDown, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function WalletConnection() {
  const { 
    walletType, 
    walletAddress, 
    isConnected, 
    isConnecting, 
    error,
    connectL1X, 
    connectMetaMask, 
    disconnectWallet 
  } = useWallet();
  
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  // Format wallet address for display (truncate middle)
  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // Get wallet name based on type
  const getWalletName = (type: WalletType) => {
    switch (type) {
      case 'l1x':
        return 'L1X Wallet';
      case 'metamask':
        return 'MetaMask';
      default:
        return 'Wallet';
    }
  };

  // Handle wallet connection
  const handleConnect = async (walletType: 'l1x' | 'metamask') => {
    try {
      if (walletType === 'l1x') {
        await connectL1X();
      } else {
        await connectMetaMask();
      }
      setIsWalletModalOpen(false);
    } catch (error) {
      console.error(`Error connecting to ${walletType} wallet:`, error);
    }
  };

  // Handle wallet disconnection
  const handleDisconnect = () => {
    disconnectWallet();
  };

  // Render connect button or wallet info
  if (isConnected && walletAddress) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className={cn(
              "flex items-center gap-2",
              walletType === 'l1x' ? "border-blue-400 text-blue-500" : 
              walletType === 'metamask' ? "border-orange-400 text-orange-500" : ""
            )}
          >
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">{formatAddress(walletAddress)}</span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="flex flex-col space-y-2 p-2">
            <p className="text-xs text-muted-foreground">Connected to</p>
            <p className="font-medium">{getWalletName(walletType)}</p>
            <p className="text-xs font-mono text-muted-foreground break-all">{walletAddress}</p>
          </div>
          <DropdownMenuItem 
            className="flex cursor-pointer items-center text-destructive focus:text-destructive gap-2"
            onClick={handleDisconnect}
          >
            <LogOut className="h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      <Button 
        variant="outline" 
        className="flex items-center gap-2"
        onClick={() => setIsWalletModalOpen(true)}
        disabled={isConnecting}
      >
        <Wallet className="h-4 w-4" />
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </Button>

      <Dialog open={isWalletModalOpen} onOpenChange={setIsWalletModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect Wallet</DialogTitle>
            <DialogDescription>
              Choose your preferred wallet to connect to One Capital
            </DialogDescription>
          </DialogHeader>
          
          {error && (
            <Alert variant="destructive" className="my-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-4 py-4">
            <Button
              variant="outline"
              className="flex items-center justify-between p-6 border-blue-200 hover:border-blue-400 hover:bg-blue-50"
              onClick={() => handleConnect('l1x')}
              disabled={isConnecting}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">L1</div>
                <span className="font-medium">L1X Wallet</span>
              </div>
              <span className="text-xs text-muted-foreground">L1X Network</span>
            </Button>

            <Button
              variant="outline"
              className="flex items-center justify-between p-6 border-orange-200 hover:border-orange-400 hover:bg-orange-50"
              onClick={() => handleConnect('metamask')}
              disabled={isConnecting}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8">
                  <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M34.0223 3.5L22.2914 13.9341L24.7855 7.61318L34.0223 3.5Z" fill="#E17726" stroke="#E17726" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M5.9765 3.5L17.6337 14.0118L15.2145 7.61318L5.9765 3.5Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M29.4033 26.7151L25.9775 32.1883L33.2753 34.2857L35.3726 26.8417L29.4033 26.7151Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4.63861 26.8417L6.7248 34.2857L14.0113 32.1883L10.5967 26.7151L4.63861 26.8417Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M13.5803 17.7113L11.3875 20.8815L18.5998 21.2413L18.3233 13.4243L13.5803 17.7113Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M26.4197 17.7114L21.6212 13.3467L21.4002 21.2414L28.6125 20.8816L26.4197 17.7114Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M14.0112 32.1882L18.0932 30.0843L14.6231 26.8862L14.0112 32.1882Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21.9067 30.0843L25.9776 32.1882L25.3769 26.8862L21.9067 30.0843Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="font-medium">MetaMask</span>
              </div>
              <span className="text-xs text-muted-foreground">EVM Compatible</span>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            By connecting your wallet, you agree to the Terms of Service and Privacy Policy
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}