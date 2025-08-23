
import { Request, Response } from 'express';
import { connect } from '../database/database';

let prisma: any;

(async () => {
  prisma = await connect();
})();

export const getUserSessions = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { uid: string };
    const currentSessionId = req.sessionID;

    const sessions = await prisma.session.findMany({
      where: { 
        userId: authUser.uid,
        expiresAt: {
          gt: new Date()
        }
      },
      select: {
        id: true,
        sid: true,
        ipAddress: true,
        location: true,
        data: true,
        createdAt: true,
        expiresAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const formattedSessions = sessions.map(session => {
      const sessionData = session.data as any;
      return {
        id: session.id,
        sid: session.sid,
        device: sessionData?.device || 'Unknown',
        browser: sessionData?.browser || 'Unknown',
        ipAddress: session.ipAddress,
        location: session.location,
        isActive: sessionData?.isActive !== false,
        isCurrent: session.sid === currentSessionId,
        lastActivity: sessionData?.lastActivity || session.updatedAt,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      };
    });

    res.json({ sessions: formattedSessions });
  } catch (error: any) {
    res.status(500).json({ error: 'Error fetching sessions: ' + error.message });
  }
};

export const deleteUserSession = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { uid: string };
    const { sessionId } = req.params;
    const currentSessionId = req.sessionID;

    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: authUser.uid,
      },
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Don't allow deleting current session
    if (session.sid === currentSessionId) {
      return res.status(400).json({ message: 'Cannot delete current session' });
    }

    await prisma.session.delete({
      where: { id: sessionId },
    });

    res.json({ message: 'Session deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Error deleting session: ' + error.message });
  }
};

export const deactivateUserSession = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { uid: string };
    const { sessionId } = req.params;
    const currentSessionId = req.sessionID;

    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: authUser.uid,
      },
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Don't allow deactivating current session
    if (session.sid === currentSessionId) {
      return res.status(400).json({ message: 'Cannot deactivate current session' });
    }

    const sessionData = session.data as any;
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        data: {
          ...sessionData,
          isActive: false,
          deactivatedAt: new Date().toISOString()
        }
      }
    });

    res.json({ message: 'Session deactivated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Error deactivating session: ' + error.message });
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
