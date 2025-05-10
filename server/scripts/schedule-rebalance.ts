/**
 * Scheduled Rebalancing Script for One Capital Auto-Investing
 * 
 * This script runs as a scheduled job to rebalance portfolios
 * based on time-based triggers and drift thresholds.
 */

import * as schedule from 'node-schedule';
import { storage } from '../storage';
import { Vault, Allocation, InsertRebalanceHistory } from '@shared/schema';
import { getPrice } from '../services/priceFeed';
import { log } from '../vite';

// Configuration
const DRIFT_THRESHOLD = 0.05; // 5% drift threshold
const REBALANCE_INTERVAL = '0 */8 * * *'; // Every 8 hours

/**
 * Log with timestamp prefix
 */
function logRebalance(message: string): void {
  log(`[Rebalance] ${message}`, 'rebalance');
}

/**
 * Check if a vault needs rebalancing based on current allocations vs target
 * 
 * Rebalancing is needed when:
 * 1. Any asset's current allocation deviates from its target by more than the threshold
 * 2. The vault hasn't been rebalanced in the configured interval
 */
async function vaultNeedsRebalancing(vaultId: number): Promise<boolean> {
  try {
    // Get the vault
    const vault = await storage.getVault(vaultId);
    if (!vault) {
      logRebalance(`Vault ${vaultId} not found`);
      return false;
    }
    
    // Get current allocations
    const allocations = await storage.getAllocationsByVaultId(vaultId);
    if (allocations.length === 0) {
      logRebalance(`Vault ${vaultId} has no allocations`);
      return false;
    }
    
    // Calculate current values and total value
    let totalValue = 0;
    const currentValues: Record<number, number> = {};
    
    for (const allocation of allocations) {
      const asset = await storage.getAsset(allocation.assetId);
      if (!asset) continue;
      
      const price = await getPrice(asset.symbol);
      if (price === null) continue;
      
      const value = allocation.tokenAmount * price;
      currentValues[allocation.assetId] = value;
      totalValue += value;
    }
    
    if (totalValue === 0) {
      logRebalance(`Vault ${vaultId} has no value`);
      return false;
    }
    
    // Check for drift from target allocations
    for (const allocation of allocations) {
      const currentValue = currentValues[allocation.assetId] || 0;
      const currentPercentage = currentValue / totalValue;
      const targetPercentage = allocation.percentage / 100;
      
      const drift = Math.abs(currentPercentage - targetPercentage);
      
      if (drift > DRIFT_THRESHOLD) {
        logRebalance(`Vault ${vaultId} needs rebalancing due to drift of ${drift.toFixed(4)} for asset ${allocation.assetId}`);
        return true;
      }
    }
    
    // Check time since last rebalance
    const rebalanceHistory = await storage.getRebalanceHistoryByVaultId(vaultId);
    if (rebalanceHistory.length === 0) {
      logRebalance(`Vault ${vaultId} has never been rebalanced`);
      return true;
    }
    
    // Sort by timestamp descending to get latest
    const latestRebalance = rebalanceHistory.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0];
    
    const now = new Date();
    const lastRebalanceTime = new Date(latestRebalance.timestamp);
    const hoursSinceLastRebalance = (now.getTime() - lastRebalanceTime.getTime()) / (1000 * 60 * 60);
    
    // If it's been more than 24 hours since last rebalance, rebalance again
    if (hoursSinceLastRebalance > 24) {
      logRebalance(`Vault ${vaultId} needs rebalancing due to time (${hoursSinceLastRebalance.toFixed(2)} hours since last rebalance)`);
      return true;
    }
    
    logRebalance(`Vault ${vaultId} does not need rebalancing`);
    return false;
  } catch (error) {
    logRebalance(`Error checking if vault ${vaultId} needs rebalancing: ${error}`);
    return false;
  }
}

/**
 * Create a rebalance history record for a vault
 */
async function createRebalanceRecord(vaultId: number): Promise<void> {
  try {
    const vault = await storage.getVault(vaultId);
    if (!vault) {
      logRebalance(`Failed to create rebalance record: Vault ${vaultId} not found`);
      return;
    }
    
    const rebalanceRecord: InsertRebalanceHistory = {
      vaultId,
      timestamp: new Date().toISOString(),
      status: 'completed',
      txHash: `mock_tx_${Date.now()}` // In a real implementation, this would be the hash of the blockchain transaction
    };
    
    await storage.createRebalanceHistory(rebalanceRecord);
    logRebalance(`Created rebalance record for vault ${vaultId}`);
  } catch (error) {
    logRebalance(`Error creating rebalance record for vault ${vaultId}: ${error}`);
  }
}

/**
 * Process all vaults and rebalance if needed
 */
async function processVaults(): Promise<void> {
  try {
    // Get all vaults
    const vaults = await storage.getAllVaults();
    
    logRebalance(`Processing ${vaults.length} vaults for rebalancing`);
    
    for (const vault of vaults) {
      // Skip vaults with auto-rebalancing disabled
      if (!vault.autoRebalance) {
        logRebalance(`Skipping vault ${vault.id} (auto-rebalancing disabled)`);
        continue;
      }
      
      // Check if rebalancing is needed
      const needsRebalancing = await vaultNeedsRebalancing(vault.id);
      
      if (needsRebalancing) {
        logRebalance(`Rebalancing vault ${vault.id} - ${vault.name}`);
        
        // In a real implementation, we would:
        // 1. Connect to the L1X network
        // 2. Load the vault contract
        // 3. Execute on-chain rebalancing
        
        // For now, just create a record of the rebalance
        await createRebalanceRecord(vault.id);
      }
    }
  } catch (error) {
    logRebalance(`Error processing vaults: ${error}`);
  }
}

/**
 * Schedule the rebalancing job
 */
export function scheduleRebalancing(): schedule.Job {
  logRebalance('Scheduling automated rebalancing');
  
  // Run immediately on startup
  processVaults();
  
  // Schedule regular runs
  return schedule.scheduleJob(REBALANCE_INTERVAL, () => {
    logRebalance('Running scheduled rebalancing');
    processVaults();
  });
}

// Don't start automatically when imported as module
if (require.main === module) {
  scheduleRebalancing();
}