import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from 'ws';
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
import { getPriceForAsset, getPricesWithChange } from "./services/priceFeed";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import session from "express-session";
import memoryStoreCreator from "memorystore";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import cors from "cors";

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
        console.log("LocalStrategy - Login attempt", { username });
        
        // Special case for demo user
        if (username.toLowerCase() === 'demo@example.com') {
          console.log("LocalStrategy - Demo user login attempt");
          
          // For the demo user, accept either the correct password or "password123"
          if (password === 'password123') {
            console.log("LocalStrategy - Demo user login successful with password123");
            
            // Get the demo user from the database
            const demoUser = await storage.getUserByEmail('demo@example.com');
            if (demoUser) {
              return done(null, demoUser);
            } else {
              // Create a hardcoded demo user if it doesn't exist in the database
              const hardcodedDemoUser = {
                id: 9,
                username: "demo",
                email: "demo@example.com",
                password: "$2a$10$n/54cGhzT3L9.v0zdQlM8eYHRAVDnbj8xtBrWzQkwXGLlcfYcDEhe", // hashed password123
                createdAt: new Date()
              };
              console.log("LocalStrategy - Using hardcoded demo user");
              return done(null, hardcodedDemoUser);
            }
          }
        }
        
        // Regular login flow for other users
        // Convert username to lowercase for case-insensitive comparison
        // Also support login with email
        let user = null;
        
        if (username.includes('@')) {
          // Try to find by email if username contains @ symbol
          user = await storage.getUserByEmail(username);
        } else {
          // Try by username
          user = await storage.getUserByUsername(username);
        }
        
        // If still not found, try case-insensitive search
        if (!user) {
          // This would ideally be handled at the database level with LOWER() function
          // For our in-memory implementation, we do a simple workaround
          const allUsers = await storage.getAllUsers();
          user = allUsers.find(u => 
            u.username.toLowerCase() === username.toLowerCase() || 
            (u.email && u.email.toLowerCase() === username.toLowerCase())
          );
        }
        
        if (!user) {
          console.log("LocalStrategy - User not found", { username });
          return done(null, false, { message: "User not found. Please check your username or email." });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          console.log("LocalStrategy - Incorrect password", { username });
          return done(null, false, { message: "Incorrect password" });
        }

        console.log("LocalStrategy - Login successful", { userId: user.id, email: user.email });
        return done(null, user);
      } catch (err) {
        console.error("LocalStrategy - Error during authentication:", err);
        return done(err);
      }
    })
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      // For development purposes, if the ID is 1 (our test user), reconstruct the user object
      if (id === 1) {
        const testUser = {
          id: 1,
          username: "test_user",
          email: "test@example.com",
          walletAddress: "0x1234...5678",
          firebaseUid: "test-firebase-uid",
          createdAt: new Date(),
        };
        return done(null, testUser);
      }
      
      // For development purposes, if the ID is 9 (our demo user), reconstruct the user object
      if (id === 9) {
        const demoUser = {
          id: 9,
          username: "demo",
          email: "demo@example.com",
          createdAt: new Date(),
        };
        return done(null, demoUser);
      }
      
      // For other users, try to load from the database
      const user = await storage.getUser(id);
      if (!user) {
        // User not found
        return done(new Error(`User with ID ${id} not found`), null);
      }
      
      done(null, user);
    } catch (err) {
      console.error("Error deserializing user:", err);
      done(err);
    }
  });

  const api = express.Router();

  // Auth routes
  api.post("/auth/register", async (req: Request, res: Response) => {
    try {
      // Parse and validate the input data
      const userData = insertUserSchema.parse(req.body);
      
      // No modification to username - keep it exactly as provided by the user
      const username = userData.username.trim();
      
      // Better validations
      if (!username) {
        return res.status(400).json({ message: "Username cannot be empty" });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already taken" });
      }
      
      // Check if email already exists
      if (userData.email) {
        const existingEmail = await storage.getUserByEmail(userData.email);
        if (existingEmail) {
          return res.status(400).json({ message: "Email already in use" });
        }
      }
      
      console.log(`Creating new standard user account: ${username}`);

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      // Create user with hashed password, using exact username provided
      const user = await storage.createUser({
        ...userData,
        username, // Use our verified username
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

  // Demo login endpoint for direct login with demo user
  api.post("/auth/demo-login", async (req: Request, res: Response) => {
    console.log("POST /auth/demo-login - Demo login bypass");
    
    try {
      // Create a session for the demo user with ID 9
      const demoUser = {
        id: 9,
        username: "demo",
        email: "demo@example.com",
        createdAt: new Date()
      };
      
      req.login(demoUser, (err) => {
        if (err) {
          console.error("POST /auth/demo-login - Login error:", err);
          return res.status(500).json({ message: "Error logging in demo user" });
        }
        
        console.log("POST /auth/demo-login - Demo login successful");
        return res.json(demoUser);
      });
    } catch (error) {
      console.error("POST /auth/demo-login - Error:", error);
      return res.status(500).json({ message: "Server error" });
    }
  });

  api.post("/auth/login", async (req: Request, res: Response, next: NextFunction) => {
    console.log("POST /auth/login - Login attempt", { 
      email: req.body.username || 'no-email-provided',
      hasPassword: !!req.body.password
    });
    
    // Special handling for demo user - bypass normal authentication
    if (req.body.username === 'demo@example.com' && req.body.password === 'password123') {
      console.log("POST /auth/login - Direct login for demo user with password123");
      
      try {
        // Get the demo user from the database if possible
        const demoUser = await storage.getUserByEmail('demo@example.com');
        
        if (demoUser) {
          req.login(demoUser, (err) => {
            if (err) {
              console.error("POST /auth/login - Error logging in demo user:", err);
              return next(err);
            }
            
            const { password, ...demoUserWithoutPassword } = demoUser;
            console.log("POST /auth/login - Demo user login successful (from database)");
            return res.json(demoUserWithoutPassword);
          });
        } else {
          // Use hardcoded demo user if not in database
          const hardcodedDemoUser = {
            id: 9,
            username: "demo",
            email: "demo@example.com",
            createdAt: new Date()
          };
          
          req.login(hardcodedDemoUser, (err) => {
            if (err) {
              console.error("POST /auth/login - Error logging in hardcoded demo user:", err);
              return next(err);
            }
            
            console.log("POST /auth/login - Demo user login successful (hardcoded)");
            return res.json(hardcodedDemoUser);
          });
        }
        return; // Early return for demo user
      } catch (error) {
        console.error("POST /auth/login - Error handling demo user:", error);
        // Continue with normal authentication flow if there's an error
      }
    }
    
    // Normal authentication flow for all other users
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        console.error("POST /auth/login - Authentication error:", err);
        return next(err);
      }
      
      if (!user) {
        console.log("POST /auth/login - Authentication failed", { message: info.message });
        return res.status(401).json({ message: info.message || "Authentication failed" });
      }
      
      req.login(user, (err) => {
        if (err) {
          console.error("POST /auth/login - Login error:", err);
          return next(err);
        }
        
        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        console.log("POST /auth/login - Successful login", { 
          userId: user.id, 
          email: user.email 
        });
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

  api.get("/auth/me", async (req: Request, res: Response) => {
    console.log("GET /auth/me - Request received", {
      isAuthenticated: req.isAuthenticated(),
      sessionUserId: req.user ? (req.user as any).id : null
    });
    
    if (!req.isAuthenticated()) {
      // For development purposes, auto-login the demo user
      // First, try to get the actual demo user from the database
      try {
        const demoUser = await storage.getUserByEmail("demo@example.com");
        
        if (demoUser) {
          // Use the actual demo user from the database
          const { password, ...demoUserWithoutPassword } = demoUser;
          console.log("GET /auth/me - Auto-logging in demo user from database", { 
            userId: demoUser.id, 
            email: demoUser.email 
          });
          
          req.login(demoUser, (err) => {
            if (err) {
              console.error("GET /auth/me - Error auto-login demo user:", err);
              return res.status(401).json({ message: "Not authenticated" });
            }
            console.log("GET /auth/me - Auto-logged in demo user from database");
            return res.json(demoUserWithoutPassword);
          });
        } else {
          // Fall back to a hardcoded demo user
          const hardcodedDemoUser = {
            id: 9,
            username: "demo",
            email: "demo@example.com",
            createdAt: new Date().toISOString(),
          };
          
          console.log("GET /auth/me - Using hardcoded demo user");
          req.login(hardcodedDemoUser, (err) => {
            if (err) {
              console.error("GET /auth/me - Error auto-login hardcoded demo user:", err);
              return res.status(401).json({ message: "Not authenticated" });
            }
            console.log("GET /auth/me - Auto-logged in hardcoded demo user");
            return res.json(hardcodedDemoUser);
          });
        }
      } catch (error) {
        console.error("GET /auth/me - Error retrieving demo user:", error);
        return res.status(401).json({ message: "Not authenticated" });
      }
    } else {
      // User is already authenticated, return their information
      try {
        const { password, ...userWithoutPassword } = req.user as any;
        console.log("GET /auth/me - Returning authenticated user", { 
          userId: (req.user as any).id,
          email: (req.user as any).email
        });
        return res.json(userWithoutPassword);
      } catch (error) {
        console.error("GET /auth/me - Error returning authenticated user:", error);
        return res.status(500).json({ message: "Error retrieving user data" });
      }
    }
  });

  // Find user by email endpoint
  api.get("/auth/find-by-email", async (req: Request, res: Response) => {
    try {
      const email = req.query.email as string;
      if (!email) {
        return res.status(400).json({ message: "Email parameter is required" });
      }
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Only return the username, not the full user object for security
      return res.json({ username: user.username });
    } catch (error) {
      console.error("Error finding user by email:", error);
      return res.status(500).json({ message: "Server error while finding user" });
    }
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
        // Create a clean username from the provided username or from the email (remove @ and domain)
        // Important: Preserve the exact username provided by the user for a better experience
        let username = '';
        
        if (providedUsername && providedUsername.trim()) {
          // Use the username provided during registration
          username = providedUsername.trim();
          console.log(`Using provided username: ${username}`);
        } else {
          // No username provided, create one from email
          username = email.split('@')[0].trim();
          console.log(`Created username from email: ${username}`);
        }
        
        // Validate username isn't empty after cleaning
        if (!username) {
          return res.status(400).json({ message: "Invalid username" });
        }
        
        // Check if username already exists
        const existingUserWithUsername = await storage.getUserByUsername(username);
        if (existingUserWithUsername) {
          return res.status(400).json({ 
            message: "Username already taken. Please choose a different username." 
          });
        }
        
        // Check if email already exists but with different Firebase UID
        const existingUserWithEmail = await storage.getUserByEmail(email);
        if (existingUserWithEmail && existingUserWithEmail.firebaseUid !== firebaseUid) {
          return res.status(400).json({ 
            message: "Email already associated with another account." 
          });
        }
        
        console.log(`Creating new Firebase user account with username: ${username} and email: ${email}`);
        
        user = await storage.createUser({
          username,
          email,
          // Create a secure password, but not one with random numbers that would affect display
          password: await bcrypt.hash(`firebase-auth-${firebaseUid.slice(0, 10)}`, 10),
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
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = (req.user as any).id;
      
      // Only show test vaults for the test user (id: 1)
      // For new users, return an empty array so they can create their own vaults
      if (userId === 1) {
        console.log("Providing test vaults for test user");
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
      } else {
        // For real users, get their vaults from the database
        const vaults = await storage.getVaultsByUserId(userId);
        return res.json(vaults);
      }
      
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
      console.log("GET /vaults/:vaultId/allocations - Request received", { 
        vaultId: req.params.vaultId,
        isAuthenticated: req.isAuthenticated(),
        user: req.user 
      });
      
      if (!req.isAuthenticated()) {
        console.log("GET /vaults/:vaultId/allocations - User not authenticated");
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = (req.user as any).id;
      const vaultId = parseInt(req.params.vaultId);
      
      console.log(`GET /vaults/${vaultId}/allocations - User authenticated`, { userId });
      
      if (isNaN(vaultId)) {
        console.log(`GET /vaults/${vaultId}/allocations - Invalid vault ID`);
        return res.status(400).json({ message: "Invalid vault ID" });
      }
      
      // Use real database storage
      const vault = await storage.getVault(vaultId);
      console.log(`GET /vaults/${vaultId}/allocations - Vault lookup result:`, { vault });
      
      if (!vault) {
        console.log(`Vault not found: ID ${vaultId}`);
        return res.status(404).json({ message: "Vault not found" });
      }
      
      if (vault.userId !== userId) {
        console.log(`Access denied to vault ${vaultId} for user ${userId}. Vault belongs to user ${vault.userId}`);
        return res.status(403).json({ message: "Access denied" });
      }
      
      const allocations = await storage.getAllocationsByVaultId(vaultId);
      console.log(`Fetched ${allocations.length} allocations for vault ${vaultId}`, {
        allocations,
        vault,
        userId
      });
      return res.json(allocations);
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
      
      // Determine if this is a custodial vault (in a real implementation this would be 
      // determined by the vault type from the database)
      const isCustodial = req.body.isCustodial !== undefined 
        ? Boolean(req.body.isCustodial) 
        : true;
      
      // Import the contract rebalance service dynamically (to avoid circular dependencies)
      const { executeContractRebalance } = await import('./services/contractRebalance');
      
      // Execute contract rebalance
      const result = await executeContractRebalance(vaultId, isCustodial);
      
      // Create a rebalance history record for the event
      const rebalanceRecord = await storage.createRebalanceHistory({
        vaultId,
        status: result.success ? 'completed' : 'failed',
        type: "manual", // This was triggered manually
        details: result.details || result.message
      });
      
      // Broadcast to WebSocket clients for real-time updates
      try {
        broadcastToChannel('rebalance', {
          vaultId,
          success: result.success,
          message: result.message,
          details: result.details,
          timestamp: new Date().toISOString()
        }, vaultId, userId);
        
        // Also broadcast to the vaults channel for UI updates
        broadcastToChannel('vaults', {
          action: 'updated',
          vaultId,
          lastRebalanced: new Date().toISOString()
        }, vaultId, userId);
        
        console.log(`Rebalance event broadcast for vault ${vaultId}`);
      } catch (wsError) {
        console.error('Error broadcasting rebalance event:', wsError);
        // Don't fail the API call if WebSocket broadcast fails
      }
      
      if (result.success) {
        return res.status(201).json({
          success: true,
          message: result.message,
          details: result.details,
          rebalanceRecord
        });
      } else {
        return res.status(400).json({
          success: false,
          message: result.message
        });
      }
    } catch (error) {
      console.error("Error triggering rebalance:", error);
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
      // Get prices with 24h change data
      const pricesWithHistory = await getPricesWithChange();
      return res.json(pricesWithHistory);
    } catch (error) {
      console.error("Error fetching all asset prices:", error);
      return res.status(500).json({ message: "Error fetching prices" });
    }
  });

  // API route to get historical price data for portfolio
  api.get("/prices/history/:timeRange", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = (req.user as any).id;
      const timeRange = req.params.timeRange as '7d' | '30d' | '90d' | '1y';
      
      if (!timeRange || !['7d', '30d', '90d', '1y'].includes(timeRange)) {
        return res.status(400).json({ message: "Valid time range is required (7d, 30d, 90d, 1y)" });
      }
      
      // Get user's vaults
      const vaults = await storage.getVaultsByUserId(userId);
      if (!vaults || vaults.length === 0) {
        return res.json([]);
      }
      
      // Use the user's primary vault for historical data
      const vault = vaults[0];
      
      // Get allocations for the vault
      const allocations = await storage.getAllocationsByVaultId(vault.id);
      if (!allocations || allocations.length === 0) {
        return res.json([]);
      }
      
      // Get associated assets
      const assets: Record<number, any> = {};
      for (const allocation of allocations) {
        const asset = await storage.getAsset(allocation.assetId);
        if (asset) {
          assets[asset.id] = asset;
        }
      }
      
      // Calculate days to go back based on time range
      let daysToGoBack = 0;
      switch (timeRange) {
        case '7d': daysToGoBack = 7; break;
        case '30d': daysToGoBack = 30; break;
        case '90d': daysToGoBack = 90; break;
        case '1y': daysToGoBack = 365; break;
      }
      
      // Get current price info
      const currentPrices = await getPricesWithChange();
      
      // Generate historical data points
      const historicalData = [];
      const now = new Date();
      
      // Start from the earliest date and move forward
      for (let i = daysToGoBack; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        
        // Format date for display
        const formattedDate = `${date.getMonth() + 1}/${date.getDate()}`;
        
        // Calculate portfolio value and individual asset values for this day
        let portfolioValue = 0;
        const assetPrices: Record<string, number> = {};
        
        // For each asset in the portfolio
        for (const allocation of allocations) {
          const asset = assets[allocation.assetId];
          if (!asset || !currentPrices[asset.symbol]) continue;
          
          // For real price history, we'd query the database for historical prices
          // For now, we'll calculate a synthetic price based on the current price
          // but with randomization appropriate for the timeframe
          const currentPrice = currentPrices[asset.symbol].current;
          
          // Volatility factor based on the asset type and time from now
          const volatilityFactor = i / daysToGoBack * (asset.symbol === 'BTC' ? 0.15 : 0.2);
          const daysSinceStart = daysToGoBack - i;
          
          // Calculate a relatively realistic price based on current price
          // with more deviation the further back in time we go
          const previousPrice = currentPrice * (1 - volatilityFactor + (Math.sin(daysSinceStart / 10) * volatilityFactor));
          
          // Store asset price
          assetPrices[asset.symbol] = previousPrice;
          
          // Get the allocation amount derived from percentage
          const allocationAmount = parseFloat(allocation.targetPercentage);
          
          // Add to portfolio value
          portfolioValue += allocationAmount * previousPrice;
        }
        
        // Create data point
        const dataPoint: any = {
          date: date.getTime(),
          formattedDate,
          portfolioValue: parseFloat(portfolioValue.toFixed(2)),
          assets: { ...assetPrices }
        };
        
        historicalData.push(dataPoint);
      }
      
      return res.json(historicalData);
      
    } catch (error) {
      console.error("Error fetching historical price data:", error);
      return res.status(500).json({ message: "Error fetching historical price data" });
    }
  });
  
  // API route to get real-time price for a specific asset by symbol
  api.get("/prices/:symbol", async (req: Request, res: Response) => {
    try {
      // Skip for 'history' parameter which is handled by a different endpoint
      if (req.params.symbol === 'history') {
        return res.status(400).json({ message: "Invalid symbol" });
      }
      
      const symbol = req.params.symbol;
      if (!symbol) {
        return res.status(400).json({ message: "Symbol is required" });
      }
      
      const price = await getPriceForAsset(symbol);
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
      // Get the prices for all assets
      const pricesWithHistory = await getPricesWithChange();
      // Extract just the current prices for calculation
      const prices: Record<string, number> = {};
      Object.entries(pricesWithHistory).forEach(([symbol, data]) => {
        prices[symbol] = data.current;
      });
      
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
      
      // Import the cross-chain swap service
      const { executeSwap, Chain, SwapStatus } = await import('./services/crossChainSwap');
      
      // Validate swap request parameters
      const { 
        fromAsset, 
        toAsset, 
        amount, 
        fromChain = Chain.L1X, // Default from chain is L1X
        toChain,
        slippageTolerance = 0.5, // Default slippage tolerance is 0.5%
        walletAddress 
      } = req.body;
      
      if (!fromAsset || !toAsset || !amount) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing required parameters (fromAsset, toAsset, amount)" 
        });
      }
      
      if (!toChain) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing required parameter: toChain" 
        });
      }
      
      if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid amount - must be a positive number" 
        });
      }
      
      // Validate that the chains are supported
      const supportedChains = Object.values(Chain);
      if (!supportedChains.includes(fromChain) || !supportedChains.includes(toChain)) {
        return res.status(400).json({ 
          success: false, 
          message: `Unsupported blockchain. Supported chains: ${supportedChains.join(', ')}` 
        });
      }
      
      // Get asset objects to verify they exist
      const fromAssetObj = await storage.getAssetBySymbol(fromAsset);
      const toAssetObj = await storage.getAssetBySymbol(toAsset);
      
      if (!fromAssetObj || !toAssetObj) {
        return res.status(404).json({ 
          success: false, 
          message: `Asset not found: ${!fromAssetObj ? fromAsset : toAsset}` 
        });
      }
      
      // Execute the swap
      const swapResult = await executeSwap({
        vaultId,
        fromAsset,
        toAsset,
        amount,
        fromChain,
        toChain,
        slippageTolerance,
        walletAddress
      });
      
      // Return the result based on status
      if (swapResult.status === SwapStatus.COMPLETED) {
        return res.status(200).json({
          success: true,
          message: "Cross-chain swap executed successfully",
          transaction: swapResult
        });
      } else if (swapResult.status === SwapStatus.PENDING) {
        return res.status(202).json({
          success: true,
          message: "Cross-chain swap initiated, pending completion",
          transaction: swapResult
        });
      } else {
        return res.status(400).json({
          success: false,
          message: swapResult.errorMessage || "Swap failed",
          transaction: swapResult
        });
      }
    } catch (error) {
      console.error("Error executing cross-chain swap:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Error executing cross-chain swap", 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get swap status by ID
  api.get("/swaps/:swapId", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const swapId = req.params.swapId;
      
      if (!swapId) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing swap ID" 
        });
      }
      
      // Import the cross-chain swap service
      const { getSwapStatus } = await import('./services/crossChainSwap');
      
      // Get swap status
      const swapStatus = await getSwapStatus(swapId);
      
      if (!swapStatus) {
        return res.status(404).json({ 
          success: false, 
          message: "Swap not found or expired" 
        });
      }
      
      return res.json({
        success: true,
        swap: swapStatus
      });
    } catch (error) {
      console.error("Error checking swap status:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Error checking swap status", 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // API endpoint for getting a swap quote (price estimate)
  api.post("/swaps/quote", async (req: Request, res: Response) => {
    try {
      // Import the cross-chain swap service
      const { getSwapQuote, Chain } = await import('./services/crossChainSwap');
      
      // Validate request parameters
      const { 
        fromAsset, 
        toAsset, 
        amount, 
        fromChain = Chain.L1X, 
        toChain,
        slippageTolerance 
      } = req.body;
      
      if (!fromAsset || !toAsset || !amount || !toChain) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing required parameters" 
        });
      }
      
      // Validate amount
      if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid amount - must be a positive number" 
        });
      }
      
      // Get quote
      const quote = await getSwapQuote(
        fromAsset, 
        toAsset, 
        amount, 
        fromChain, 
        toChain, 
        slippageTolerance
      );
      
      return res.json({
        success: true,
        quote
      });
    } catch (error) {
      console.error("Error getting swap quote:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Error getting swap quote", 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Wallet Integration API endpoints
  api.post("/wallet/connect", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const { address, walletType, chainId } = req.body;
      
      if (!address || !walletType) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing required parameters (address, walletType)" 
        });
      }
      
      // Import the wallet integration service
      const { connectWallet, WalletType, ConnectionStatus } = await import('./services/walletIntegration');
      
      // Validate wallet type
      if (!Object.values(WalletType).includes(walletType)) {
        return res.status(400).json({ 
          success: false, 
          message: `Unsupported wallet type. Supported types: ${Object.values(WalletType).join(', ')}` 
        });
      }
      
      // Connect to the wallet
      const connection = await connectWallet(address, walletType, chainId);
      
      if (connection.status === ConnectionStatus.ERROR) {
        return res.status(400).json({
          success: false,
          message: "Failed to connect to wallet",
          error: connection.error
        });
      }
      
      return res.json({
        success: true,
        message: "Wallet connected successfully",
        connection
      });
    } catch (error) {
      console.error("Error connecting to wallet:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Error connecting to wallet", 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  api.post("/wallet/sign-message", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const { address, walletType, message } = req.body;
      
      if (!address || !walletType || !message) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing required parameters (address, walletType, message)" 
        });
      }
      
      // Import the wallet integration service
      const { signMessage, WalletType } = await import('./services/walletIntegration');
      
      // Validate wallet type
      if (!Object.values(WalletType).includes(walletType)) {
        return res.status(400).json({ 
          success: false, 
          message: `Unsupported wallet type. Supported types: ${Object.values(WalletType).join(', ')}` 
        });
      }
      
      // Sign the message
      const result = await signMessage(address, walletType, message);
      
      if ('error' in result) {
        return res.status(400).json({
          success: false,
          message: "Failed to sign message",
          error: result.error
        });
      }
      
      return res.json({
        success: true,
        message: "Message signed successfully",
        signature: result.signature
      });
    } catch (error) {
      console.error("Error signing message:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Error signing message", 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  api.post("/wallet/transaction", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const { walletAddress, walletType, chainId, to, value, data, gasLimit } = req.body;
      
      if (!walletAddress || !walletType || !chainId || !to || !value) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing required parameters (walletAddress, walletType, chainId, to, value)" 
        });
      }
      
      // Import the wallet integration service
      const { sendTransaction, WalletType } = await import('./services/walletIntegration');
      
      // Validate wallet type
      if (!Object.values(WalletType).includes(walletType)) {
        return res.status(400).json({ 
          success: false, 
          message: `Unsupported wallet type. Supported types: ${Object.values(WalletType).join(', ')}` 
        });
      }
      
      // Send the transaction
      const txResponse = await sendTransaction({
        walletAddress,
        walletType,
        chainId,
        to,
        value,
        data,
        gasLimit
      });
      
      if (txResponse.status === 'failed') {
        return res.status(400).json({
          success: false,
          message: "Transaction failed",
          error: txResponse.error
        });
      }
      
      return res.json({
        success: true,
        message: txResponse.status === 'confirmed' ? "Transaction confirmed" : "Transaction submitted",
        transaction: txResponse
      });
    } catch (error) {
      console.error("Error sending transaction:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Error sending transaction", 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  api.get("/wallet/transaction/:chainId/:txHash", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const { chainId, txHash } = req.params;
      
      if (!chainId || !txHash) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing required parameters (chainId, txHash)" 
        });
      }
      
      // Import the wallet integration service
      const { getTransactionStatus } = await import('./services/walletIntegration');
      
      // Get transaction status
      const txStatus = await getTransactionStatus(txHash, chainId);
      
      if (txStatus.status === 'failed') {
        return res.status(400).json({
          success: false,
          message: "Failed to get transaction status",
          error: txStatus.error
        });
      }
      
      return res.json({
        success: true,
        transaction: txStatus
      });
    } catch (error) {
      console.error("Error getting transaction status:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Error getting transaction status", 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  api.post("/wallet/swap", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const { 
        fromAsset, 
        toAsset, 
        amount, 
        fromChain, 
        toChain, 
        walletAddress, 
        walletType 
      } = req.body;
      
      if (!fromAsset || !toAsset || !amount || !fromChain || !toChain || !walletAddress || !walletType) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing required parameters" 
        });
      }
      
      // Import the wallet integration service
      const { executeWalletSwap, WalletType } = await import('./services/walletIntegration');
      
      // Validate wallet type
      if (!Object.values(WalletType).includes(walletType)) {
        return res.status(400).json({ 
          success: false, 
          message: `Unsupported wallet type. Supported types: ${Object.values(WalletType).join(', ')}` 
        });
      }
      
      // Execute the wallet swap
      const result = await executeWalletSwap(
        fromAsset,
        toAsset,
        amount,
        fromChain,
        toChain,
        walletAddress,
        walletType
      );
      
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: "Swap failed",
          error: result.error
        });
      }
      
      return res.json({
        success: true,
        message: "Swap initiated successfully",
        txHash: result.txHash
      });
    } catch (error) {
      console.error("Error executing wallet swap:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Error executing wallet swap", 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Configure CORS specifically for API routes
  const apiCorsOptions = {
    // Allow credentials (cookies, authorization headers, etc.)
    credentials: true,
    // Add specific headers needed for wallet connections
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'X-Requested-With', 
      'x-api-key',
      'x-signature',
      'x-wallet-address',
      'x-chain-id'
    ],
    // Allow all HTTP methods needed for wallet interactions
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    // Cache preflight requests for 1 hour
    maxAge: 3600
  };

  // Register API routes with CORS
  app.use("/api", cors(apiCorsOptions), api);

  const httpServer = createServer(app);
  
  // Initialize WebSocket server on a different path from Vite HMR
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    // Add ping-pong mechanism to detect broken connections
    clientTracking: true,
    // Handle WebSocket headers for CORS verification
    verifyClient: (info, callback) => {
      const origin = info.req.headers.origin;
      
      // Allow requests with no origin (like mobile apps or direct WebSocket connections)
      if (!origin) {
        return callback(true);
      }
      
      // List of allowed origins for WebSocket connections
      const allowedWsOrigins = [
        // Local development
        'http://localhost:5000',
        'http://127.0.0.1:5000',
        // Replit domains
        '.replit.app',
        '.replit.dev',
        // Wallet providers
        'metamask.io',
        '.metamask.io',
        'walletconnect.com',
        '.walletconnect.com',
        // Dynamic Labs domains
        'dynamic.xyz',
        'app.dynamic.xyz',
        '.dynamic.xyz'
      ];
      
      // Check if origin is in allowed list or matches a pattern
      const allowed = allowedWsOrigins.some(allowedOrigin => {
        if (allowedOrigin.startsWith('.') && origin) {
          // Check if origin ends with the allowed domain
          return origin.endsWith(allowedOrigin.substring(1));
        }
        return allowedOrigin === origin;
      });
      
      if (allowed) {
        callback(true);
      } else {
        console.warn(`WebSocket connection from disallowed origin: ${origin}`);
        callback(false, 403, 'Origin not allowed');
      }
    },
    perMessageDeflate: {
      zlibDeflateOptions: {
        chunkSize: 1024,
        memLevel: 7,
        level: 3
      },
      zlibInflateOptions: {
        chunkSize: 10 * 1024
      },
      // Below options are specified as default values
      concurrencyLimit: 10, // Limits zlib concurrency for performance
      threshold: 1024 // Size below which messages are not compressed
    }
  });
  
  // Keep track of connected clients with their subscriptions
  const clients = new Map();
  
  // For connection health checking - ping clients every 30 seconds
  const pingInterval = setInterval(() => {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.ping(() => {});
      }
    });
  }, 30000);
  
  // Handle WebSocket subscription requests
  function handleSubscription(ws: WebSocket, data: any) {
    const { channels, vaultId, userId } = data;
    
    // Array of channels to subscribe to
    const channelsToSubscribe = Array.isArray(channels) ? channels : [channels];
    
    // Validate the channels
    const validChannels = channelsToSubscribe.filter(channel => 
      ['prices', 'vaults', 'rebalance', 'transactions'].includes(channel)
    );
    
    const invalidChannels = channelsToSubscribe.filter(channel => 
      !['prices', 'vaults', 'rebalance', 'transactions'].includes(channel)
    );
    
    if (invalidChannels.length > 0) {
      ws.send(JSON.stringify({
        type: 'error',
        message: `Invalid channels: ${invalidChannels.join(', ')}`
      }));
    }
    
    if (validChannels.length === 0) {
      return;
    }
    
    // Store client subscription
    if (!clients.has(ws)) {
      clients.set(ws, { channels: [] });
    }
    
    const clientData = clients.get(ws);
    
    // Add each valid channel as a subscription
    validChannels.forEach(channel => {
      // Check if already subscribed to this channel + vaultId + userId combination
      const existingSubscription = clientData.channels.find((sub: Subscription) =>
        sub.channel === channel && 
        sub.vaultId === vaultId && 
        sub.userId === userId
      );
      
      if (!existingSubscription) {
        clientData.channels.push({
          channel,
          vaultId,
          userId
        });
        
        // Send confirmation for each channel
        ws.send(JSON.stringify({
          type: 'subscribed',
          channel,
          vaultId,
          userId
        }));
        
        console.log(`Client subscribed to ${channel}${vaultId ? ` for vault ${vaultId}` : ''}${userId ? ` for user ${userId}` : ''}`);
      }
    });
  }
  
  // Define subscription type
  interface Subscription {
    channel: string;
    vaultId?: number;
    userId?: number;
  }
  
  // Broadcast updates to all relevant subscribers
  function broadcastToChannel(channel: string, data: any, vaultId?: number, userId?: number) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        const clientData = clients.get(client);
        if (clientData && clientData.channels.some((sub: Subscription) => 
          sub.channel === channel && 
          (!vaultId || sub.vaultId === vaultId) && 
          (!userId || sub.userId === userId)
        )) {
          try {
            client.send(JSON.stringify({
              type: 'update',
              channel,
              vaultId,
              userId,
              data,
              timestamp: new Date().toISOString()
            }));
          } catch (err) {
            console.error('Error sending message to client:', err);
          }
        }
      }
    });
  }
  
  // WebSocket connection handling
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    // Send initial connection confirmation
    ws.send(JSON.stringify({
      type: 'connection',
      status: 'connected',
      timestamp: new Date().toISOString()
    }));
    
    // Handle incoming messages
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received WebSocket message:', data);
        
        // Handle subscription requests
        if (data.type === 'subscribe') {
          handleSubscription(ws, data);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        }));
      }
    });
    
    // Handle ping response
    ws.on('pong', () => {
      // Client is still alive
    });
    
    // Handle disconnection
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      clients.delete(ws);
    });
    
    // Handle errors
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });
  
  // Send initial prices to all new connections
  wss.on('connection', async (ws) => {
    try {
      const prices = await getPricesWithChange();
      
      // Send initial prices to the new client
      ws.send(JSON.stringify({
        type: 'update',
        channel: 'prices',
        data: { prices },
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error sending initial prices to new client:', error);
    }
  });
  
  // Broadcast price updates every 30 seconds (reduced frequency)
  setInterval(async () => {
    try {
      const prices = await getPricesWithChange();
      broadcastToChannel('prices', { prices });
    } catch (error) {
      console.error('Error broadcasting price updates:', error);
    }
  }, 30000); // 30 seconds
  
  // Clean up on server shutdown
  httpServer.on('close', () => {
    clearInterval(pingInterval);
  });
  
  console.log('WebSocket server initialized on path /ws');
  
  return httpServer;
}
