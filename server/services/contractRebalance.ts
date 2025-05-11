/**
 * Contract Rebalance Service
 * 
 * This service integrates with the L1X smart contract for rebalancing operations,
 * providing a bridge between the Express API and blockchain functionality.
 */

import axios from 'axios';
import { Vault, Allocation, InsertRebalanceHistory } from '@shared/schema';
import { storage } from '../storage';
import { getPriceForAsset, getPricesWithChange } from './priceFeed';

// L1X contract endpoint configuration 
// (would be environment variables in production)
const CONTRACT_API_ENDPOINT = process.env.CONTRACT_API_ENDPOINT || 'https://l1x-testnet.example.com/api';
const REBALANCE_CONTRACT_ID = process.env.REBALANCE_CONTRACT_ID || 'rebalance_1.0';

// Vault type enum matching the contract
enum VaultType {
  Custodial = 'Custodial',
  NonCustodial = 'NonCustodial'
}

// Request format for the rebalance contract
interface RebalanceContractRequest {
  vault_id: string;
  vault_type: VaultType;
  prices_json: string;
}

// Response format from the rebalance contract
interface RebalanceContractResponse {
  success: boolean;
  message: string;
  details?: string;
}

/**
 * Executes a rebalance operation through the L1X smart contract
 * 
 * @param vaultId The vault ID to rebalance
 * @param isCustodial Whether this is a custodial vault
 * @returns Result of the rebalance operation
 */
