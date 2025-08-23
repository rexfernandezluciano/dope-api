
import { Request, Response, NextFunction } from 'express';
import { connect } from '../database/database';

let prisma: any;

(async () => {
  prisma = await connect();
})();

export const validateSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as { uid: string } | undefined;
    
    if (!authUser) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Get session from headers or token payload
    const sessionId = req.headers['x-session-id'] as string || req.sessionID;
    
    if (sessionId) {
      const session = await prisma.session.findFirst({
        where: { 
          OR: [
            { id: sessionId },
            { sid: sessionId }
          ],
          userId: authUser.uid,
          expiresAt: {
            gt: new Date()
          }
        },
      });

      if (!session) {
        return res.status(401).json({ message: 'Invalid or expired session' });
      }

      // Check if session is marked as active in the data
      const sessionData = session.data as any;
      const isActive = sessionData?.isActive !== false;
      
      if (!isActive) {
        return res.status(401).json({ message: 'Session has been deactivated' });
      }

      // Update session activity with current device info
      const { device, browser } = getDeviceInfo(req.get('User-Agent') || '');
      const ipAddress = getClientIP(req);
      
      await prisma.session.update({
        where: { id: session.id },
        data: { 
          updatedAt: new Date(),
          ipAddress,
          data: {
            ...sessionData,
            device,
            browser,
            lastActivity: new Date().toISOString(),
            isActive: true
          }
        },
      });

      // Store session info in request for later use
      (req as any).sessionInfo = {
        sessionId: session.id,
        device,
        browser,
        ipAddress
      };
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Session validation error' });
  }
};

export const getClientIP = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'] as string;
  const ip = forwarded ? forwarded.split(',')[0] : req.connection.remoteAddress;
  return ip || 'unknown';
};

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

export const createUserSession = async (userId: string, sessionId: string, req: Request) => {
  try {
    const { device, browser } = getDeviceInfo(req.get('User-Agent') || '');
    const ipAddress = getClientIP(req);
    let location = null;
    
    // Get location from IP if possible
    try {
      const geoip = await import('geoip-lite');
      const geo = geoip.default.lookup(ipAddress);
      if (geo) {
        location = `${geo.city || 'Unknown'}, ${geo.region || ''}, ${geo.country || 'Unknown'}`;
      }
    } catch (geoError) {
      console.warn("GeoIP lookup failed:", geoError);
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const sessionData = {
      device,
      browser,
      ipAddress,
      location,
      isActive: true,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };

    // Check if session already exists
    const existingSession = await prisma.session.findUnique({
      where: { sid: sessionId }
    });

    if (existingSession) {
      // Update existing session
      return await prisma.session.update({
        where: { sid: sessionId },
        data: {
          userId,
          ipAddress,
          location,
          data: sessionData,
          expiresAt,
          updatedAt: new Date()
        }
      });
    } else {
      // Create new session
      return await prisma.session.create({
        data: {
          sid: sessionId,
          userId,
          ipAddress,
          location,
          data: sessionData,
          expiresAt
        }
      });
    }
  } catch (error) {
    console.error('Error creating user session:', error);
    throw error;
  }
};

export const validateUserSession = async (req: Request, res: Response, next: NextFunction) => {
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

    // Check if session is active
    const sessionData = session.data as any;
    if (sessionData?.isActive === false) {
      return res.status(401).json({ message: 'Session has been deactivated' });
    }

    // Update last activity
    await prisma.session.update({
      where: { id: session.id },
      data: {
        data: {
          ...sessionData,
          lastActivity: new Date().toISOString()
        },
        updatedAt: new Date()
      }
    });

    next();
  } catch (error: any) {
    res.status(500).json({ error: 'Session validation failed: ' + error.message });
  }
};
