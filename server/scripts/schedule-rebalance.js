/**
 * Scheduled Rebalancing Script for One Capital Auto-Investing
 * 
 * This script runs as a scheduled job to rebalance portfolios
 * based on time-based triggers and drift thresholds.
 */

import { db } from '../db.js';
import { vaults, allocations, priceFeeds, rebalanceHistory } from '../../shared/schema.js';
import { eq, desc, and, lt, gt } from 'drizzle-orm';
import { schedule } from 'node-schedule';

// Rebalance threshold in basis points (3%)
const DRIFT_THRESHOLD_BP = 300;

// Configure logging
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

/**
 * Check if a vault needs rebalancing based on current allocations vs target
 */
async function vaultNeedsRebalancing(vaultId) {
  try {
    // Get vault allocations
    const vaultAllocations = await db
      .select()
      .from(allocations)
      .where(eq(allocations.vaultId, vaultId));
    
    if (vaultAllocations.length === 0) {
      return false;
    }
    
    // Get latest prices for all assets in the vault
    const assetIds = vaultAllocations.map(allocation => allocation.assetId);
    
    // Create a map to hold the latest price for each asset
    const latestPrices = new Map();
    
    for (const assetId of assetIds) {
      const [latestPrice] = await db
        .select()
        .from(priceFeeds)
        .where(eq(priceFeeds.assetId, assetId))
        .orderBy(desc(priceFeeds.timestamp))
        .limit(1);
      
      if (latestPrice) {
        latestPrices.set(assetId, latestPrice.price);
      }
    }
    
    // Calculate current values and total value
    let totalValue = 0;
    const currentValues = [];
    
    for (const allocation of vaultAllocations) {
      const assetPrice = latestPrices.get(allocation.assetId);
      if (!assetPrice) continue;
      
      // In a real implementation, we would get the actual asset balance from the blockchain
      // For this demo, we'll simulate based on target percentages
      const targetValue = allocation.targetPercentage.toNumber() / 100;
      // Add some drift to simulate market movements
      const driftFactor = 0.9 + Math.random() * 0.2; // 0.9 to 1.1 drift factor
      const currentValue = targetValue * driftFactor;
      
      currentValues.push({
        assetId: allocation.assetId,
        currentValue,
      });
      
      totalValue += currentValue;
    }
    
    // Calculate current percentages and check for drift
    for (const value of currentValues) {
      const currentPercentage = (value.currentValue / totalValue) * 100;
      
      // Find target percentage for this asset
      const allocation = vaultAllocations.find(a => a.assetId === value.assetId);
      if (!allocation) continue;
      
      const targetPercentage = allocation.targetPercentage.toNumber();
      const drift = Math.abs(currentPercentage - targetPercentage);
      
      // If drift exceeds threshold, rebalancing is needed
      if (drift > (DRIFT_THRESHOLD_BP / 100)) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    log(`Error checking if vault ${vaultId} needs rebalancing: ${error.message}`);
    return false;
  }
}

/**
 * Create a rebalance history record for a vault
 */
async function createRebalanceRecord(vaultId) {
  try {
    // In a real implementation, this would execute actual rebalancing through L1X smart contracts
    // For now, we'll just create a rebalance history record
    
    // Mock transactions for rebalancing
    const mockTransactions = [
      {
        source: "BTC",
        target: "ETH",
        amount: "0.05",
        value: "2000.00"
      }
    ];
    
    // Create rebalance history record
    const [record] = await db
      .insert(rebalanceHistory)
      .values({
        vaultId,
        transactions: mockTransactions,
        status: "completed"
      })
      .returning();
    
    log(`Created rebalance record ${record.id} for vault ${vaultId}`);
    
    return record;
  } catch (error) {
    log(`Error creating rebalance record for vault ${vaultId}: ${error.message}`);
    throw error;
  }
}

/**
 * Process all vaults and rebalance if needed
 */
async function processVaults() {
  try {
    log("Starting scheduled rebalance process");
    
    // Get all active custodial vaults
    const activeVaults = await db
      .select()
      .from(vaults)
      .where(eq(vaults.isCustodial, true));
    
    log(`Found ${activeVaults.length} active custodial vaults`);
    
    let rebalancedCount = 0;
    
    // Check each vault for rebalancing
    for (const vault of activeVaults) {
      const needsRebalancing = await vaultNeedsRebalancing(vault.id);
      
      if (needsRebalancing) {
        log(`Vault ${vault.id} needs rebalancing`);
        await createRebalanceRecord(vault.id);
        rebalancedCount++;
      } else {
        log(`Vault ${vault.id} does not need rebalancing`);
      }
    }
    
    log(`Completed rebalance process. Rebalanced ${rebalancedCount} vaults.`);
  } catch (error) {
    log(`Error in rebalance process: ${error.message}`);
  }
}

/**
 * Schedule the rebalancing job
 */
function scheduleRebalancing() {
  // Schedule to run every 24 hours at 2 AM
  const job = schedule.scheduleJob('0 2 * * *', processVaults);
  
  log(`Scheduled rebalancing job to run at ${job.nextInvocation()}`);
  
  // Also provide a way to run manually
  return {
    runNow: processVaults,
    getNextRun: () => job.nextInvocation(),
    cancelJob: () => job.cancel()
  };
}

// Export the scheduler
export const rebalanceScheduler = scheduleRebalancing();

// If this script is run directly, execute a rebalance immediately
if (process.argv[1] === import.meta.url) {
  log("Manual rebalance triggered");
  processVaults().then(() => {
    log("Manual rebalance completed");
    process.exit(0);
  }).catch(error => {
    log(`Error in manual rebalance: ${error.message}`);
    process.exit(1);
  });
}
