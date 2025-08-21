
import { Request, Response } from 'express';
import { connect } from '../database/database';

let prisma: any;

(async () => {
  prisma = await connect();
})();

export const toggleCommentLike = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { uid: string };
    const { commentId } = req.params;

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
  } catch (error: any) {
    res.status(500).json({ error: 'Error toggling comment like: ' + error.message });
  }
};
