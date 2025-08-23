
import { PrismaSessionStore } from '@quixo3/prisma-session-store';
import { connect } from '../database/database';
import geoip from 'geoip-lite';

let prisma: any;

(async () => {
  prisma = await connect();
})();

export class CustomPrismaSessionStore extends PrismaSessionStore {
  constructor() {
    super(prisma || {} as any, {
      checkPeriod: 2 * 60 * 1000, // Clean up expired sessions every 2 minutes
      dbRecordIdIsSessionId: false,
    });
    
    if (!prisma) {
      console.warn("Prisma client not initialized when creating session store");
    }
  }

  set = async (sessionId: string, session: any, callback?: (err?: any) => void): Promise<void> => {
    try {
      if (!prisma) {
        console.warn("Prisma not available, skipping session storage");
        callback?.();
        return;
      }

      // Only save sessions that have authenticated users
      if (!session.passport?.user) {
        callback?.();
        return;
      }

      const expiresAt = session.cookie?.expires || new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      // Extract IP and get location
      const ipAddress = session.ipAddress || null;
      let location = null;
      
      if (ipAddress) {
        try {
          const geo = geoip.lookup(ipAddress);
          if (geo) {
            location = `${geo.city || 'Unknown'}, ${geo.region || ''}, ${geo.country || 'Unknown'}`;
          }
        } catch (geoError) {
          console.warn("GeoIP lookup failed:", geoError);
        }
      }

      // Prepare session data with device info
      const sessionData = {
        ...session,
        device: session.device || 'Unknown',
        browser: session.browser || 'Unknown',
        lastActivity: new Date().toISOString(),
        isActive: true
      };

      await prisma.session.upsert({
        where: { sid: sessionId },
        update: {
          data: sessionData,
          userId: session.passport.user,
          ipAddress,
          location,
          expiresAt,
          updatedAt: new Date(),
        },
        create: {
          sid: sessionId,
          data: sessionData,
          userId: session.passport.user,
          ipAddress,
          location,
          expiresAt,
        },
      });

      callback?.();
    } catch (error) {
      console.error("Session storage error:", error);
      callback?.(error);
    }
  }

  get = async (sessionId: string, callback?: (err?: any, session?: any) => void): Promise<void> => {
    try {
      if (!prisma) {
        return callback?.(null, null);
      }

      const session = await prisma.session.findUnique({
        where: { sid: sessionId },
      });

      if (!session || session.expiresAt < new Date()) {
        return callback?.(null, null);
      }

      callback?.(null, session.data);
    } catch (error) {
      callback?.(error);
    }
  }

  destroy = async (sessionId: string | string[], callback?: (err?: any) => void): Promise<void> => {
    try {
      if (!prisma) {
        return callback?.();
      }

      if (Array.isArray(sessionId)) {
        await prisma.session.deleteMany({
          where: { sid: { in: sessionId } },
        });
      } else {
        const session = await prisma.session.findUnique({
          where: { sid: sessionId }
        });
        
        if (!session) {
          return callback?.();
        }
        
        // Delete the session
        await prisma.session.delete({
          where: { sid: sessionId },
        });
      }
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }
}

export const getClientIP = (req: any): string => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    '127.0.0.1'
  );
};

export const getDeviceInfo = (userAgent: string) => {
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
