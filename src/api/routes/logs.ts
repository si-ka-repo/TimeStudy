import { Hono } from "hono";
import { z } from "zod";

const createLogSchema = z.object({
  staffId: z.string().uuid(),
  actionItemId: z.string().uuid().optional(),
  actionName: z.string().min(1).optional(),
  startTime: z.coerce.date(),
  memo: z.string().optional(),
  isPending: z.boolean().default(false),
});

const endLogSchema = z.object({
  endTime: z.coerce.date().optional(),
  memo: z.string().optional(),
});

const adjustEndTimeSchema = z.object({
  minutes: z.number().int().min(-60).max(60),
});

const listLogsQuerySchema = z.object({
  staffId: z.string().uuid().optional(),
  date: z.string().optional(), // yyyy-mm-dd
});

const updateLogSchema = z.object({
  actionItemId: z.string().uuid().nullable().optional(),
  actionName: z.string().nullable().optional(),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().nullable().optional(),
  memo: z.string().nullable().optional(),
  isPending: z.boolean().optional(),
});

export type TimeStudyLog = {
  id: string;
  staffId: string;
  actionItemId?: string | null;
  actionName?: string | null;
  startTime: Date;
  endTime?: Date | null;
  durationSeconds?: number | null;
  memo?: string | null;
  isPending: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type LogsRepository = {
  createLog(input: z.infer<typeof createLogSchema>): Promise<TimeStudyLog>;
  endLog(id: string, input: z.infer<typeof endLogSchema>): Promise<TimeStudyLog | null>;
  adjustEndTime(id: string, minutes: number): Promise<TimeStudyLog | null>;
  listLogs(query: z.infer<typeof listLogsQuerySchema>): Promise<TimeStudyLog[]>;
  updateLog(id: string, input: z.infer<typeof updateLogSchema>): Promise<TimeStudyLog | null>;
};

export function createLogsRouter(repository: LogsRepository) {
  const app = new Hono();

  app.post("/", async (c) => {
    const raw = await c.req.json();
    const parsed = createLogSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: "Invalid request", issues: parsed.error.flatten() }, 400);
    }

    const log = await repository.createLog(parsed.data);
    return c.json({ data: log }, 201);
  });

  app.post("/:id/end", async (c) => {
    const id = c.req.param("id");
    const raw = await c.req.json();
    const parsed = endLogSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: "Invalid request", issues: parsed.error.flatten() }, 400);
    }

    const log = await repository.endLog(id, parsed.data);
    if (!log) return c.json({ error: "Log not found" }, 404);
    return c.json({ data: log });
  });

  app.post("/:id/adjust-end", async (c) => {
    const id = c.req.param("id");
    const raw = await c.req.json();
    const parsed = adjustEndTimeSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: "Invalid request", issues: parsed.error.flatten() }, 400);
    }

    const log = await repository.adjustEndTime(id, parsed.data.minutes);
    if (!log) return c.json({ error: "Log not found or not ended yet" }, 404);
    return c.json({ data: log });
  });

  app.get("/", async (c) => {
    const parsed = listLogsQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return c.json({ error: "Invalid query", issues: parsed.error.flatten() }, 400);
    }

    const logs = await repository.listLogs(parsed.data);
    return c.json({ data: logs });
  });

  app.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const raw = await c.req.json();
    const parsed = updateLogSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: "Invalid request", issues: parsed.error.flatten() }, 400);
    }

    const log = await repository.updateLog(id, parsed.data);
    if (!log) return c.json({ error: "Log not found" }, 404);
    return c.json({ data: log });
  });

  return app;
}

