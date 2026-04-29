import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAdmin } from "../middleware/auth";

export const statsRouter = Router();

statsRouter.get("/", requireAdmin, async (_req, res) => {
  try {
    const [jobs, skills, courses, platforms, companies, reports] = await Promise.all([
      prisma.job.count(),
      prisma.skill.count(),
      prisma.course.count(),
      prisma.platform.count(),
      prisma.company.count(),
      prisma.report.count()
    ]);
    res.json({ jobs, skills, courses, platforms, companies, reports });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "تعذر جلب الإحصائيات" });
  }
});
