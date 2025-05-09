/**
 * Vault Operations Test Suite
 * 
 * This test simulates the user workflow for interacting with vaults in the One Capital dApp.
 * It tests:
 * 1. Depositing funds into a vault
 * 2. Withdrawing funds from a vault
 * 3. Rebalancing a vault
 * 4. Error handling and transaction feedback
 */

const { expect } = require('chai');
const { randomBytes } = require('crypto');

// Mock contract for testing vault operations
class MockL1XContract {
  constructor() {
    this.vaults = {
      1: {
        id: 1,
        name: 'Test Vault',
        description: 'Existing vault for operations testing',
        rebalanceThreshold: 5,
        isAutomated: true,
        balance: 1000, // Initial balance of 1000 units
        lastRebalance: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week ago
      }
    };
    
    this.allocations = {
      1: [
        { id: 101, vaultId: 1, assetId: 1, percentage: 50, currentPercentage: 55 }, // BTC - drifted up
        { id: 102, vaultId: 1, assetId: 2, percentage: 30, currentPercentage: 25 }, // ETH - drifted down
        { id: 103, vaultId: 1, assetId: 3, percentage: 20, currentPercentage: 20 }  // L1X - unchanged
      ]
    };
    
    this.rebalanceHistory = {
      1: []
    };
  }

  async depositToVault(params) {
    const { vaultId, amount } = params;
    
    if (!this.vaults[vaultId]) {
      throw new Error(`Vault with ID ${vaultId} not found`);
    }
    
    if (amount <= 0) {
      throw new Error('Deposit amount must be greater than zero');
    }
    
    // Update vault balance
    this.vaults[vaultId].balance += amount;
    
    return {
      txHash: `0x${randomBytes(32).toString('hex')}`,
      newBalance: this.vaults[vaultId].balance,
    };
  }

  async withdrawFromVault(params) {
    const { vaultId, amount } = params;
    
    if (!this.vaults[vaultId]) {
      throw new Error(`Vault with ID ${vaultId} not found`);
    }
    
    if (amount <= 0) {
      throw new Error('Withdrawal amount must be greater than zero');
    }
    
    if (amount > this.vaults[vaultId].balance) {
      throw new Error('Insufficient balance for withdrawal');
    }
    
    // Update vault balance
    this.vaults[vaultId].balance -= amount;
    
    return {
      txHash: `0x${randomBytes(32).toString('hex')}`,
      newBalance: this.vaults[vaultId].balance,
    };
  }

  async rebalanceVault(vaultId) {
    if (!this.vaults[vaultId]) {
      throw new Error(`Vault with ID ${vaultId} not found`);
    }
    
    // Check if vault needs rebalancing
    const allocations = this.allocations[vaultId];
    let needsRebalance = false;
    
    for (const allocation of allocations) {
      const drift = Math.abs(allocation.currentPercentage - allocation.percentage);
      if (drift > this.vaults[vaultId].rebalanceThreshold) {
        needsRebalance = true;
        break;
      }
    }
    
    if (!needsRebalance) {
      throw new Error('Vault does not need rebalancing');
    }
    
    // Rebalance the vault - reset current percentages to target
    for (const allocation of allocations) {
      allocation.currentPercentage = allocation.percentage;
    }
    
    // Add to rebalance history
    this.rebalanceHistory[vaultId].push({
      id: randomBytes(4).readUInt32BE(0),
      vaultId,
      timestamp: new Date().toISOString(),
      txHash: `0x${randomBytes(32).toString('hex')}`,
    });
    
    // Update last rebalance time
    this.vaults[vaultId].lastRebalance = new Date().toISOString();
    
    return {
      txHash: this.rebalanceHistory[vaultId].slice(-1)[0].txHash,
      timestamp: this.vaults[vaultId].lastRebalance,
    };
  }

  async getVault(vaultId) {
    return this.vaults[vaultId] || null;
  }

  async getAllocations(vaultId) {
    return this.allocations[vaultId] || [];
  }

  async getRebalanceHistory(vaultId) {
    return this.rebalanceHistory[vaultId] || [];
  }
}

// Mock backend API for testing
class MockBackendAPI {
  constructor(contract) {
    this.contract = contract;
  }

  async getVault(id) {
    return await this.contract.getVault(id);
  }

  async getAllocations(vaultId) {
    return await this.contract.getAllocations(vaultId);
  }

