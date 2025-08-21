import { Request, Response } from 'express';
import { connect } from '../database/database';

let prisma: any;

(async () => {
  prisma = await connect();
})();

export const togglePostLike = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { uid: string };
    const { postId } = req.params;

    if (!postId) {
      return res.status(400).json({ message: 'Post ID is required' });
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const existingLike = await prisma.like.findFirst({
      where: {
        postId,
        userId: authUser.uid,
      },
    });

    if (existingLike) {
      // Unlike
      await prisma.like.delete({
        where: { id: existingLike.id },
      });
      res.json({ message: 'Post unliked', liked: false });
    } else {
      // Like
      await prisma.like.create({
        data: {
          userId: authUser.uid,
          postId,
        },
      });
      res.json({ message: 'Post liked', liked: true });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error toggling post like' });
  }
};

export const getPostLikes = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const { limit = "20", cursor } = req.query;

    if (!postId) {
      return res.status(400).json({ message: 'Post ID is required' });
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const limitNum = Math.min(parseInt(limit as string), 100);
    const where: any = { postId };

    if (cursor) {
      where.id = { lt: cursor as string };
    }

    const likes = await prisma.like.findMany({
      where,
      take: limitNum + 1,
      include: {
        user: {
          select: {
            uid: true,
            name: true,
            username: true,
            photoURL: true,
            hasBlueCheck: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = likes.length > limitNum;
    const likesToReturn = hasMore ? likes.slice(0, limitNum) : likes;
    const nextCursor = hasMore ? likesToReturn[likesToReturn.length - 1]?.id : null;

    res.json({
      likes: likesToReturn.map((like: any) => ({
        id: like.id,
        createdAt: like.createdAt,
        user: like.user,
      })),
      nextCursor,
      hasMore,
      limit: limitNum,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching post likes' });
  }
};

export const toggleCommentLike = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { uid: string };
    const { commentId } = req.params;

    if (!commentId) {
      return res.status(400).json({ message: 'Comment ID is required' });
    }

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const existingLike = await prisma.commentLike.findFirst({
      where: {
        commentId,
        userId: authUser.uid,
      },
    });

    if (existingLike) {
      // Unlike
      await prisma.commentLike.delete({
        where: { id: existingLike.id },
      });
      res.json({ message: 'Comment unliked', liked: false });
    } else {
      // Like
      await prisma.commentLike.create({
        data: {
          userId: authUser.uid,
          commentId,
        },
      });
      res.json({ message: 'Comment liked', liked: true });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error toggling comment like' });
  }
};

export const getCommentLikes = async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const { limit = "20", cursor } = req.query;

    if (!commentId) {
      return res.status(400).json({ message: 'Comment ID is required' });
    }

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const limitNum = Math.min(parseInt(limit as string), 100);
    const where: any = { commentId };

    if (cursor) {
      where.id = { lt: cursor as string };
    }

    const likes = await prisma.commentLike.findMany({
      where,
      take: limitNum + 1,
      include: {
        user: {
          select: {
            uid: true,
            name: true,
            username: true,
            photoURL: true,
            hasBlueCheck: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = likes.length > limitNum;
    const likesToReturn = hasMore ? likes.slice(0, limitNum) : likes;
    const nextCursor = hasMore ? likesToReturn[likesToReturn.length - 1]?.id : null;

    res.json({
      likes: likesToReturn.map((like: any) => ({
        id: like.id,
        createdAt: like.createdAt,
        user: like.user,
      })),
      nextCursor,
      hasMore,
      limit: limitNum,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching comment likes' });
  }
};