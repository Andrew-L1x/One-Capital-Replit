import { 
  users, assets, vaults, allocations, takeProfitSettings, rebalanceHistory, priceFeeds,
  type User, type InsertUser,
  type Asset, type InsertAsset,
  type Vault, type InsertVault,
  type Allocation, type InsertAllocation,
  type TakeProfitSetting, type InsertTakeProfitSetting,
  type RebalanceHistory, type InsertRebalanceHistory,
  type PriceFeed, type InsertPriceFeed
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // User methods
  getAllUsers(): Promise<User[]>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByWalletAddress(walletAddress: string): Promise<User | undefined>;
  getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Asset methods
  getAsset(id: number): Promise<Asset | undefined>;
  getAssetBySymbol(symbol: string): Promise<Asset | undefined>;
  getAllAssets(): Promise<Asset[]>;
  createAsset(asset: InsertAsset): Promise<Asset>;
  
  // Vault methods
  getVault(id: number): Promise<Vault | undefined>;
  getVaultsByUserId(userId: number): Promise<Vault[]>;
  createVault(vault: InsertVault): Promise<Vault>;
  updateVault(id: number, vault: Partial<InsertVault>): Promise<Vault | undefined>;
  deleteVault(id: number): Promise<boolean>;
  
  // Allocation methods
  getAllocation(id: number): Promise<Allocation | undefined>;
  getAllocationsByVaultId(vaultId: number): Promise<Allocation[]>;
  createAllocation(allocation: InsertAllocation): Promise<Allocation>;
  updateAllocation(id: number, allocation: Partial<InsertAllocation>): Promise<Allocation | undefined>;
  deleteAllocation(id: number): Promise<boolean>;
  
  // Take profit settings methods
  getTakeProfitSetting(id: number): Promise<TakeProfitSetting | undefined>;
  getTakeProfitSettingByVaultId(vaultId: number): Promise<TakeProfitSetting | undefined>;
  createTakeProfitSetting(setting: InsertTakeProfitSetting): Promise<TakeProfitSetting>;
  updateTakeProfitSetting(id: number, setting: Partial<InsertTakeProfitSetting>): Promise<TakeProfitSetting | undefined>;
  
  // Rebalance history methods
  getRebalanceHistory(id: number): Promise<RebalanceHistory | undefined>;
  getRebalanceHistoryByVaultId(vaultId: number): Promise<RebalanceHistory[]>;
  createRebalanceHistory(history: InsertRebalanceHistory): Promise<RebalanceHistory>;
  
  // Price feed methods
  getLatestPriceByAssetId(assetId: number): Promise<PriceFeed | undefined>;
  createPriceFeed(priceFeed: InsertPriceFeed): Promise<PriceFeed>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }
  
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByWalletAddress(walletAddress: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.walletAddress, walletAddress));
    return user || undefined;
  }

  async getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.firebaseUid, firebaseUid));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Asset methods
  async getAsset(id: number): Promise<Asset | undefined> {
    const [asset] = await db.select().from(assets).where(eq(assets.id, id));
    return asset || undefined;
  }

  async getAssetBySymbol(symbol: string): Promise<Asset | undefined> {
    const [asset] = await db.select().from(assets).where(eq(assets.symbol, symbol));
    return asset || undefined;
  }

  async getAllAssets(): Promise<Asset[]> {
    return await db.select().from(assets);
  }

  async createAsset(insertAsset: InsertAsset): Promise<Asset> {
    const [asset] = await db
      .insert(assets)
      .values(insertAsset)
      .returning();
    return asset;
  }

  // Vault methods
  async getVault(id: number): Promise<Vault | undefined> {
    // Try to fetch from database
    const [vault] = await db.select().from(vaults).where(eq(vaults.id, id));
    
    // Return if found
    if (vault) {
      return vault;
    }
    
    // For development only - provide test data for ID 1
    if (id === 1) {
      console.log("Providing test vault data for development");
      return {
        id: 1,
        name: "Aggressive Growth",
        description: "High risk, high reward portfolio focused on crypto growth assets",
        userId: 1,
        isCustodial: true,
        contractAddress: null,
        driftThreshold: "5",
        rebalanceFrequency: "manual",
        lastRebalanced: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
    
    console.log(`Vault not found: ID ${id}`);
    return undefined;
  }

  async getVaultsByUserId(userId: number): Promise<Vault[]> {
    // Try to fetch vaults from database
    const dbVaults = await db.select().from(vaults).where(eq(vaults.userId, userId));
    
    // If we have vaults, return them
    if (dbVaults.length > 0) {
      return dbVaults;
    }
    
    // For development only - provide test data for user ID 1
    if (userId === 1) {
      console.log("Providing test vaults data for development");
      return [
        {
          id: 1,
          name: "Aggressive Growth",
          description: "High risk, high reward portfolio focused on crypto growth assets",
          userId: 1,
          isCustodial: true,
          contractAddress: null,
          driftThreshold: "5",
          rebalanceFrequency: "manual",
          lastRebalanced: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 2,
          name: "Stable Income",
          description: "Lower risk portfolio focused on stablecoins and yield generation",
          userId: 1,
          isCustodial: false,
          contractAddress: "0x7f5EB5bB5cF88cfcEe9613368636f458800e62CB",
          driftThreshold: "2",
          rebalanceFrequency: "weekly",
          lastRebalanced: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    }
    
    return [];
  }

  async createVault(insertVault: InsertVault): Promise<Vault> {
    const [vault] = await db
      .insert(vaults)
      .values(insertVault)
      .returning();
    return vault;
  }

  async updateVault(id: number, updateVault: Partial<InsertVault>): Promise<Vault | undefined> {
    const [vault] = await db
      .update(vaults)
      .set({ ...updateVault, updatedAt: new Date() })
      .where(eq(vaults.id, id))
      .returning();
    return vault || undefined;
  }

  async deleteVault(id: number): Promise<boolean> {
    const result = await db.delete(vaults).where(eq(vaults.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Allocation methods
  async getAllocation(id: number): Promise<Allocation | undefined> {
    const [allocation] = await db.select().from(allocations).where(eq(allocations.id, id));
    return allocation || undefined;
  }

  async getAllocationsByVaultId(vaultId: number): Promise<Allocation[]> {
    // Try to fetch allocations from database
    const dbAllocations = await db.select().from(allocations).where(eq(allocations.vaultId, vaultId));
    
    // If we have allocations, return them
    if (dbAllocations.length > 0) {
      return dbAllocations;
    }
    
    // Get the vault to check if it belongs to the test user (ID 1)
    const vault = await this.getVault(vaultId);
    
    // For development only - provide test data only for test user (ID 1) vaults
    if (vault && vault.userId === 1 && vaultId === 1) {
      console.log("Providing test allocation data for development");
      return [
        {
          id: 1,
          vaultId: 1,
          assetId: 1, // BTC
          targetPercentage: "40.00",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 2,
          vaultId: 1,
          assetId: 2, // ETH
          targetPercentage: "30.00",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 3,
          vaultId: 1,
          assetId: 3, // L1X
          targetPercentage: "20.00",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 4,
          vaultId: 1,
          assetId: 4, // USDC
          targetPercentage: "10.00",
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    }
    
    // For all other users, return an empty array
    return [];
  }

  async createAllocation(insertAllocation: InsertAllocation): Promise<Allocation> {
    const [allocation] = await db
      .insert(allocations)
      .values(insertAllocation)
      .returning();
    return allocation;
  }

  async updateAllocation(id: number, updateAllocation: Partial<InsertAllocation>): Promise<Allocation | undefined> {
    const [allocation] = await db
      .update(allocations)
      .set({ ...updateAllocation, updatedAt: new Date() })
      .where(eq(allocations.id, id))
      .returning();
    return allocation || undefined;
  }

  async deleteAllocation(id: number): Promise<boolean> {
    const result = await db.delete(allocations).where(eq(allocations.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Take profit settings methods
  async getTakeProfitSetting(id: number): Promise<TakeProfitSetting | undefined> {
    const [setting] = await db.select().from(takeProfitSettings).where(eq(takeProfitSettings.id, id));
    return setting || undefined;
  }

  async getTakeProfitSettingByVaultId(vaultId: number): Promise<TakeProfitSetting | undefined> {
    const [setting] = await db.select().from(takeProfitSettings).where(eq(takeProfitSettings.vaultId, vaultId));
    return setting || undefined;
  }

  async createTakeProfitSetting(insertSetting: InsertTakeProfitSetting): Promise<TakeProfitSetting> {
    const [setting] = await db
      .insert(takeProfitSettings)
      .values(insertSetting)
      .returning();
    return setting;
  }

  async updateTakeProfitSetting(id: number, updateSetting: Partial<InsertTakeProfitSetting>): Promise<TakeProfitSetting | undefined> {
    const [setting] = await db
      .update(takeProfitSettings)
      .set({ ...updateSetting, updatedAt: new Date() })
      .where(eq(takeProfitSettings.id, id))
      .returning();
    return setting || undefined;
  }

  // Rebalance history methods
  async getRebalanceHistory(id: number): Promise<RebalanceHistory | undefined> {
    const [history] = await db.select().from(rebalanceHistory).where(eq(rebalanceHistory.id, id));
    return history || undefined;
  }

  async getRebalanceHistoryByVaultId(vaultId: number): Promise<RebalanceHistory[]> {
    return await db
      .select()
      .from(rebalanceHistory)
      .where(eq(rebalanceHistory.vaultId, vaultId))
      .orderBy(desc(rebalanceHistory.timestamp));
  }

  async createRebalanceHistory(insertHistory: InsertRebalanceHistory): Promise<RebalanceHistory> {
    const [history] = await db
      .insert(rebalanceHistory)
      .values(insertHistory)
      .returning();
    return history;
  }

  // Price feed methods
  async getLatestPriceByAssetId(assetId: number): Promise<PriceFeed | undefined> {
    const [priceFeed] = await db
      .select()
      .from(priceFeeds)
      .where(eq(priceFeeds.assetId, assetId))
      .orderBy(desc(priceFeeds.timestamp))
      .limit(1);
    return priceFeed || undefined;
  }

  async createPriceFeed(insertPriceFeed: InsertPriceFeed): Promise<PriceFeed> {
    const [priceFeed] = await db
      .insert(priceFeeds)
      .values(insertPriceFeed)
      .returning();
    return priceFeed;
  }
}

export const storage = new DatabaseStorage();
