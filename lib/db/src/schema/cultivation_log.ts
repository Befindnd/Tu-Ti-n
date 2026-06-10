import { pgTable, text, bigint, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cultivationLogTable = pgTable("cultivation_log", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  discordId: text("discord_id").notNull(),
  action: text("action").notNull(),
  detail: text("detail"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCultivationLogSchema = createInsertSchema(cultivationLogTable).omit({ id: true, createdAt: true });
export type InsertCultivationLog = z.infer<typeof insertCultivationLogSchema>;
export type CultivationLog = typeof cultivationLogTable.$inferSelect;
