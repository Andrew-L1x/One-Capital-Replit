import { pgTable, text, serial, integer, decimal, timestamp, boolean, json, primaryKey, foreignKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  walletAddress: text("wallet_address"),
  firebaseUid: text("firebase_uid").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  walletAddress: true,
  firebaseUid: true,
});

// Assets table (crypto tokens)
export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  decimals: integer("decimals").notNull().default(18),
  coingeckoId: text("coingecko_id"),
  chainId: text("chain_id").notNull(),
});

export const insertAssetSchema = createInsertSchema(assets).pick({
  symbol: true,
  name: true,
  description: true,
  decimals: true,
  coingeckoId: true,
  chainId: true,
});

// Vaults table
export const vaults = pgTable("vaults", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  isCustodial: boolean("is_custodial").notNull().default(true),
  contractAddress: text("contract_address"),
  // Rebalance settings
  driftThreshold: decimal("drift_threshold", { precision: 5, scale: 2 }).default("5.00").notNull(),
  rebalanceFrequency: text("rebalance_frequency").default("manual").notNull(), // manual, weekly, monthly, quarterly, yearly
  lastRebalanced: timestamp("last_rebalanced"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertVaultSchema = createInsertSchema(vaults).pick({
  userId: true,
  name: true,
  description: true,
  isCustodial: true,
  contractAddress: true,
  driftThreshold: true,
  rebalanceFrequency: true,
  lastRebalanced: true,
});

// Vault allocations table
export const allocations = pgTable("allocations", {
  id: serial("id").primaryKey(),
  vaultId: integer("vault_id").notNull().references(() => vaults.id),
  assetId: integer("asset_id").notNull().references(() => assets.id),
  targetPercentage: decimal("target_percentage", { precision: 5, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAllocationSchema = createInsertSchema(allocations).pick({
  vaultId: true,
  assetId: true,
  targetPercentage: true,
});

// Take profit settings table
export const takeProfitSettings = pgTable("take_profit_settings", {
  id: serial("id").primaryKey(),
  vaultId: integer("vault_id").notNull().references(() => vaults.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "manual", "time", "percentage"
  percentage: decimal("percentage", { precision: 5, scale: 2 }),
  interval: text("interval"), // "daily", "weekly", "monthly"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTakeProfitSettingsSchema = createInsertSchema(takeProfitSettings).pick({
  vaultId: true,
  type: true,
  percentage: true,
  interval: true,
});

// Rebalance history table
export const rebalanceHistory = pgTable("rebalance_history", {
  id: serial("id").primaryKey(),
  vaultId: integer("vault_id").notNull().references(() => vaults.id, { onDelete: "cascade" }),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  transactions: json("transactions").notNull(),
  status: text("status").notNull(), // "pending", "completed", "failed"
});

export const insertRebalanceHistorySchema = createInsertSchema(rebalanceHistory).pick({
  vaultId: true,
  transactions: true,
  status: true,
});

// Price feeds table
export const priceFeeds = pgTable("price_feeds", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  price: decimal("price", { precision: 18, scale: 8 }).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertPriceFeedSchema = createInsertSchema(priceFeeds).pick({
  assetId: true,
  price: true,
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  vaults: many(vaults),
}));

export const vaultsRelations = relations(vaults, ({ one, many }) => ({
  user: one(users, {
    fields: [vaults.userId],
    references: [users.id],
  }),
  allocations: many(allocations),
  takeProfitSettings: many(takeProfitSettings),
  rebalanceHistory: many(rebalanceHistory),
}));

export const allocationsRelations = relations(allocations, ({ one }) => ({
  vault: one(vaults, {
    fields: [allocations.vaultId],
    references: [vaults.id],
  }),
  asset: one(assets, {
    fields: [allocations.assetId],
    references: [assets.id],
  }),
}));

export const takeProfitSettingsRelations = relations(takeProfitSettings, ({ one }) => ({
  vault: one(vaults, {
    fields: [takeProfitSettings.vaultId],
    references: [vaults.id],
  }),
}));

export const rebalanceHistoryRelations = relations(rebalanceHistory, ({ one }) => ({
  vault: one(vaults, {
    fields: [rebalanceHistory.vaultId],
    references: [vaults.id],
  }),
}));

export const priceFeedsRelations = relations(priceFeeds, ({ one }) => ({
  asset: one(assets, {
    fields: [priceFeeds.assetId],
    references: [assets.id],
  }),
}));

export const assetsRelations = relations(assets, ({ many }) => ({
  allocations: many(allocations),
  priceFeeds: many(priceFeeds),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Asset = typeof assets.$inferSelect;
export type InsertAsset = z.infer<typeof insertAssetSchema>;

export type Vault = typeof vaults.$inferSelect;
export type InsertVault = z.infer<typeof insertVaultSchema>;

export type Allocation = typeof allocations.$inferSelect;
export type InsertAllocation = z.infer<typeof insertAllocationSchema>;

export type TakeProfitSetting = typeof takeProfitSettings.$inferSelect;
export type InsertTakeProfitSetting = z.infer<typeof insertTakeProfitSettingsSchema>;

export type RebalanceHistory = typeof rebalanceHistory.$inferSelect;
export type InsertRebalanceHistory = z.infer<typeof insertRebalanceHistorySchema>;

export type PriceFeed = typeof priceFeeds.$inferSelect;
export type InsertPriceFeed = z.infer<typeof insertPriceFeedSchema>;
