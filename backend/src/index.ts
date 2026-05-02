import cors from "cors";
import express from "express";
import { randomUUID } from "node:crypto";
import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  ALLOWED_ORIGINS: z
    .string()
    .default(
      "http://localhost:3000,http://localhost:3001,https://mokea.studio,https://blog.mokea.studio",
    ),
});

const env = envSchema.parse(process.env);

const app = express();

const allowedOrigins = env.ALLOWED_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
  }),
);

app.use(express.json({ limit: "1mb" }));

const contactSchema = z.object({
  name: z.string().trim().min(2).max(50),
  email: z.string().trim().email(),
  company: z.string().trim().max(80).optional().default(""),
  projectType: z.string().trim().min(2).max(80),
  budget: z.string().trim().min(1).max(80),
  timeline: z.string().trim().min(1).max(80),
  message: z.string().trim().min(20).max(2000),
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "mokea-backend",
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/contact", async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed",
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  const submission = {
    id: randomUUID(),
    ...parsed.data,
    createdAt: new Date().toISOString(),
    source: "mokea-web",
  };

  const dataDir = path.join(process.cwd(), "data");
  const targetFile = path.join(dataDir, "contact-submissions.jsonl");

  try {
    await mkdir(dataDir, { recursive: true });
    await appendFile(targetFile, `${JSON.stringify(submission)}\n`, "utf-8");
  } catch {
    res.status(500).json({ error: "Failed to store submission" });
    return;
  }

  res.status(201).json({
    ok: true,
    message: "Contact request received",
    id: submission.id,
  });
});

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`MOKEA backend running on http://localhost:${env.PORT}`);
});