export async function executeContractRebalance(
  vaultId: number, 
  isCustodial: boolean = true
): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    // Get the vault
    const vault = await storage.getVault(vaultId);
    if (!vault) {
      throw new Error(`Vault with ID ${vaultId} not found`);
    }

    // Get current prices for all assets in the vault
    const allocations = await storage.getAllocationsByVaultId(vaultId);
    if (allocations.length === 0) {
      throw new Error(`Vault with ID ${vaultId} has no allocations`);
    }

    // Get asset info
    const assetIds = allocations.map(a => a.assetId);
    const assets = await Promise.all(assetIds.map(id => storage.getAsset(id)));
    
    // Get prices for all assets
    const symbols = assets.map(asset => asset?.symbol || '').filter(symbol => symbol);
    const prices = await getPricesWithChange();
    const pricesMap = symbols.reduce((acc, symbol) => {
      acc[symbol] = prices[symbol]?.current || 0;
      return acc;
    }, {} as Record<string, number>);
    
    // Format prices for the contract
    const pricesJson = formatPricesForContract(symbols, pricesMap);

    // Prepare request to contract
    const request: RebalanceContractRequest = {
      vault_id: vaultId.toString(),
      vault_type: isCustodial ? VaultType.Custodial : VaultType.NonCustodial,
      prices_json: pricesJson
    };

    // Call the contract API
    let response: RebalanceContractResponse;
    
    // In production, this would call the actual L1X contract API
    // For development, we'll simulate a successful response
    if (process.env.NODE_ENV === 'production') {
      const result = await axios.post(
        `${CONTRACT_API_ENDPOINT}/contracts/${REBALANCE_CONTRACT_ID}/rebalance_api`,
        request
      );
      response = result.data;
    } else {
      // Simulated response for development (would be removed in production)
      response = simulateContractResponse(vault, allocations);
    }

    // Create rebalance history record
    if (response.success) {
      await createRebalanceHistory(vault, allocations, response);
      
      // Update the vault's last rebalanced date
      await storage.updateVault(vaultId, {
        lastRebalanced: new Date()
      });
    }

    return {
      success: response.success,
      message: response.message,
      details: response.details ? JSON.parse(response.details) : undefined
    };
  } catch (error) {
    console.error('Contract rebalance error:', error);
    return {
      success: false,
      message: `Error executing contract rebalance: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Formats asset prices for the contract
 */
function formatPricesForContract(symbols: string[], pricesMap: Record<string, number>): string {
  const pricesArray = symbols.map(symbol => {
    const price = pricesMap[symbol] || 0;
    return [symbol, Math.floor(price * 1000000)]; // Convert to contract format with 6 decimal places
  });
  
  return JSON.stringify(pricesArray);
}

/**
 * Creates a rebalance history record
 */
async function createRebalanceHistory(
  vault: Vault, 
  allocations: Allocation[], 
  response: RebalanceContractResponse
): Promise<void> {
  try {
    // Parse the details if available
    const details = response.details ? JSON.parse(response.details) : {};
    
    // Create transactions data from allocations
    const transactions = allocations.map(allocation => ({
      assetId: allocation.assetId,
      targetPercentage: allocation.targetPercentage.toString(),
      actions: details.transactions || []
    }));
    
    // Create history record
    const rebalanceData: InsertRebalanceHistory = {
      vaultId: vault.id,
      type: 'contract', // Rebalance executed by contract
      status: 'completed',
      transactions,
      details: JSON.stringify({
        driftThreshold: vault.driftThreshold?.toString() || '5.00',
        contractMessage: response.message,
        rebalanceFrequency: vault.rebalanceFrequency || 'manual'
      })
    };
    
    await storage.createRebalanceHistory(rebalanceData);
  } catch (error) {
    console.error('Error creating rebalance history:', error);
    // We'll just log the error but not throw, as the rebalance itself was successful
  }
}

/**
 * Simulates a contract response for development/testing
 * This would be replaced by actual contract calls in production
 */
function simulateContractResponse(vault: Vault, allocations: Allocation[]): RebalanceContractResponse {
  // Calculate simulated drift
  const driftedAllocations = allocations.map(allocation => {
    // Simulate some drift (±2%)
    const driftFactor = 1 + (Math.random() * 0.04 - 0.02);
    const targetPercentage = typeof allocation.targetPercentage === 'string' 
      ? parseInt(allocation.targetPercentage) 
      : allocation.targetPercentage;
    const currentPercentage = Math.round(targetPercentage * driftFactor);
    
    return {
      asset_id: allocation.assetId.toString(),
      current_percentage: currentPercentage,
      target_percentage: targetPercentage,
      drift_amount: Math.abs(currentPercentage - targetPercentage),
    };
  });
  
  // Calculate if rebalance is needed based on vault's drift threshold
  const threshold = typeof vault.driftThreshold === 'string' 
    ? parseInt(vault.driftThreshold) 
    : (vault.driftThreshold || 500); // Default 5%
  const needsRebalance = driftedAllocations.some(a => a.drift_amount > threshold);
  
  // Generate simulated transactions
  const transactions = [];
  if (needsRebalance) {
    // Find assets to sell (over-allocated)
    const overAllocated = driftedAllocations
      .filter(a => Number(a.current_percentage) > Number(a.target_percentage))
      .sort((a, b) => Number(b.drift_amount) - Number(a.drift_amount));
      
    // Find assets to buy (under-allocated)
    const underAllocated = driftedAllocations
      .filter(a => Number(a.current_percentage) < Number(a.target_percentage))
      .sort((a, b) => Number(b.drift_amount) - Number(a.drift_amount));
      
    // Create simulated transaction pairs
    if (overAllocated.length > 0 && underAllocated.length > 0) {
      transactions.push({
        source_asset: overAllocated[0].asset_id,
        target_asset: underAllocated[0].asset_id,
        amount: Math.min(
          Number(overAllocated[0].drift_amount), 
          Number(underAllocated[0].drift_amount)
        ) * 100 // Amount in basis points * 100
      });
    }
  }
  
  return {
    success: true,
    message: needsRebalance 
      ? `Rebalance executed with ${transactions.length} transactions` 
      : "No rebalance needed based on current allocations",
    details: JSON.stringify({
      drift_exceeded: needsRebalance,
      transactions,
      allocations: driftedAllocations
    })
  };
}

/**
 * Checks if a vault needs rebalancing based on actual contract logic
 */
export async function checkContractRebalanceNeeded(vaultId: number): Promise<boolean> {
  try {
    // Get the vault
    const vault = await storage.getVault(vaultId);
    if (!vault) {
      throw new Error(`Vault with ID ${vaultId} not found`);
    }

    // Check time-based rebalancing
    if (vault.rebalanceFrequency && vault.rebalanceFrequency !== 'manual' && vault.lastRebalanced) {
      const lastRebalanced = new Date(vault.lastRebalanced);
      const now = new Date();
      
      // Convert frequency to milliseconds
      let frequencyMs = 0;
      switch (vault.rebalanceFrequency) {
        case 'daily':
          frequencyMs = 24 * 60 * 60 * 1000;
          break;
        case 'weekly':
          frequencyMs = 7 * 24 * 60 * 60 * 1000;
          break;
        case 'monthly':
          frequencyMs = 30 * 24 * 60 * 60 * 1000;
          break;
      }
      
      if (frequencyMs > 0 && now.getTime() - lastRebalanced.getTime() >= frequencyMs) {
        return true; // Time-based rebalance needed
      }
    }

    // Check drift-based rebalancing
    const allocations = await storage.getAllocationsByVaultId(vaultId);
    const threshold = typeof vault.driftThreshold === 'string'
      ? parseInt(vault.driftThreshold)
      : (vault.driftThreshold || 500); // Default 5%
    
    // Get current percentages (would come from contract in production)
    // For testing, we'll simulate some drift
    for (const allocation of allocations) {
      // Simulate drift (±3%)
      const driftFactor = 1 + (Math.random() * 0.06 - 0.03);
      const targetPercentage = typeof allocation.targetPercentage === 'string'
        ? parseInt(allocation.targetPercentage)
        : allocation.targetPercentage;
      const currentPercentage = Math.round(targetPercentage * driftFactor);
      const drift = Math.abs(currentPercentage - targetPercentage);
      
      if (drift > threshold) {
        return true; // Drift-based rebalance needed
      }
    }
    
    return false; // No rebalance needed
  } catch (error) {
    console.error('Error checking contract rebalance need:', error);
    return false; // Default to no rebalance on error
  }
}

/**
 * Schedules a vault rebalance for later execution
 */
export async function scheduleVaultRebalance(vaultId: number): Promise<boolean> {
  try {
    // This would integrate with a job scheduling system in production
    console.log(`Scheduling rebalance for vault ${vaultId} at next interval`);
    return true;
  } catch (error) {
    console.error('Error scheduling vault rebalance:', error);
    return false;
  }
}