import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAdmin } from "../middleware/auth";

export const reportsRouter = Router();

// Admin: list all reports
reportsRouter.get("/", requireAdmin, async (_req, res) => {
  const rows = await prisma.report.findMany({
    orderBy: { createdAt: "desc" },
    take: 200
  });
  res.json(rows);
});

// Admin: latest 5 reports for dashboard
reportsRouter.get("/latest", requireAdmin, async (_req, res) => {
  const rows = await prisma.report.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, fullName: true, jobTitle: true, createdAt: true }
  });
  res.json(rows);
});

// Public: get a single report by ID (so it can be shared as a link)
reportsRouter.get("/:id", async (req, res) => {
  const report = await prisma.report.findUnique({ where: { id: req.params.id } });
  if (!report) {
    res.status(404).json({ error: "التقرير غير موجود" });
    return;
  }
  res.json(report);
});

// Admin: delete a report
reportsRouter.delete("/:id", requireAdmin, async (req, res) => {
  try {
    await prisma.report.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: "تعذر الحذف" });
  }
});
