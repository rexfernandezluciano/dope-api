
import { Request, Response } from 'express';
import { connect } from '../database/database';

let prisma: any;

(async () => {
  prisma = await connect();
})();

export const getUserSessions = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { uid: string };

    const sessions = await prisma.session.findMany({
      where: { userId: authUser.uid },
      select: {
        id: true,
        sid: true,
        ipAddress: true,
        location: true,
        data: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ sessions });
  } catch (error: any) {
    res.status(500).json({ error: 'Error fetching sessions: ' + error.message });
  }
};

export const deleteUserSession = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { uid: string };
    const { sessionId } = req.params;

    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: authUser.uid,
      },
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    await prisma.session.delete({
      where: { id: sessionId },
    });

    res.json({ message: 'Session deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Error deleting session: ' + error.message });
  }
};

export const deleteAllUserSessions = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { uid: string };

    await prisma.session.deleteMany({
      where: { userId: authUser.uid },
    });

    res.json({ message: 'All sessions deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Error deleting sessions: ' + error.message });
  }
};
