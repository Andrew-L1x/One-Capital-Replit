import { callContractMethod, sendContractTransaction, L1X_TESTNET_URL } from './web3';

// Contract address (will be populated after deployment)
// This would typically come from an environment variable
let CONTRACT_ADDRESS = '';

export const setContractAddress = (address: string) => {
  CONTRACT_ADDRESS = address;
};

export const getContractAddress = () => CONTRACT_ADDRESS;

// Contract methods
export enum ContractMethod {
  // Vault methods
  CREATE_VAULT = 'create_vault',
  GET_VAULT = 'get_vault',
  UPDATE_VAULT = 'update_vault',
  DELETE_VAULT = 'delete_vault',
  
  // Allocation methods
  SET_ALLOCATION = 'set_allocation',
  GET_ALLOCATIONS = 'get_allocations',
  
  // Rebalance methods
  REBALANCE = 'rebalance',
  GET_REBALANCE_HISTORY = 'get_rebalance_history',
  
  // Take profit methods
  SET_TAKE_PROFIT = 'set_take_profit',
  GET_TAKE_PROFIT = 'get_take_profit',

  // Counter methods (from simplified contract)
  GET_COUNTER = 'get_counter',
  SET_COUNTER = 'set_counter',
  INCREMENT_COUNTER = 'increment_counter',
}

// Interface for vault creation
export interface VaultCreationParams {
  name: string;
  description: string;
  rebalanceThreshold: number; // percentage drift to trigger rebalance
  isAutomated: boolean;
}

// Interface for allocation settings
export interface AllocationParams {
  vaultId: string;
  assetId: string;
  percentage: number; // Target percentage allocation 
}

// Interface for take profit settings
export interface TakeProfitParams {
  vaultId: string;
  targetPercentage: number;
  isEnabled: boolean;
}

// Vault interaction methods
export const createVault = async (params: VaultCreationParams): Promise<string> => {
  return sendContractTransaction({
    contractAddress: CONTRACT_ADDRESS,
    method: ContractMethod.CREATE_VAULT,
    params: [
      params.name,
      params.description,
      params.rebalanceThreshold,
      params.isAutomated
    ]
  });
};

export const getVault = async (vaultId: string): Promise<any> => {
  return callContractMethod({
    contractAddress: CONTRACT_ADDRESS,
    method: ContractMethod.GET_VAULT,
    params: [vaultId]
  });
};

export const updateVault = async (vaultId: string, params: Partial<VaultCreationParams>): Promise<string> => {
  return sendContractTransaction({
    contractAddress: CONTRACT_ADDRESS,
    method: ContractMethod.UPDATE_VAULT,
    params: [
      vaultId,
      params.name,
      params.description,
      params.rebalanceThreshold,
      params.isAutomated
    ]
  });
};

export const deleteVault = async (vaultId: string): Promise<string> => {
  return sendContractTransaction({
    contractAddress: CONTRACT_ADDRESS,
    method: ContractMethod.DELETE_VAULT,
    params: [vaultId]
  });
};

// Allocation methods
export const setAllocation = async (params: AllocationParams): Promise<string> => {
  return sendContractTransaction({
    contractAddress: CONTRACT_ADDRESS,
    method: ContractMethod.SET_ALLOCATION,
    params: [
      params.vaultId,
      params.assetId,
      params.percentage
    ]
  });
};

export const getAllocations = async (vaultId: string): Promise<any> => {
  return callContractMethod({
    contractAddress: CONTRACT_ADDRESS,
    method: ContractMethod.GET_ALLOCATIONS,
    params: [vaultId]
  });
};

// Rebalance methods
export const rebalanceVault = async (vaultId: string): Promise<string> => {
  return sendContractTransaction({
    contractAddress: CONTRACT_ADDRESS,
    method: ContractMethod.REBALANCE,
    params: [vaultId]
  });
};

export const getRebalanceHistory = async (vaultId: string): Promise<any> => {
  return callContractMethod({
    contractAddress: CONTRACT_ADDRESS,
    method: ContractMethod.GET_REBALANCE_HISTORY,
    params: [vaultId]
  });
};

// Take profit methods
export const setTakeProfit = async (params: TakeProfitParams): Promise<string> => {
  return sendContractTransaction({
    contractAddress: CONTRACT_ADDRESS,
    method: ContractMethod.SET_TAKE_PROFIT,
    params: [
      params.vaultId,
      params.targetPercentage,
      params.isEnabled
    ]
  });
};

export const getTakeProfit = async (vaultId: string): Promise<any> => {
  return callContractMethod({
    contractAddress: CONTRACT_ADDRESS,
    method: ContractMethod.GET_TAKE_PROFIT,
    params: [vaultId]
  });
};

// Counter methods for the simplified contract
export const getCounter = async (): Promise<number> => {
  const response = await callContractMethod({
    contractAddress: CONTRACT_ADDRESS,
    method: ContractMethod.GET_COUNTER,
    params: []
  });
  
  return parseInt(response, 16);
};

export const setCounter = async (value: number): Promise<string> => {
  return sendContractTransaction({
    contractAddress: CONTRACT_ADDRESS,
    method: ContractMethod.SET_COUNTER,
    params: [value]
  });
};

export const incrementCounter = async (): Promise<string> => {
  return sendContractTransaction({
    contractAddress: CONTRACT_ADDRESS,
    method: ContractMethod.INCREMENT_COUNTER,
    params: []
  });
};

// Utility to check if contract is deployed and accessible
export const isContractAvailable = async (): Promise<boolean> => {
  if (!CONTRACT_ADDRESS) return false;
  
  try {
    await getCounter();
    return true;
  } catch (error) {
    console.error("Contract not available:", error);
    return false;
  }
};