
import { Request, Response } from 'express';
import { z } from 'zod';
import { connect } from '../database/database';

let prisma: any;

(async () => {
  prisma = await connect();
})();

const ReportSchema = z.object({
  targetType: z.enum(['post', 'comment', 'user']),
  targetId: z.string(),
  reason: z.enum(['spam', 'harassment', 'hate_speech', 'inappropriate_content', 'copyright', 'other']),
  description: z.string().max(500).optional(),
});

export const createReport = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { uid: string };
    const { targetType, targetId, reason, description } = ReportSchema.parse(req.body);

    // Check if target exists
    let targetExists = false;
    
    switch (targetType) {
      case 'post':
        const post = await prisma.post.findUnique({ where: { id: targetId } });
        targetExists = !!post;
        break;
      case 'comment':
        const comment = await prisma.comment.findUnique({ where: { id: targetId } });
        targetExists = !!comment;
        break;
      case 'user':
        const user = await prisma.user.findUnique({ where: { uid: targetId } });
        targetExists = !!user;
        break;
    }

    if (!targetExists) {
      return res.status(404).json({ message: `${targetType} not found` });
    }

    // Check if user already reported this target
    const existingReport = await prisma.report.findFirst({
      where: {
        reporterId: authUser.uid,
        targetType,
        targetId,
      },
    });

    if (existingReport) {
      return res.status(400).json({ message: `You have already reported this ${targetType}` });
    }

    const report = await prisma.report.create({
      data: {
        reporterId: authUser.uid,
        targetType,
        targetId,
        reason,
        description,
        status: 'pending',
      },
    });

    res.status(201).json({ message: 'Report submitted successfully', reportId: report.id });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ message: 'Invalid payload', errors: err.errors });
    }
    res.status(500).json({ error: 'Error creating report' });
  }
};

export const getUserReports = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { uid: string };

    const reports = await prisma.report.findMany({
      where: { reporterId: authUser.uid },
      include: {
        reporter: {
          select: {
            uid: true,
            username: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ reports });
  } catch (error: any) {
    res.status(500).json({ error: 'Error fetching reports: ' + error.message });
  }
};
