
import { Request, Response } from 'express';
import { z } from 'zod';
import { connect } from '../database/database';

let prisma: any;

(async () => {
  prisma = await connect();
})();

const CreateReplySchema = z.object({
  content: z.string().min(1).max(500),
});

export const createReply = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { uid: string };
    const { commentId } = req.params;
    const { content } = CreateReplySchema.parse(req.body);

    const parentComment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!parentComment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const reply = await prisma.comment.create({
      data: {
        content,
        postId: parentComment.postId,
        parentId: commentId,
        authorId: authUser.uid,
      },
      include: {
        author: {
          select: {
            uid: true,
            name: true,
            username: true,
            photoURL: true,
            hasBlueCheck: true,
          },
        },
        _count: {
          select: {
            likes: true,
            replies: true,
          },
        },
      },
    });

    res.status(201).json(reply);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ message: 'Invalid payload', errors: err.errors });
    }
    res.status(500).json({ error: 'Error creating reply' });
  }
};

export const getCommentReplies = async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const { limit = '10', cursor } = req.query;
    const limitNum = Math.min(parseInt(limit as string), 50);

    const where: any = { parentId: commentId };
    if (cursor) {
      where.id = { lt: cursor as string };
    }

    const replies = await prisma.comment.findMany({
      where,
      take: limitNum + 1,
      include: {
        author: {
          select: {
            uid: true,
            name: true,
            username: true,
            photoURL: true,
            hasBlueCheck: true,
          },
        },
        _count: {
          select: {
            likes: true,
            replies: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = replies.length > limitNum;
    const repliesToReturn = hasMore ? replies.slice(0, limitNum) : replies;
    const nextCursor = hasMore ? repliesToReturn[repliesToReturn.length - 1]?.id : null;

    res.json({
      replies: repliesToReturn,
      nextCursor,
      hasMore,
      limit: limitNum,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Error fetching replies: ' + error.message });
  }
};
