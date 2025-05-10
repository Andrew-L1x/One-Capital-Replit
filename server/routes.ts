import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertUserSchema, 
  insertVaultSchema, 
  insertAllocationSchema, 
  insertTakeProfitSettingsSchema,
  insertAssetSchema,
  insertPriceFeedSchema,
  insertRebalanceHistorySchema
} from "@shared/schema";
import { getAllAssetPrices, getPrice, getPrices } from "./services/priceFeed";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import session from "express-session";
import memoryStoreCreator from "memorystore";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";

const MemoryStore = memoryStoreCreator(session);

/**
 * Check if a vault needs rebalancing based on current allocations vs target
 * 
 * Rebalancing is needed when:
 * 1. Any asset's current allocation deviates from its target by more than the drift threshold
 * 2. The vault hasn't been rebalanced in the configured interval
 */
async function vaultNeedsRebalancing(vaultId: number): Promise<boolean> {
  try {
    // Get the vault settings
    const vault = await storage.getVault(vaultId);
    if (!vault) return false;
    
    // Get the drift threshold
    const driftThreshold = parseFloat(vault.driftThreshold?.toString() || "5.0");
    
    // Get the last rebalanced date
    const lastRebalanced = vault.lastRebalanced;
    
    // Get the rebalance frequency
    const rebalanceFrequency = vault.rebalanceFrequency || "manual";
    
    // Check if needs rebalancing based on time
    if (rebalanceFrequency !== "manual" && lastRebalanced) {
      const now = new Date();
      const lastRebalancedDate = new Date(lastRebalanced);
      const daysSinceLastRebalance = Math.floor((now.getTime() - lastRebalancedDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Check based on frequency
      if (
        (rebalanceFrequency === "weekly" && daysSinceLastRebalance >= 7) ||
        (rebalanceFrequency === "monthly" && daysSinceLastRebalance >= 30) ||
        (rebalanceFrequency === "quarterly" && daysSinceLastRebalance >= 90) ||
        (rebalanceFrequency === "yearly" && daysSinceLastRebalance >= 365)
      ) {
        return true;
      }
    }
    
    // Get allocations
    const allocations = await storage.getAllocationsByVaultId(vaultId);
    if (allocations.length === 0) return false;
    
    // TODO: In a real implementation, we would get current market prices
    // and calculate the current percentage for each asset
    // For simplicity, we'll just simulate drift for demo purposes
    
    // Check if any allocation exceeds drift threshold
    for (const allocation of allocations) {
      // Simulate current percentage with small random drift
      const currentPercentage = parseFloat(allocation.targetPercentage.toString());
      const randomDrift = (Math.random() - 0.5) * 10; // Random drift between -5% and +5%
      const simulatedCurrentPercentage = currentPercentage + randomDrift;
      
      // Calculate the absolute deviation
      const deviation = Math.abs(simulatedCurrentPercentage - currentPercentage);
      
      // If deviation exceeds threshold, rebalancing is needed
      if (deviation > driftThreshold) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error("Error checking if vault needs rebalancing:", error);
    return false;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Session setup
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "one-capital-autoinvesting-session-secret",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: process.env.NODE_ENV === "production", maxAge: 86400000 }, // 24 hours
      store: new MemoryStore({ checkPeriod: 86400000 }),
    })
  );

  // Initialize passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Passport local strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "Incorrect username" });
        }

        // In a real app, you should use bcrypt.compare
        // This is a simplified version for the example
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          return done(null, false, { message: "Incorrect password" });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  const api = express.Router();

  // Auth routes
  api.post("/auth/register", async (req: Request, res: Response) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already taken" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      // Create user with hashed password
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword
      });

      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      
      return res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      return res.status(500).json({ message: "Error creating user" });
    }
  });

  api.post("/auth/login", (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ message: info.message || "Authentication failed" });
      }
      req.login(user, (err) => {
        if (err) {
          return next(err);
        }
        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        return res.json(userWithoutPassword);
      });
    })(req, res, next);
  });

  api.post("/auth/logout", (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Error logging out" });
      }
      res.json({ success: true });
    });
  });

  api.get("/auth/me", (req: Request, res: Response) => {
    // TEMPORARY: Return a test user for demonstration purposes
    // This bypasses the need for Firebase authentication
    const testUser = {
      id: 1,
      username: "test_user",
      email: "test@example.com",
      walletAddress: "0x1234...5678",
      firebaseUid: "test-firebase-uid",
      createdAt: new Date().toISOString(),
    };
    
    return res.json(testUser);
    
    /* Normal authentication code - uncomment when Firebase is properly configured
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    // Remove password from response
    const { password, ...userWithoutPassword } = req.user as any;
    res.json(userWithoutPassword);
    */
  });

  // Web3 authentication
  api.post("/auth/web3/login", async (req: Request, res: Response) => {
    try {
      const { walletAddress, signature, message } = req.body;
      
      if (!walletAddress || !signature || !message) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // In a real app, you would verify the signature here
      // For simplicity, we're just checking if the wallet address exists

      let user = await storage.getUserByWalletAddress(walletAddress);
      
      // If no user exists with this wallet, create one
      if (!user) {
        user = await storage.createUser({
          username: `wallet_${walletAddress.slice(0, 8)}`,
          password: await bcrypt.hash(Math.random().toString(36), 10), // Random password
          email: `wallet_${walletAddress.slice(0, 8)}@example.com`, // Placeholder email
          walletAddress
        });
      }

      // Log the user in
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Error logging in" });
        }
        const { password, ...userWithoutPassword } = user;
        return res.status(200).json(userWithoutPassword);
      });
    } catch (error) {
      return res.status(500).json({ message: "Error during Web3 authentication" });
    }
  });
  
  // Firebase authentication
  api.post("/auth/firebase-link", async (req: Request, res: Response) => {
    try {
      const { firebaseUid, email, username: providedUsername } = req.body;
      
      if (!firebaseUid || !email) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Check if user already exists with this Firebase UID
      let user = await storage.getUserByFirebaseUid(firebaseUid);
      
      // If no user exists with this Firebase UID, create one
      if (!user) {
        // Create a username from the provided username or from the email (remove @ and domain)
        const username = providedUsername || email.split('@')[0];
        
        // Check if username already exists
        const existingUserWithUsername = await storage.getUserByUsername(username);
        if (existingUserWithUsername) {
          return res.status(400).json({ message: "Username already taken" });
        }
        
        user = await storage.createUser({
          username,
          email,
          password: await bcrypt.hash(Math.random().toString(36), 10), // Random password
          firebaseUid
        });
      }

      // Log the user in
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Error logging in" });
        }
        const { password, ...userWithoutPassword } = user;
        return res.status(200).json(userWithoutPassword);
      });
    } catch (error) {
      console.error("Firebase link error:", error);
      return res.status(500).json({ message: "Error during Firebase authentication" });
    }
  });

  // Asset routes
  api.get("/assets", async (_req: Request, res: Response) => {
    try {
      // TEMPORARY: Return demo assets
      const testAssets = [
        {
          id: 1,
          name: "Bitcoin",
          symbol: "BTC",
          type: "cryptocurrency",
          createdAt: new Date().toISOString()
        },
        {
          id: 2,
          name: "Ethereum",
          symbol: "ETH",
          type: "cryptocurrency",
          createdAt: new Date().toISOString()
        },
        {
          id: 3,
          name: "Layer One X",
          symbol: "L1X",
          type: "cryptocurrency",
          createdAt: new Date().toISOString()
        },
        {
          id: 4,
          name: "Solana",
          symbol: "SOL",
          type: "cryptocurrency",
          createdAt: new Date().toISOString()
        },
        {
          id: 5,
          name: "USD Coin",
          symbol: "USDC",
          type: "stablecoin",
          createdAt: new Date().toISOString()
        }
      ];
      
      return res.json(testAssets);
      
      /* Normal code
      const assets = await storage.getAllAssets();
      return res.json(assets);
      */
    } catch (error) {
      return res.status(500).json({ message: "Error fetching assets" });
    }
  });

  api.post("/assets", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const assetData = insertAssetSchema.parse(req.body);
      const asset = await storage.createAsset(assetData);
      return res.status(201).json(asset);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      return res.status(500).json({ message: "Error creating asset" });
    }
  });

  // Vault routes
  api.get("/vaults", async (req: Request, res: Response) => {
    try {
      // TEMPORARY: For demo purposes, always return test vaults
      const testVaults = [
        {
          id: 1,
          name: "Aggressive Growth",
          description: "High risk, high reward portfolio focused on tech and growth stocks",
          userId: 1,
          isCustodial: true,
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          contractAddress: null
        },
        {
          id: 2,
          name: "Balanced Portfolio",
          description: "Balanced mix of growth and value assets",
          userId: 1,
          isCustodial: false,
          createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
          contractAddress: "0x7890123456789012345678901234567890123456"
        },
        {
          id: 3,
          name: "Stable Income",
          description: "Low volatility assets with stable returns",
          userId: 1,
          isCustodial: true,
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          contractAddress: null
        }
      ];
      
      return res.json(testVaults);
      
      /* Normal authentication code
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = (req.user as any).id;
      const vaults = await storage.getVaultsByUserId(userId);
      return res.json(vaults);
      */
    } catch (error) {
      return res.status(500).json({ message: "Error fetching vaults" });
    }
  });

  api.post("/vaults", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = (req.user as any).id;
      const vaultData = insertVaultSchema.parse({
        ...req.body,
        userId
      });
      
      const vault = await storage.createVault(vaultData);
      return res.status(201).json(vault);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      return res.status(500).json({ message: "Error creating vault" });
    }
  });

  api.get("/vaults/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = (req.user as any).id;
      const vaultId = parseInt(req.params.id);
      
      if (isNaN(vaultId)) {
        return res.status(400).json({ message: "Invalid vault ID" });
      }
      
      // Use real database storage
      const vault = await storage.getVault(vaultId);
      
      if (!vault) {
        console.log(`Vault not found: ID ${vaultId}`);
        return res.status(404).json({ message: "Vault not found" });
      }
      
      if (vault.userId !== userId) {
        console.log(`Access denied to vault ${vaultId} for user ${userId}`);
        return res.status(403).json({ message: "Access denied" });
      }
      
      return res.json(vault);
    } catch (error) {
      console.error("Error fetching vault:", error);
      return res.status(500).json({ message: "Error fetching vault" });
    }
  });

  api.put("/vaults/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = (req.user as any).id;
      const vaultId = parseInt(req.params.id);
      
      if (isNaN(vaultId)) {
        return res.status(400).json({ message: "Invalid vault ID" });
      }
      
      const vault = await storage.getVault(vaultId);
      
      if (!vault) {
        return res.status(404).json({ message: "Vault not found" });
      }
      
      if (vault.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Prevent updating userId
      const { userId: _, ...vaultData } = req.body;
      
      const updatedVault = await storage.updateVault(vaultId, vaultData);
      return res.json(updatedVault);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      return res.status(500).json({ message: "Error updating vault" });
    }
  });

  api.delete("/vaults/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = (req.user as any).id;
      const vaultId = parseInt(req.params.id);
      
      if (isNaN(vaultId)) {
        return res.status(400).json({ message: "Invalid vault ID" });
      }
      
      const vault = await storage.getVault(vaultId);
      
      if (!vault) {
        return res.status(404).json({ message: "Vault not found" });
      }
      
      if (vault.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteVault(vaultId);
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ message: "Error deleting vault" });
    }
  });

  // Allocation routes
  api.get("/vaults/:vaultId/allocations", async (req: Request, res: Response) => {
    try {
      // TEMPORARY: Return mock allocations by vault ID
      const vaultId = parseInt(req.params.vaultId);
      
      if (isNaN(vaultId)) {
        return res.status(400).json({ message: "Invalid vault ID" });
      }
      
      // Check if the requested vault exists in our test data
      const testVaults = [1, 2, 3];
      if (!testVaults.includes(vaultId)) {
        return res.status(404).json({ message: "Vault not found" });
      }
      
      // Mock allocations based on vault ID
      let testAllocations = [];
      
      if (vaultId === 1) {
        // Aggressive Growth vault
        testAllocations = [
          {
            id: 1,
            vaultId: 1,
            assetId: 2, // ETH
            targetPercentage: 40,
            createdAt: new Date().toISOString()
          },
          {
            id: 2,
            vaultId: 1,
            assetId: 1, // BTC
            targetPercentage: 35,
            createdAt: new Date().toISOString()
          },
          {
            id: 3,
            vaultId: 1,
            assetId: 3, // L1X
            targetPercentage: 25,
            createdAt: new Date().toISOString()
          }
        ];
      } else if (vaultId === 2) {
        // Balanced Portfolio vault
        testAllocations = [
          {
            id: 4,
            vaultId: 2,
            assetId: 1, // BTC
            targetPercentage: 30,
            createdAt: new Date().toISOString()
          },
          {
            id: 5,
            vaultId: 2,
            assetId: 2, // ETH
            targetPercentage: 30,
            createdAt: new Date().toISOString()
          },
          {
            id: 6,
            vaultId: 2,
            assetId: 4, // SOL
            targetPercentage: 20,
            createdAt: new Date().toISOString()
          },
          {
            id: 7,
            vaultId: 2,
            assetId: 5, // USDC
            targetPercentage: 20,
            createdAt: new Date().toISOString()
          }
        ];
      } else if (vaultId === 3) {
        // Stable Income vault
        testAllocations = [
          {
            id: 8,
            vaultId: 3,
            assetId: 5, // USDC
            targetPercentage: 60,
            createdAt: new Date().toISOString()
          },
          {
            id: 9,
            vaultId: 3,
            assetId: 1, // BTC
            targetPercentage: 20,
            createdAt: new Date().toISOString()
          },
          {
            id: 10,
            vaultId: 3,
            assetId: 2, // ETH
            targetPercentage: 20,
            createdAt: new Date().toISOString()
          }
        ];
      }
      
      return res.json(testAllocations);
      
      /* Normal authentication code
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = (req.user as any).id;
      const vaultId = parseInt(req.params.vaultId);
      
      if (isNaN(vaultId)) {
        return res.status(400).json({ message: "Invalid vault ID" });
      }
      
      const vault = await storage.getVault(vaultId);
      
      if (!vault) {
        return res.status(404).json({ message: "Vault not found" });
      }
      
      if (vault.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const allocations = await storage.getAllocationsByVaultId(vaultId);
      return res.json(allocations);
      */
    } catch (error) {
      return res.status(500).json({ message: "Error fetching allocations" });
    }
  });

  api.post("/vaults/:vaultId/allocations", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = (req.user as any).id;
      const vaultId = parseInt(req.params.vaultId);
      
      if (isNaN(vaultId)) {
        return res.status(400).json({ message: "Invalid vault ID" });
      }
      
      const vault = await storage.getVault(vaultId);
      
      if (!vault) {
        return res.status(404).json({ message: "Vault not found" });
      }
      
      if (vault.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const allocationData = insertAllocationSchema.parse({
        ...req.body,
        vaultId
      });
      
      // Validate that the total allocation doesn't exceed 100%
      const existingAllocations = await storage.getAllocationsByVaultId(vaultId);
      const currentTotal = existingAllocations.reduce(
        (sum, allocation) => sum + parseFloat(allocation.targetPercentage.toString()),
        0
      );
      
      const newAllocationValue = parseFloat(allocationData.targetPercentage.toString());
      
      if (currentTotal + newAllocationValue > 100) {
        return res.status(400).json({ message: "Total allocation exceeds 100%" });
      }
      
      const allocation = await storage.createAllocation(allocationData);
      return res.status(201).json(allocation);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      return res.status(500).json({ message: "Error creating allocation" });
    }
  });

  api.put("/allocations/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = (req.user as any).id;
      const allocationId = parseInt(req.params.id);
      
      if (isNaN(allocationId)) {
        return res.status(400).json({ message: "Invalid allocation ID" });
      }
      
      const allocation = await storage.getAllocation(allocationId);
      
      if (!allocation) {
        return res.status(404).json({ message: "Allocation not found" });
      }
      
      const vault = await storage.getVault(allocation.vaultId);
      
      if (!vault || vault.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Prevent updating vaultId
      const { vaultId: _, ...allocationData } = req.body;
      
      const updatedAllocation = await storage.updateAllocation(allocationId, allocationData);
      return res.json(updatedAllocation);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      return res.status(500).json({ message: "Error updating allocation" });
    }
  });

  api.delete("/allocations/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = (req.user as any).id;
      const allocationId = parseInt(req.params.id);
      
      if (isNaN(allocationId)) {
        return res.status(400).json({ message: "Invalid allocation ID" });
      }
      
      const allocation = await storage.getAllocation(allocationId);
      
      if (!allocation) {
        return res.status(404).json({ message: "Allocation not found" });
      }
      
      const vault = await storage.getVault(allocation.vaultId);
      
      if (!vault || vault.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteAllocation(allocationId);
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ message: "Error deleting allocation" });
    }
  });

  // Take profit settings routes
  api.get("/vaults/:vaultId/take-profit", async (req: Request, res: Response) => {
    try {
      // TEMPORARY: Return mock take profit settings by vault ID
      const vaultId = parseInt(req.params.vaultId);
      
      if (isNaN(vaultId)) {
        return res.status(400).json({ message: "Invalid vault ID" });
      }
      
      // Check if the requested vault exists in our test data
      const testVaults = [1, 2, 3];
      if (!testVaults.includes(vaultId)) {
        return res.status(404).json({ message: "Vault not found" });
      }
      
      // Mock take profit settings based on vault ID
      let takeProfitSetting = null;
      
      if (vaultId === 1) {
        // Aggressive Growth vault
        takeProfitSetting = {
          id: 1,
          vaultId: 1,
          type: "percentage",
          threshold: 15.0,
          isActive: true,
          targetAssetId: 5, // USDC
          createdAt: new Date().toISOString()
        };
      } else if (vaultId === 2) {
        // Balanced Portfolio vault
        takeProfitSetting = {
          id: 2,
          vaultId: 2,
          type: "threshold",
          threshold: 10000.0,
          isActive: true,
          targetAssetId: 5, // USDC
          createdAt: new Date().toISOString()
        };
      } else if (vaultId === 3) {
        // Stable Income vault
        takeProfitSetting = {
          id: 3,
          vaultId: 3,
          type: "percentage",
          threshold: 5.0,
          isActive: false,
          targetAssetId: 5, // USDC
          createdAt: new Date().toISOString()
        };
      }
      
      if (!takeProfitSetting) {
        return res.status(404).json({ message: "Take profit settings not found" });
      }
      
      return res.json(takeProfitSetting);
      
      /* Normal authentication code
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = (req.user as any).id;
      const vaultId = parseInt(req.params.vaultId);
      
      if (isNaN(vaultId)) {
        return res.status(400).json({ message: "Invalid vault ID" });
      }
      
      const vault = await storage.getVault(vaultId);
      
      if (!vault) {
        return res.status(404).json({ message: "Vault not found" });
      }
      
      if (vault.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const settings = await storage.getTakeProfitSettingByVaultId(vaultId);
      
      if (!settings) {
        return res.status(404).json({ message: "Take profit settings not found" });
      }
      
      return res.json(settings);
      */
    } catch (error) {
      return res.status(500).json({ message: "Error fetching take profit settings" });
    }
  });

  api.post("/vaults/:vaultId/take-profit", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = (req.user as any).id;
      const vaultId = parseInt(req.params.vaultId);
      
      if (isNaN(vaultId)) {
        return res.status(400).json({ message: "Invalid vault ID" });
      }
      
      const vault = await storage.getVault(vaultId);
      
      if (!vault) {
        return res.status(404).json({ message: "Vault not found" });
      }
      
      if (vault.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Check if settings already exist
      const existingSettings = await storage.getTakeProfitSettingByVaultId(vaultId);
      
      if (existingSettings) {
        return res.status(400).json({ message: "Take profit settings already exist for this vault" });
      }
      
      const settingsData = insertTakeProfitSettingsSchema.parse({
        ...req.body,
        vaultId
      });
      
      const settings = await storage.createTakeProfitSetting(settingsData);
      return res.status(201).json(settings);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      return res.status(500).json({ message: "Error creating take profit settings" });
    }
  });

  api.put("/vaults/:vaultId/take-profit", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = (req.user as any).id;
      const vaultId = parseInt(req.params.vaultId);
      
      if (isNaN(vaultId)) {
        return res.status(400).json({ message: "Invalid vault ID" });
      }
      
      const vault = await storage.getVault(vaultId);
      
      if (!vault) {
        return res.status(404).json({ message: "Vault not found" });
      }
      
      if (vault.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const existingSettings = await storage.getTakeProfitSettingByVaultId(vaultId);
      
      if (!existingSettings) {
        return res.status(404).json({ message: "Take profit settings not found" });
      }
      
      // Prevent updating vaultId
      const { vaultId: _, ...settingsData } = req.body;
      
      const updatedSettings = await storage.updateTakeProfitSetting(existingSettings.id, settingsData);
      return res.json(updatedSettings);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      return res.status(500).json({ message: "Error updating take profit settings" });
    }
  });

  // Rebalance history routes
  api.get("/vaults/:vaultId/rebalance-history", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = (req.user as any).id;
      const vaultId = parseInt(req.params.vaultId);
      
      if (isNaN(vaultId)) {
        return res.status(400).json({ message: "Invalid vault ID" });
      }
      
      const vault = await storage.getVault(vaultId);
      
      if (!vault) {
        return res.status(404).json({ message: "Vault not found" });
      }
      
      if (vault.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const history = await storage.getRebalanceHistoryByVaultId(vaultId);
      return res.json(history);
    } catch (error) {
      return res.status(500).json({ message: "Error fetching rebalance history" });
    }
  });

  // Update vault rebalance settings
  api.put("/vaults/:id/rebalance-settings", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = (req.user as any).id;
      const vaultId = parseInt(req.params.id);
      
      if (isNaN(vaultId)) {
        return res.status(400).json({ message: "Invalid vault ID" });
      }
      
      const vault = await storage.getVault(vaultId);
      
      if (!vault) {
        return res.status(404).json({ message: "Vault not found" });
      }
      
      if (vault.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updateData = {
        driftThreshold: req.body.driftThreshold !== undefined ? req.body.driftThreshold : vault.driftThreshold,
        rebalanceFrequency: req.body.rebalanceFrequency || vault.rebalanceFrequency
      };
      
      const updatedVault = await storage.updateVault(vaultId, updateData);
      return res.json(updatedVault);
    } catch (error) {
      console.error("Error updating rebalance settings:", error);
      return res.status(500).json({ message: "Error updating rebalance settings" });
    }
  });
  
  // Trigger rebalance
  api.post("/vaults/:vaultId/rebalance", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = (req.user as any).id;
      const vaultId = parseInt(req.params.vaultId);
      
      if (isNaN(vaultId)) {
        return res.status(400).json({ message: "Invalid vault ID" });
      }
      
      const vault = await storage.getVault(vaultId);
      
      if (!vault) {
        return res.status(404).json({ message: "Vault not found" });
      }
      
      if (vault.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Get allocations
      const allocations = await storage.getAllocationsByVaultId(vaultId);
      
      if (allocations.length === 0) {
        return res.status(400).json({ message: "Vault has no allocations" });
      }
      
      // Check if rebalance is needed based on drift threshold
      const needsRebalance = await vaultNeedsRebalancing(vaultId);
      
      // Mock rebalance transactions
      const transactions = allocations.map(allocation => ({
        assetId: allocation.assetId,
        targetPercentage: allocation.targetPercentage.toString(),
        actions: [
          {
            type: "swap",
            from: "MOCK_TOKEN",
            to: "MOCK_TOKEN",
            amount: "100.0"
          }
        ]
      }));
      
      // Create rebalance history with details
      const rebalanceData = {
        vaultId,
        type: "manual", // manual rebalance triggered by user
        status: "completed",
        transactions, // Add the transactions as required by the schema
        details: JSON.stringify({
          driftThreshold: vault.driftThreshold?.toString() || "5.00",
          needsRebalance,
          rebalanceFrequency: vault.rebalanceFrequency || "manual"
        })
      };
      
      // Update the vault's last rebalanced date
      await storage.updateVault(vaultId, {
        lastRebalanced: new Date()
      });
      
      const history = await storage.createRebalanceHistory(rebalanceData);
      return res.status(201).json({
        history,
        needsRebalance,
        message: needsRebalance 
          ? "Rebalance was necessary and has been completed successfully" 
          : "Rebalance completed, but was not necessary based on drift threshold"
      });
    } catch (error) {
      return res.status(500).json({ message: "Error triggering rebalance" });
    }
  });

  // Price feed routes
  api.get("/assets/:assetId/price", async (req: Request, res: Response) => {
    try {
      const assetId = parseInt(req.params.assetId);
      
      if (isNaN(assetId)) {
        return res.status(400).json({ message: "Invalid asset ID" });
      }
      
      const priceFeed = await storage.getLatestPriceByAssetId(assetId);
      
      if (!priceFeed) {
        return res.status(404).json({ message: "Price feed not found" });
      }
      
      return res.json(priceFeed);
    } catch (error) {
      return res.status(500).json({ message: "Error fetching price" });
    }
  });

  // Admin-only route to add price feed (would be replaced by oracle in production)
  api.post("/admin/price-feeds", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const priceFeedData = insertPriceFeedSchema.parse(req.body);
      const priceFeed = await storage.createPriceFeed(priceFeedData);
      return res.status(201).json(priceFeed);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      return res.status(500).json({ message: "Error creating price feed" });
    }
  });

  // API route to get real-time prices for all assets
  api.get("/prices", async (_req: Request, res: Response) => {
    try {
      // First try to get prices from the service
      const prices = await getAllAssetPrices();
      
      // For demo purposes, if no prices are returned, use sample data
      let priceData = prices;
      if (Object.keys(prices).length === 0) {
        // Sample prices for demo assets
        priceData = {
          "BTC": 65421.37,
          "ETH": 3512.89,
          "L1X": 28.76,
          "USDC": 1.00,
          "USDT": 1.00,
          "SOL": 142.67,
          "AVAX": 34.95,
          "MATIC": 0.78,
          "DOT": 6.82,
          "LINK": 14.32
        };
      }
      
      // Add 24h price change data for performance metrics
      const pricesWithHistory: Record<string, any> = {};
      
      for (const [symbol, price] of Object.entries(priceData)) {
        // Generate a realistic 24h change (between -15% and +15%)
        const changePercentage = (Math.random() * 30 - 15);
        const previousPrice = price / (1 + (changePercentage / 100));
        
        pricesWithHistory[symbol] = {
          current: price,
          previous24h: previousPrice,
          change24h: price - previousPrice,
          changePercentage24h: changePercentage
        };
      }
      
      return res.json(pricesWithHistory);
    } catch (error) {
      console.error("Error fetching all asset prices:", error);
      return res.status(500).json({ message: "Error fetching prices" });
    }
  });

  // API route to get real-time price for a specific asset by symbol
  api.get("/prices/:symbol", async (req: Request, res: Response) => {
    try {
      const symbol = req.params.symbol;
      if (!symbol) {
        return res.status(400).json({ message: "Symbol is required" });
      }
      
      const price = await getPrice(symbol);
      if (price === null) {
        return res.status(404).json({ message: `Price not found for symbol: ${symbol}` });
      }
      
      return res.json({ symbol, price });
    } catch (error) {
      console.error(`Error fetching price for ${req.params.symbol}:`, error);
      return res.status(500).json({ message: "Error fetching price" });
    }
  });

  // API route to get vault values with current prices
  api.get("/vaults/:vaultId/value", async (req: Request, res: Response) => {
    try {
      const vaultId = parseInt(req.params.vaultId);
      
      if (isNaN(vaultId)) {
        return res.status(400).json({ message: "Invalid vault ID" });
      }
      
      const vault = await storage.getVault(vaultId);
      if (!vault) {
        return res.status(404).json({ message: "Vault not found" });
      }
      
      const allocations = await storage.getAllocationsByVaultId(vaultId);
      if (allocations.length === 0) {
        return res.json({ vaultValue: 0, assetValues: [] });
      }
      
      // Get assets for each allocation
      const assetIds = allocations.map(allocation => allocation.assetId);
      const assets = await Promise.all(
        assetIds.map(assetId => storage.getAsset(assetId))
      );
      
      // Get real-time prices for all assets
      const symbols = assets.filter(Boolean).map(asset => asset!.symbol);
      const prices = await getPrices(symbols);
      
      // Calculate values
      let totalValue = 0;
      const assetValues = [];
      
      for (let i = 0; i < allocations.length; i++) {
        const allocation = allocations[i];
        const asset = assets[i];
        
        if (asset && prices[asset.symbol]) {
          // In a real app, you'd get the actual token amount from the blockchain
          // For now, we'll mock the token amount based on the percentage allocation
          const tokenAmount = parseInt(allocation.targetPercentage); // Using targetPercentage as mock token amount
          const assetValue = tokenAmount * prices[asset.symbol];
          
          totalValue += assetValue;
          assetValues.push({
            assetId: asset.id,
            symbol: asset.symbol,
            tokenAmount,
            price: prices[asset.symbol],
            value: assetValue
          });
        }
      }
      
      return res.json({
        vaultId,
        vaultValue: totalValue,
        assetValues,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error calculating vault value:`, error);
      return res.status(500).json({ message: "Error calculating vault value" });
    }
  });

  // Cross-Chain Swap routes
  api.post("/vaults/:vaultId/cross-chain-swap", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = (req.user as any).id;
      const vaultId = parseInt(req.params.vaultId);
      
      if (isNaN(vaultId)) {
        return res.status(400).json({ message: "Invalid vault ID" });
      }
      
      const vault = await storage.getVault(vaultId);
      
      if (!vault) {
        return res.status(404).json({ message: "Vault not found" });
      }
      
      if (vault.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Validate swap parameters
      const { fromAsset, toAsset, amount, targetChain } = req.body;
      
      if (!fromAsset || !toAsset || !amount || !targetChain) {
        return res.status(400).json({ message: "Missing required parameters" });
      }
      
      if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }
      
      // Get asset IDs
      const fromAssetObj = await storage.getAssetBySymbol(fromAsset);
      const toAssetObj = await storage.getAssetBySymbol(toAsset);
      
      if (!fromAssetObj || !toAssetObj) {
        return res.status(404).json({ message: "Asset not found" });
      }
      
      // Calculate expected received amount based on current prices
      const fromPrice = await getPrice(fromAsset);
      const toPrice = await getPrice(toAsset);
      
      if (fromPrice === null || toPrice === null) {
        return res.status(400).json({ message: "Price information not available" });
      }
      
      // Apply 0.5% swap fee
      const amountInUSD = parseFloat(amount) * fromPrice * 0.995;
      const receivedAmount = amountInUSD / toPrice;
      
      // In a real implementation, this would initiate a cross-chain swap
      // via the L1X blockchain's bridge/X-Talk protocol
      
      // For demo purposes, return a successful response with a mock tx hash
      // and expected completion time
      const txHash = `xswap_${Date.now().toString(36)}`;
      const completionTime = new Date(Date.now() + 3 * 60 * 1000).toISOString(); // 3 mins
      
      return res.json({
        success: true,
        message: "Cross-chain swap initiated",
        txHash,
        details: {
          fromAsset,
          toAsset,
          amount: parseFloat(amount),
          targetChain,
          estimatedReceivedAmount: receivedAmount,
          estimatedCompletionTime: completionTime
        }
      });
    } catch (error) {
      console.error("Error initiating cross-chain swap:", error);
      return res.status(500).json({ message: "Error initiating cross-chain swap" });
    }
  });

  // Register API routes
  app.use("/api", api);

  const httpServer = createServer(app);

  return httpServer;
}
