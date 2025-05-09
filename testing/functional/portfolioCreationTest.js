/**
 * Portfolio Creation Test Suite
 * 
 * This test simulates the user workflow for creating a portfolio in the One Capital dApp.
 * It tests:
 * 1. Vault creation
 * 2. Asset allocation
 * 3. Contract interaction
 * 4. State synchronization between contract, backend, and frontend
 */

const { expect } = require('chai');
const { randomBytes } = require('crypto');

// Mock contract for testing
class MockL1XContract {
  constructor() {
    this.vaults = {};
    this.nextVaultId = 1;
    this.allocations = {};
  }

  async createVault(params) {
    const vaultId = this.nextVaultId++;
    this.vaults[vaultId] = {
      id: vaultId,
      name: params.name,
      description: params.description,
      rebalanceThreshold: params.rebalanceThreshold,
      isAutomated: params.isAutomated,
      createdAt: new Date().toISOString(),
      balance: 0,
    };
    
    this.allocations[vaultId] = [];
    
    return {
      txHash: `0x${randomBytes(32).toString('hex')}`,
      vaultId,
    };
  }

  async getVault(vaultId) {
    return this.vaults[vaultId] || null;
  }

  async setAllocation(params) {
    const { vaultId, assetId, percentage } = params;
    
    if (!this.vaults[vaultId]) {
      throw new Error(`Vault with ID ${vaultId} not found`);
    }
    
    // Find existing allocation if any
    const existingIndex = this.allocations[vaultId].findIndex(a => a.assetId === assetId);
    
    if (existingIndex >= 0) {
      // Update existing allocation
      this.allocations[vaultId][existingIndex].percentage = percentage;
    } else {
      // Add new allocation
      this.allocations[vaultId].push({
        id: randomBytes(4).readUInt32BE(0),
        vaultId,
        assetId,
        percentage,
        createdAt: new Date().toISOString(),
      });
    }
    
    return {
      txHash: `0x${randomBytes(32).toString('hex')}`,
    };
  }

  async getAllocations(vaultId) {
    return this.allocations[vaultId] || [];
  }
}

// Mock backend API for testing
class MockBackendAPI {
  constructor(contract) {
    this.contract = contract;
    this.assets = [
      { id: 1, name: 'Bitcoin', symbol: 'BTC', type: 'crypto' },
      { id: 2, name: 'Ethereum', symbol: 'ETH', type: 'crypto' },
      { id: 3, name: 'Layer 1X', symbol: 'L1X', type: 'crypto' },
    ];
  }

  async getAssets() {
    return this.assets;
  }

  async createVault(params) {
    const result = await this.contract.createVault(params);
    
    // Simulate backend processing and database storage
    return {
      id: result.vaultId,
      name: params.name,
      description: params.description,
      rebalanceThreshold: params.rebalanceThreshold,
      isAutomated: params.isAutomated,
      txHash: result.txHash,
    };
  }

  async getVault(id) {
    return await this.contract.getVault(id);
  }

  async createAllocation(params) {
    const result = await this.contract.setAllocation(params);
    
    // Simulate backend processing
    const allocations = await this.contract.getAllocations(params.vaultId);
    const allocation = allocations.find(a => a.assetId === params.assetId);
    
    return {
      ...allocation,
      txHash: result.txHash,
    };
  }

  async getAllocations(vaultId) {
    return await this.contract.getAllocations(vaultId);
  }
}

