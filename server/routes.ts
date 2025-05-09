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
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import session from "express-session";
import memoryStoreCreator from "memorystore";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";

const MemoryStore = memoryStoreCreator(session);

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
      // TEMPORARY: Return mock vault by ID
      const vaultId = parseInt(req.params.id);
      
      if (isNaN(vaultId)) {
        return res.status(400).json({ message: "Invalid vault ID" });
      }
      
      // Simulated vaults data
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
      
      const vault = testVaults.find(v => v.id === vaultId);
      
      if (!vault) {
        return res.status(404).json({ message: "Vault not found" });
      }
      
      return res.json(vault);
      
      /* Normal authentication code
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
      
      return res.json(vault);
      */
    } catch (error) {
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
      
      // Create rebalance history
      const rebalanceData = {
        vaultId,
        transactions,
        status: "completed"
      };
      
      const history = await storage.createRebalanceHistory(rebalanceData);
      return res.status(201).json(history);
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

  // Register API routes
  app.use("/api", api);

  const httpServer = createServer(app);

  return httpServer;
}
