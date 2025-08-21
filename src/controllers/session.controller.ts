
import { Request, Response } from 'express';
import { connect } from '../database/database';

import { Request, Response } from 'express';
import { connect } from '../database/database';

let prisma: any;

(async () => {
  prisma = await connect();
})();

export const getUserSessions = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.uid;
    
    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const sessions = await prisma.session.findMany({
      where: {
        userId,
        expiresAt: {
          gt: new Date()
        }
      },
      select: {
        id: true,
        ipAddress: true,
        location: true,
        createdAt: true,
        updatedAt: true,
        expiresAt: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    res.json({ sessions });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch sessions: ' + error.message });
  }
};

export const revokeSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const userId = (req.user as any)?.uid;

    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    await prisma.session.deleteMany({
      where: {
        id: sessionId,
        userId
      }
    });

    res.json({ message: 'Session revoked successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to revoke session: ' + error.message });
  }
};

export const revokeAllSessions = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.uid;
    const currentSessionId = req.sessionID;

    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // Delete all sessions except current one
    await prisma.session.deleteMany({
      where: {
        userId,
        sid: {
          not: currentSessionId
        }
      }
    });

    res.json({ message: 'All other sessions revoked successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to revoke sessions: ' + error.message });
  }
};
