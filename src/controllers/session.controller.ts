
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
        sid: true,
        ipAddress: true,
        location: true,
        createdAt: true,
        updatedAt: true,
        expiresAt: true,
        data: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    const sessionsWithStatus = sessions.map(session => {
      const sessionData = session.data as any;
      const device = sessionData?.device || 'Unknown Device';
      const browser = sessionData?.browser || 'Unknown Browser';
      const isActive = session.sid === req.sessionID;
      
      return {
        id: session.id,
        device,
        browser,
        ipAddress: session.ipAddress,
        location: session.location,
        isActive,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        expiresAt: session.expiresAt
      };
    });

    res.json({ sessions: sessionsWithStatus });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch sessions: ' + error.message });
  }
};

export const validateSession = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.uid;
    const sessionId = req.sessionID;
    
    if (!userId || !sessionId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const session = await prisma.session.findFirst({
      where: {
        sid: sessionId,
        userId,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (!session) {
      return res.status(401).json({ message: 'Session invalid or expired' });
    }

    res.json({ 
      valid: true, 
      message: 'Session is valid',
      session: {
        id: session.id,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to validate session: ' + error.message });
  }
};

export const revokeSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const userId = (req.user as any)?.uid;

    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // First check if the session exists and belongs to the user
    const existingSession = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId
      }
    });

    if (!existingSession) {
      return res.status(404).json({ message: 'Session not found or does not belong to you' });
    }

    // Delete the session
    const result = await prisma.session.deleteMany({
      where: {
        id: sessionId,
        userId
      }
    });

    if (result.count === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.json({ message: 'Session revoked successfully' });
  } catch (error: any) {
    console.error('Session revocation error:', error);
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

    if (!currentSessionId) {
      return res.status(400).json({ message: 'No active session found' });
    }

    // Delete all sessions except current one
    const result = await prisma.session.deleteMany({
      where: {
        userId,
        sid: {
          not: currentSessionId
        }
      }
    });

    res.json({ 
      message: 'All other sessions revoked successfully',
      revokedCount: result.count
    });
  } catch (error: any) {
    console.error('Bulk session revocation error:', error);
    res.status(500).json({ error: 'Failed to revoke sessions: ' + error.message });
  }
};
