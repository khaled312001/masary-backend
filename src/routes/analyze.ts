import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { analyzeWithClaude, type AnalysisInput } from "../lib/ai";
import { cvUpload, extractCvText } from "../lib/cvExtract";
import { closest, splitList } from "../lib/textMatching";

export const analyzeRouter = Router();

const Schema = z.object({
  fullName: z.string().min(2).max(100),
  jobTitle: z.string().min(2).max(150),
  employer: z.string().max(150).optional(),
  currentSkills: z.string().max(2000).optional(),
  currentCourses: z.string().max(2000).optional()
});

analyzeRouter.post("/", cvUpload.single("cv"), async (req, res) => {
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "الرجاء التحقق من الحقول المطلوبة" });
    return;
  }

  try {
    const cvText = await extractCvText(req.file);
    const data = {
      ...parsed.data,
      currentSkills: (parsed.data.currentSkills || "").trim(),
      currentCourses: (parsed.data.currentCourses || "").trim()
    };

    if (!data.currentSkills && !cvText) {
      res.status(400).json({ error: "أدخل المهارات الحالية أو ارفع سيرة ذاتية لاستخراجها." });
      return;
    }

    const currentSkillNames = splitList(data.currentSkills);
    const skills = await upsertUserSkills(currentSkillNames);
    const matchedJob = await findOrCreateMatchingJob(data.jobTitle, skills.map((s) => s.id));
    const normalizedJobTitle = matchedJob.titleAr;
    const normalizedSkillNames = skills.map((s) => s.nameAr);

    const catalogCourses = await prisma.course
      .findMany({
        take: 60,
        include: {
          platform: { select: { nameAr: true } },
          skills: { include: { skill: { select: { nameAr: true } } } }
        },
        orderBy: { createdAt: "desc" }
      })
      .then((rows) =>
        rows.map((c) => ({
          titleAr: c.titleAr,
          url: c.url,
          platformAr: c.platform?.nameAr ?? null,
          isFree: c.isFree,
          durationHrs: c.durationHrs,
          level: c.level,
          skills: c.skills.map((s) => s.skill.nameAr)
        }))
      )
      .catch(() => []);

    const catalogCompanies = await prisma.company
      .findMany({ take: 30, select: { nameAr: true, industry: true } })
      .catch(() => []);

    const aiInput: AnalysisInput = {
      fullName: data.fullName,
      jobTitle: data.jobTitle,
      employer: data.employer,
      currentSkills: data.currentSkills,
      currentCourses: data.currentCourses,
      cvText,
      cvFile: req.file && (req.file.mimetype === "application/pdf" || req.file.mimetype.startsWith("image/"))
        ? { mediaType: req.file.mimetype, dataBase64: req.file.buffer.toString("base64") }
        : undefined,
      normalizedJobTitle,
      normalizedSkills: normalizedSkillNames,
      matchedJob: matchedJob
        ? {
            titleAr: matchedJob.titleAr,
            descriptionAr: matchedJob.descriptionAr,
            requiredSkills: matchedJob.skills.map((js) => ({
              nameAr: js.skill.nameAr,
              importance: js.importance
            }))
          }
        : null,
      catalogCourses,
      catalogCompanies
    };

    const { report, usage } = await analyzeWithClaude(aiInput);
    await persistReportSkills(report, matchedJob.id, matchedJob.category === "مضافة من المستخدم");

    const saved = await prisma.report.create({
      data: {
        fullName: data.fullName,
        jobTitle: normalizedJobTitle,
        employer: data.employer || null,
        currentSkills: data.currentSkills,
        currentCourses: data.currentCourses || null,
        cvText: cvText || null,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        claudeModel: usage.model,
        matchedJobId: matchedJob?.id ?? null,
        data: report as any
      } as any,
      select: { id: true }
    });

    res.json({ id: saved.id });
  } catch (err: any) {
    console.error("[analyze] failed:", err);
    res.status(500).json({ error: err?.message || "تعذر إنشاء التقرير، حاول مرة أخرى." });
  }
});

async function upsertUserSkills(names: string[]) {
  if (!names.length) return [];

  const existing = await prisma.skill.findMany();
  const output: { id: string; nameAr: string }[] = [];

  for (const name of names) {
    const match = closest(existing, name, (s) => [s.nameAr, s.nameEn], 0.82);
    if (match) {
      output.push({ id: match.item.id, nameAr: match.item.nameAr });
      continue;
    }

    const created = await prisma.skill.upsert({
      where: { nameAr: name },
      update: {},
      create: { nameAr: name, category: "مضافة من المستخدم" }
    });
    existing.push(created);
    output.push({ id: created.id, nameAr: created.nameAr });
  }

  return output;
}

async function findOrCreateMatchingJob(title: string, skillIds: string[]) {
  const jobs = await prisma.job.findMany({
    include: { skills: { include: { skill: true } } }
  });

  const match = closest(jobs, title, (j) => [j.titleAr, j.titleEn], 0.76);
  if (match) return match.item;

  const created = await prisma.job.create({
    data: {
      titleAr: title.trim(),
      descriptionAr: `وظيفة أضافها مستخدم أثناء إنشاء تقرير. تحتاج مراجعة وتفصيلاً من الإدارة: ${title.trim()}`,
      category: "مضافة من المستخدم",
      skills: skillIds.length
        ? { create: skillIds.slice(0, 20).map((skillId) => ({ skillId, importance: 3 })) }
        : undefined
    },
    include: { skills: { include: { skill: true } } }
  });

  return created;
}

async function persistReportSkills(
  report: Awaited<ReturnType<typeof analyzeWithClaude>>["report"],
  jobId: string,
  attachToJob: boolean
) {
  const names = [
    ...report.presentSkills.map((s) => s.name),
    ...report.partialSkills.map((s) => s.name),
    ...report.missingSkills.map((s) => s.name)
  ].filter(Boolean);

  const skills = await upsertUserSkills(names);
  if (!attachToJob || !skills.length) return;

  await prisma.jobSkill.createMany({
    data: skills.map((skill) => ({ jobId, skillId: skill.id, importance: 3 })),
    skipDuplicates: true
  });
}
