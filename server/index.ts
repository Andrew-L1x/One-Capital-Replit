import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import cors from "cors";

const app = express();

// Configure CORS for cross-origin requests
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // List of allowed origins
    const allowedOrigins = [
      // Local development
      'http://localhost:5000',
      'http://127.0.0.1:5000',
      // Replit domains
      '.replit.app',
      '.replit.dev',
      // Dynamic Labs domains
      'dynamic.xyz',
      'app.dynamic.xyz',
      '.dynamic.xyz',
      // Wallet providers
      'metamask.io',
      '.metamask.io',
      'infura.io',
      '.infura.io',
      'alchemy.com',
      '.alchemy.com',
      'wallet.coinbase.com',
      '.wallet.coinbase.com',
      'walletconnect.com',
      '.walletconnect.com',
    ];
    
    // Check if origin is in allowed list or matches a pattern
    const allowed = allowedOrigins.some(allowedOrigin => {
      if (allowedOrigin.startsWith('.') && origin) {
        // Check if origin ends with the allowed domain
        return origin.endsWith(allowedOrigin.substring(1));
      }
      return allowedOrigin === origin;
    });
    
    if (allowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true, // Allow cookies to be sent with requests
  maxAge: 86400 // Cache preflight requests for 1 day
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use PORT from environment or default to 5000
  const port = process.env.PORT || 5000;
  server.listen({
    port,
    host: "0.0.0.0", // Listen on all network interfaces
    reusePort: true,
  }, () => {
    log(`Server listening on port ${port}`);
  });
})();