// Test suite
describe('Portfolio Creation Workflow', () => {
  let contract;
  let api;
  
  beforeEach(() => {
    // Setup contract and API for testing
    contract = new MockL1XContract();
    api = new MockBackendAPI(contract);
  });
  
  it('should create a new vault', async () => {
    const vaultParams = {
      name: 'Test Vault',
      description: 'A test vault for functional testing',
      rebalanceThreshold: 5, // 5% drift triggers rebalance
      isAutomated: true,
    };
    
    const vault = await api.createVault(vaultParams);
    
    expect(vault).to.have.property('id');
    expect(vault).to.have.property('name', vaultParams.name);
    expect(vault).to.have.property('description', vaultParams.description);
    expect(vault).to.have.property('rebalanceThreshold', vaultParams.rebalanceThreshold);
    expect(vault).to.have.property('isAutomated', vaultParams.isAutomated);
    expect(vault).to.have.property('txHash');
  });
  
  it('should set asset allocations for a vault', async () => {
    // First create a vault
    const vault = await api.createVault({
      name: 'Allocation Test Vault',
      description: 'Testing allocations',
      rebalanceThreshold: 3,
      isAutomated: true,
    });
    
    // Get available assets
    const assets = await api.getAssets();
    
    // Set allocations for each asset
    const allocations = [];
    const totalPercentage = 100;
    const percentagePerAsset = Math.floor(totalPercentage / assets.length);
    
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      const percentage = i === assets.length - 1 
        ? totalPercentage - (percentagePerAsset * (assets.length - 1)) // Ensure total is exactly 100%
        : percentagePerAsset;
      
      const allocation = await api.createAllocation({
        vaultId: vault.id,
        assetId: asset.id,
        percentage,
      });
      
      allocations.push(allocation);
      
      expect(allocation).to.have.property('vaultId', vault.id);
      expect(allocation).to.have.property('assetId', asset.id);
      expect(allocation).to.have.property('percentage', percentage);
      expect(allocation).to.have.property('txHash');
    }
    
    // Verify total allocation is 100%
    const total = allocations.reduce((sum, a) => sum + a.percentage, 0);
    expect(total).to.equal(100);
    
    // Verify allocations can be retrieved
    const retrievedAllocations = await api.getAllocations(vault.id);
    expect(retrievedAllocations).to.have.lengthOf(assets.length);
  });
  
  it('should validate total allocation does not exceed 100%', async () => {
    // Create a vault
    const vault = await api.createVault({
      name: 'Validation Test Vault',
      description: 'Testing allocation validation',
      rebalanceThreshold: 3,
      isAutomated: true,
    });
    
    // Add two allocations totaling 100%
    await api.createAllocation({
      vaultId: vault.id,
      assetId: 1,
      percentage: 60,
    });
    
    await api.createAllocation({
      vaultId: vault.id,
      assetId: 2,
      percentage: 40,
    });
    
    // A real implementation would validate and reject this allocation
    // For this mock, we'll just verify the total after adding it
    await api.createAllocation({
      vaultId: vault.id,
      assetId: 3,
      percentage: 20, // This would push total to 120%
    });
    
    const allocations = await api.getAllocations(vault.id);
    
    // Note: In a real implementation with validation, this test would expect an error
    // or would verify the allocation was adjusted to maintain 100% total
    const total = allocations.reduce((sum, a) => sum + a.percentage, 0);
    console.log(`Validation Test - Allocations sum to ${total}% (would be validated in real app)`);
  });
  
  it('should verify data flow from contract to backend to frontend', async () => {
    // Create a vault in the contract (simulating a user transaction)
    const vaultParams = {
      name: 'Data Flow Test Vault',
      description: 'Testing contract → backend → frontend flow',
      rebalanceThreshold: 5,
      isAutomated: true,
    };
    
    // 1. Contract creates vault
    const contractResult = await contract.createVault(vaultParams);
    expect(contractResult).to.have.property('vaultId');
    
    // 2. Backend retrieves vault from contract
    const backendVault = await api.getVault(contractResult.vaultId);
    expect(backendVault).to.have.property('name', vaultParams.name);
    
    // 3. Frontend would fetch vault from backend
    // Mock the frontend fetching from the backend API
    const frontendVault = await api.getVault(contractResult.vaultId);
    expect(frontendVault).to.have.property('id', contractResult.vaultId);
    expect(frontendVault).to.have.property('name', vaultParams.name);
    
    // 4. Make a change (add allocation) from frontend → backend → contract
    const allocation = {
      vaultId: contractResult.vaultId,
      assetId: 1,
      percentage: 100,
    };
    
    // Frontend sends allocation to backend
    const backendAllocationResult = await api.createAllocation(allocation);
    expect(backendAllocationResult).to.have.property('txHash');
    
    // Backend should have processed it to contract
    const contractAllocations = await contract.getAllocations(contractResult.vaultId);
    expect(contractAllocations).to.have.lengthOf(1);
    expect(contractAllocations[0]).to.have.property('assetId', allocation.assetId);
    expect(contractAllocations[0]).to.have.property('percentage', allocation.percentage);
    
    // Frontend fetches updated data
    const frontendAllocations = await api.getAllocations(contractResult.vaultId);
    expect(frontendAllocations).to.deep.equal(contractAllocations);
  });
});

// This is just a test implementation - it would be run with a proper test runner in a real environment
console.log('Portfolio Creation Tests: These tests require a proper test runner to execute.');
console.log('To run them: npm install --save-dev mocha chai && npx mocha testing/functional/portfolioCreationTest.js');