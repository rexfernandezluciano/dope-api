
import { Request, Response, NextFunction } from 'express';
import { getClientIP } from '../config/session';

export const enhanceSession = (req: Request, res: Response, next: NextFunction) => {
  // Add IP address to session data
  if (req.session) {
    (req.session as any).ipAddress = getClientIP(req);
  }
  next();
};
