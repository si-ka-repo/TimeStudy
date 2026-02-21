import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const staffs = pgTable(
  "staffs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    staffCode: varchar("staff_code", { length: 64 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    staffCodeUnique: uniqueIndex("staffs_staff_code_unique").on(table.staffCode),
    activeIdx: index("staffs_is_active_idx").on(table.isActive),
  }),
);

export const actionCategories = pgTable(
  "action_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 1 }).notNull(), // A/B/C/D/E
    name: varchar("name", { length: 64 }).notNull(),
    displayOrder: integer("display_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    codeUnique: uniqueIndex("action_categories_code_unique").on(table.code),
    orderUnique: uniqueIndex("action_categories_display_order_unique").on(table.displayOrder),
  }),
);

export const actionItems = pgTable(
  "action_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subNo: integer("sub_no").notNull(), // 1..24
    actionCategoryId: uuid("action_category_id")
      .notNull()
      .references(() => actionCategories.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    isOther: boolean("is_other").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    subNoUnique: uniqueIndex("action_items_sub_no_unique").on(table.subNo),
    categoryIdx: index("action_items_action_category_id_idx").on(table.actionCategoryId),
    activeIdx: index("action_items_is_active_idx").on(table.isActive),
  }),
);

export const logs = pgTable(
  "logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staffs.id, { onDelete: "restrict" }),
    actionItemId: uuid("action_item_id").references(() => actionItems.id, { onDelete: "set null" }),
    actionName: text("action_name"), // 手入力や将来の音声分類失敗時に保持
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }),
    durationSeconds: integer("duration_seconds"),
    memo: text("memo"), // 音声書き起こし原文や補足メモ
    isPending: boolean("is_pending").notNull().default(false),
    pendingReason: text("pending_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    staffStartIdx: index("logs_staff_start_time_idx").on(table.staffId, table.startTime),
    pendingIdx: index("logs_is_pending_idx").on(table.isPending),
    timeRangeIdx: index("logs_start_end_time_idx").on(table.startTime, table.endTime),
  }),
);

export type Staff = typeof staffs.$inferSelect;
export type ActionCategory = typeof actionCategories.$inferSelect;
export type ActionItem = typeof actionItems.$inferSelect;
export type Log = typeof logs.$inferSelect;

