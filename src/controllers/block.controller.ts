
import { Request, Response } from 'express';
import { z } from 'zod';
import { connect } from '../database/database';

let prisma: any;

(async () => {
  prisma = await connect();
})();

const BlockUserSchema = z.object({
  blockedUserId: z.string(),
  reason: z.enum(['harassment', 'spam', 'inappropriate_content', 'other']).optional(),
});

export const blockUser = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { uid: string };
    const { blockedUserId, reason } = BlockUserSchema.parse(req.body);

    if (authUser.uid === blockedUserId) {
      return res.status(400).json({ message: 'Cannot block yourself' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { uid: blockedUserId },
    });

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const existingBlock = await prisma.block.findFirst({
      where: {
        blockerId: authUser.uid,
        blockedId: blockedUserId,
      },
    });

    if (existingBlock) {
      return res.status(400).json({ message: 'User already blocked' });
    }

    await prisma.block.create({
      data: {
        blockerId: authUser.uid,
        blockedId: blockedUserId,
        reason,
      },
    });

    // Also remove any existing follow relationships
    await prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: authUser.uid, followingId: blockedUserId },
          { followerId: blockedUserId, followingId: authUser.uid },
        ],
      },
    });

    res.json({ message: 'User blocked successfully' });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ message: 'Invalid payload', errors: err.errors });
    }
    res.status(500).json({ error: 'Error blocking user' });
  }
};

export const unblockUser = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { uid: string };
    const { blockedUserId } = req.params;

    const existingBlock = await prisma.block.findFirst({
      where: {
        blockerId: authUser.uid,
        blockedId: blockedUserId,
      },
    });

    if (!existingBlock) {
      return res.status(404).json({ message: 'User is not blocked' });
    }

    await prisma.block.delete({
      where: { id: existingBlock.id },
    });

    res.json({ message: 'User unblocked successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Error unblocking user: ' + error.message });
  }
};

export const getBlockedUsers = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { uid: string };

    const blocks = await prisma.block.findMany({
      where: { blockerId: authUser.uid },
      include: {
        blocked: {
          select: {
            uid: true,
            username: true,
            name: true,
            photoURL: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const blockedUsers = blocks.map((block: any) => ({
      ...block.blocked,
      blockedAt: block.createdAt,
      reason: block.reason,
    }));

    res.json({ blockedUsers });
  } catch (error: any) {
    res.status(500).json({ error: 'Error fetching blocked users: ' + error.message });
  }
};
