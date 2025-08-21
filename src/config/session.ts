
import { PrismaSessionStore } from '@quixo3/prisma-session-store';
import { connect } from '../database/database';
import geoip from 'geoip-lite';

let prisma: any;

(async () => {
  prisma = await connect();
})();

export class CustomPrismaSessionStore extends PrismaSessionStore {
  constructor() {
    super(prisma, {
      checkPeriod: 2 * 60 * 1000, // Clean up expired sessions every 2 minutes
      dbRecordIdIsSessionId: false,
    });
  }

  set = async (sessionId: string, session: any, callback?: (err?: any) => void): Promise<void> => {
    try {
      const expiresAt = session.cookie?.expires || new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      // Extract IP and get location
      const ipAddress = session.ipAddress || null;
      let location = null;
      
      if (ipAddress) {
        const geo = geoip.lookup(ipAddress);
        if (geo) {
          location = `${geo.city || 'Unknown'}, ${geo.region || ''}, ${geo.country || 'Unknown'}`;
        }
      }

      await prisma.session.upsert({
        where: { sid: sessionId },
        update: {
          data: session,
          userId: session.passport?.user || null,
          ipAddress,
          location,
          expiresAt,
          updatedAt: new Date(),
        },
        create: {
          sid: sessionId,
          data: session,
          userId: session.passport?.user || null,
          ipAddress,
          location,
          expiresAt,
        },
      });

      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  get = async (sessionId: string, callback?: (err?: any, session?: any) => void): Promise<void> => {
    try {
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
      if (Array.isArray(sessionId)) {
        await prisma.session.deleteMany({
          where: { sid: { in: sessionId } },
        });
      } else {
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
