import { pgTable, text, integer, bigint, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ==========================================
// BẢNG TÔNG MÔN MỚI (Hỗ trợ PK Tông Môn)
// ==========================================
export const sectsTable = pgTable("sects", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(), // Tên tông môn duy nhất
  leaderDiscordId: text("leader_discord_id").notNull(), // Discord ID của Tông Chủ
  level: integer("level").notNull().default(1), // Cấp bậc Tông Môn (Cấp 1-10)
  spiritTreasury: bigint("spirit_treasury", { mode: "bigint" }).notNull().default(0n), // Quỹ Linh Thạch Tông Môn
  experience: bigint("experience", { mode: "bigint" }).notNull().default(0n), // Điểm kinh nghiệm thăng cấp tông môn
  
  // Hệ Thống Hộ Sơn Trận Pháp & Phòng Thủ PK
  formationLevel: integer("formation_level").notNull().default(1), // Cấp Trận Pháp Hộ Sơn
  formationDurability: bigint("formation_durability", { mode: "bigint" }).notNull().default(10000n), // Máu / Độ bền trận pháp
  maxFormationDurability: bigint("max_formation_durability", { mode: "bigint" }).notNull().default(10000n), // Độ bền tối đa
  
  // Điểm Chiến Công & Thành Tích PK Tông Môn
  pkPoints: integer("pk_points").notNull().default(1000), // Điểm PK BXH Tông Môn (Elo)
  warsWon: integer("wars_won").notNull().default(0), // Số trận chiến thắng
  warsLost: integer("wars_lost").notNull().default(0), // Số trận chiến bại
  
  slogan: text("slogan").default("Tông môn đệ nhất tu chân giới!"), // Tông quy / Khẩu hiệu
  maxMembers: integer("max_members").notNull().default(20), // Giới hạn đệ tử (tăng theo cấp tông môn)
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSectSchema = createInsertSchema(sectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSect = z.infer<typeof insertSectSchema>;
export type Sect = typeof sectsTable.$inferSelect;

// ==========================================
// BẢNG THÀNH VIÊN TÔNG MÔN & CHỨC VỊ
// ==========================================
export const sectMembersTable = pgTable("sect_members", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  sectId: bigint("sect_id", { mode: "bigint" }).notNull(),
  discordId: text("discord_id").notNull().unique(), // Mỗi người chơi chỉ thuộc 1 tông môn
  role: text("role").notNull().default("ngoai_mon"), // tong_chu, pho_tong_chu, truong_lao, chap_su, noi_mon, ngoai_mon
  contribution: bigint("contribution", { mode: "bigint" }).notNull().default(0n), // Điểm cống hiến đóng góp linh thạch
  warPoints: integer("war_points").notNull().default(0), // Điểm chiến công PK cá nhân
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const insertSectMemberSchema = createInsertSchema(sectMembersTable).omit({ id: true, joinedAt: true });
export type InsertSectMember = z.infer<typeof insertSectMemberSchema>;
export type SectMember = typeof sectMembersTable.$inferSelect;

// ==========================================
// BẢNG CHIẾN TRANH & PK TÔNG MÔN (SECT WAR)
// ==========================================
export const sectWarsTable = pgTable("sect_wars", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  attackerSectId: bigint("attacker_sect_id", { mode: "bigint" }).notNull(),
  defenderSectId: bigint("defender_sect_id", { mode: "bigint" }).notNull(),
  status: text("status").notNull().default("active"), // active, attacker_won, defender_won, draw
  attackerDamage: bigint("attacker_damage", { mode: "bigint" }).notNull().default(0n),
  defenderDamage: bigint("defender_damage", { mode: "bigint" }).notNull().default(0n),
  plunderedStones: bigint("plundered_stones", { mode: "bigint" }).notNull().default(0n), // Linh thạch cướp được từ kho
  pkPointsExchanged: integer("pk_points_exchanged").notNull().default(0), // Điểm BXH chuyển giao
  log: text("log"), // Nhật ký diễn biến trận chiến
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
});

export const insertSectWarSchema = createInsertSchema(sectWarsTable).omit({ id: true, startedAt: true });
export type InsertSectWar = z.infer<typeof insertSectWarSchema>;
export type SectWar = typeof sectWarsTable.$inferSelect;
