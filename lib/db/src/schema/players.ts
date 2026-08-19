import { pgTable, text, integer, bigint, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const playersTable = pgTable("players", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  discordId: text("discord_id").notNull().unique(),
  name: text("name").notNull(),
  realm: text("realm").notNull().default("Luyện Khí"),
  realmLevel: integer("realm_level").notNull().default(1),
  experience: bigint("experience", { mode: "bigint" }).notNull().default(0n),
  spiritStones: bigint("spirit_stones", { mode: "bigint" }).notNull().default(0n),
  health: integer("health").notNull().default(100),
  maxHealth: integer("max_health").notNull().default(100),
  mana: integer("mana").notNull().default(50),
  maxMana: integer("max_mana").notNull().default(50),
  attack: integer("attack").notNull().default(10),
  defense: integer("defense").notNull().default(5),
  isAlive: boolean("is_alive").notNull().default(true),
  
  // Tông Môn liên kết
  sectId: bigint("sect_id", { mode: "bigint" }),
  sectRole: text("sect_role"), // tong_chu, pho_tong_chu, truong_lao, chap_su, noi_mon, ngoai_mon

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPlayerSchema = createInsertSchema(playersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof playersTable.$inferSelect;
