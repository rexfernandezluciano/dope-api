
import { Request, Response, NextFunction } from 'express';
import { getClientIP } from '../config/session';

const getDeviceInfo = (userAgent: string) => {
  const ua = userAgent.toLowerCase();
  let device = 'Desktop';
  let browser = 'Unknown';

  // Detect device
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    device = 'Mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    device = 'Tablet';
  }

  // Detect browser
  if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari')) browser = 'Safari';
  else if (ua.includes('edge')) browser = 'Edge';
  else if (ua.includes('opera')) browser = 'Opera';

  return { device, browser };
};

export const enhanceSession = (req: Request, res: Response, next: NextFunction) => {
  // Add IP address and device info to session data
  if (req.session) {
    const { device, browser } = getDeviceInfo(req.get('User-Agent') || '');
    (req.session as any).ipAddress = getClientIP(req);
    (req.session as any).device = device;
    (req.session as any).browser = browser;
  }
  next();
};

export const validateUserSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as any)?.uid;
    const sessionId = req.sessionID;
    
    if (!userId || !sessionId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { connect } = await import('../database/database');
    const prisma = await connect();

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

    next();
  } catch (error: any) {
    res.status(500).json({ error: 'Session validation failed: ' + error.message });
  }
};