  async depositToVault(params) {
    try {
      const result = await this.contract.depositToVault(params);
      return {
        success: true,
        txHash: result.txHash,
        newBalance: result.newBalance,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async withdrawFromVault(params) {
    try {
      const result = await this.contract.withdrawFromVault(params);
      return {
        success: true,
        txHash: result.txHash,
        newBalance: result.newBalance,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async rebalanceVault(vaultId) {
    try {
      const result = await this.contract.rebalanceVault(vaultId);
      return {
        success: true,
        txHash: result.txHash,
        timestamp: result.timestamp,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getRebalanceHistory(vaultId) {
    return await this.contract.getRebalanceHistory(vaultId);
  }
}

// Mock UI state for testing feedback
class MockUI {
  constructor() {
    this.loading = false;
    this.error = null;
    this.success = null;
    this.toast = null;
  }

  setLoading(isLoading) {
    this.loading = isLoading;
  }

  showError(message) {
    this.error = message;
    this.toast = { type: 'error', message };
    console.log(`[UI Error] ${message}`);
  }

  showSuccess(message) {
    this.success = message;
    this.toast = { type: 'success', message };
    console.log(`[UI Success] ${message}`);
  }

  clearFeedback() {
    this.error = null;
    this.success = null;
    this.toast = null;
  }
}

// Test suite
describe('Vault Operations Workflow', () => {
  let contract;
  let api;
  let ui;
  
  beforeEach(() => {
    // Setup contract, API, and UI for testing
    contract = new MockL1XContract();
    api = new MockBackendAPI(contract);
    ui = new MockUI();
  });
  
  it('should deposit funds into a vault', async () => {
    // Initialize UI state
    ui.setLoading(true);
    ui.clearFeedback();
    
    const depositParams = {
      vaultId: 1,
      amount: 500,
    };
    
    // Get initial vault state
    const initialVault = await api.getVault(depositParams.vaultId);
    const initialBalance = initialVault.balance;
    
    // Process deposit
    const result = await api.depositToVault(depositParams);
    
    // Update UI
    ui.setLoading(false);
    
    if (result.success) {
      ui.showSuccess(`Successfully deposited ${depositParams.amount} units to vault`);
    } else {
      ui.showError(`Deposit failed: ${result.error}`);
    }
    
    // Verify results
    expect(result.success).to.be.true;
    expect(result).to.have.property('txHash');
    expect(result).to.have.property('newBalance', initialBalance + depositParams.amount);
    
    // Verify UI feedback
    expect(ui.loading).to.be.false;
    expect(ui.error).to.be.null;
    expect(ui.success).to.contain('Successfully deposited');
    expect(ui.toast).to.have.property('type', 'success');
    
    // Verify vault state updated
    const updatedVault = await api.getVault(depositParams.vaultId);
    expect(updatedVault.balance).to.equal(initialBalance + depositParams.amount);
  });
  
  it('should handle deposit errors properly', async () => {
    ui.setLoading(true);
    ui.clearFeedback();
    
    const invalidDepositParams = {
      vaultId: 1,
      amount: -100, // Invalid negative amount
    };
    
    // Process invalid deposit
    const result = await api.depositToVault(invalidDepositParams);
    
    // Update UI
    ui.setLoading(false);
    
    if (result.success) {
      ui.showSuccess(`Successfully deposited ${invalidDepositParams.amount} units to vault`);
    } else {
      ui.showError(`Deposit failed: ${result.error}`);
    }
    
    // Verify results
    expect(result.success).to.be.false;
    expect(result).to.have.property('error').that.includes('must be greater than zero');
    
    // Verify UI feedback
    expect(ui.loading).to.be.false;
    expect(ui.error).to.contain('Deposit failed');
    expect(ui.success).to.be.null;
    expect(ui.toast).to.have.property('type', 'error');
  });
  
  it('should withdraw funds from a vault', async () => {
    ui.setLoading(true);
    ui.clearFeedback();
    
    const withdrawParams = {
      vaultId: 1,
      amount: 200,
    };
    
    // Get initial vault state
    const initialVault = await api.getVault(withdrawParams.vaultId);
    const initialBalance = initialVault.balance;
    
    // Process withdrawal
    const result = await api.withdrawFromVault(withdrawParams);
    
    // Update UI
    ui.setLoading(false);
    
    if (result.success) {
      ui.showSuccess(`Successfully withdrew ${withdrawParams.amount} units from vault`);
    } else {
      ui.showError(`Withdrawal failed: ${result.error}`);
    }
    
    // Verify results
    expect(result.success).to.be.true;
    expect(result).to.have.property('txHash');
    expect(result).to.have.property('newBalance', initialBalance - withdrawParams.amount);
    
    // Verify UI feedback
    expect(ui.loading).to.be.false;
    expect(ui.error).to.be.null;
    expect(ui.success).to.contain('Successfully withdrew');
    
    // Verify vault state updated
    const updatedVault = await api.getVault(withdrawParams.vaultId);
    expect(updatedVault.balance).to.equal(initialBalance - withdrawParams.amount);
  });
  
  it('should prevent excessive withdrawals', async () => {
    ui.setLoading(true);
    ui.clearFeedback();
    
    const vault = await api.getVault(1);
    const excessiveWithdrawParams = {
      vaultId: 1,
      amount: vault.balance + 100, // More than available balance
    };
    
    // Process excessive withdrawal
    const result = await api.withdrawFromVault(excessiveWithdrawParams);
    
    // Update UI
    ui.setLoading(false);
    
    if (result.success) {
      ui.showSuccess(`Successfully withdrew ${excessiveWithdrawParams.amount} units from vault`);
    } else {
      ui.showError(`Withdrawal failed: ${result.error}`);
    }
    
    // Verify results
    expect(result.success).to.be.false;
    expect(result).to.have.property('error').that.includes('Insufficient balance');
    
    // Verify UI feedback
    expect(ui.loading).to.be.false;
    expect(ui.error).to.contain('Withdrawal failed');
    expect(ui.success).to.be.null;
    
    // Verify vault state unchanged
    const updatedVault = await api.getVault(1);
    expect(updatedVault.balance).to.equal(vault.balance);
  });
  
  it('should rebalance a vault with drifted allocations', async () => {
    ui.setLoading(true);
    ui.clearFeedback();
    
    const vaultId = 1;
    
    // Get initial allocations
    const initialAllocations = await api.getAllocations(vaultId);
    const initialHistoryLength = (await api.getRebalanceHistory(vaultId)).length;
    
    // Process rebalance
    const result = await api.rebalanceVault(vaultId);
    
    // Update UI
    ui.setLoading(false);
    
    if (result.success) {
      ui.showSuccess(`Successfully rebalanced vault to target allocations`);
    } else {
      ui.showError(`Rebalance failed: ${result.error}`);
    }
    
    // Verify results
    expect(result.success).to.be.true;
    expect(result).to.have.property('txHash');
    expect(result).to.have.property('timestamp');
    
    // Verify UI feedback
    expect(ui.loading).to.be.false;
    expect(ui.error).to.be.null;
    expect(ui.success).to.contain('Successfully rebalanced');
    
    // Verify allocations reset to target percentages
    const updatedAllocations = await api.getAllocations(vaultId);
    for (let i = 0; i < updatedAllocations.length; i++) {
      expect(updatedAllocations[i].currentPercentage).to.equal(updatedAllocations[i].percentage);
    }
    
    // Verify rebalance history updated
    const history = await api.getRebalanceHistory(vaultId);
    expect(history).to.have.lengthOf(initialHistoryLength + 1);
    expect(history[history.length - 1]).to.have.property('txHash', result.txHash);
  });
  
  it('should prevent unnecessary rebalances', async () => {
    // First rebalance to get to target allocations
    await api.rebalanceVault(1);
    
    ui.setLoading(true);
    ui.clearFeedback();
    
    // Try to rebalance again immediately
    const result = await api.rebalanceVault(1);
    
    // Update UI
    ui.setLoading(false);
    
    if (result.success) {
      ui.showSuccess(`Successfully rebalanced vault to target allocations`);
    } else {
      ui.showError(`Rebalance failed: ${result.error}`);
    }
    
    // Verify results
    expect(result.success).to.be.false;
    expect(result).to.have.property('error').that.includes('does not need rebalancing');
    
    // Verify UI feedback
    expect(ui.loading).to.be.false;
    expect(ui.error).to.contain('Rebalance failed');
    expect(ui.success).to.be.null;
  });
  
  it('should verify data flow and sync between contract, backend, and UI', async () => {
    // 1. Make a change at the contract level
    const depositAmount = 300;
    await contract.depositToVault({ vaultId: 1, amount: depositAmount });
    
    // 2. Backend fetches updated state from contract
    const backendVault = await api.getVault(1);
    
    // 3. UI fetches from backend and updates display
    ui.clearFeedback();
    
    // Simulate UI fetching and displaying vault data
    const displayedVault = await api.getVault(1);
    ui.showSuccess(`Vault balance updated: ${displayedVault.balance} units`);
    
    // Verify data flow integrity
    expect(displayedVault.balance).to.equal(backendVault.balance);
    expect(ui.success).to.contain(`${backendVault.balance}`);
    
    // 4. UI initiates a withdrawal transaction
    ui.setLoading(true);
    ui.clearFeedback();
    
    const withdrawResult = await api.withdrawFromVault({ vaultId: 1, amount: 100 });
    
    ui.setLoading(false);
    if (withdrawResult.success) {
      ui.showSuccess(`Withdrawal successful. New balance: ${withdrawResult.newBalance}`);
    } else {
      ui.showError(`Withdrawal failed: ${withdrawResult.error}`);
    }
    
    // 5. Verify contract state, backend state, and UI state are all synchronized
    const finalContractVault = await contract.getVault(1);
    const finalBackendVault = await api.getVault(1);
    
    expect(finalContractVault.balance).to.equal(finalBackendVault.balance);
    expect(ui.success).to.contain(`${finalBackendVault.balance}`);
  });
});

// This is just a test implementation - it would be run with a proper test runner in a real environment
console.log('Vault Operations Tests: These tests require a proper test runner to execute.');
console.log('To run them: npm install --save-dev mocha chai && npx mocha testing/functional/vaultOperationsTest.js');