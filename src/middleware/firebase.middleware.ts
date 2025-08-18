/* @format */

import { Request, Response, NextFunction } from "express";
import { initializeApp, cert } from "firebase-admin/app";
import { getAppCheck } from "firebase-admin/app-check";

// Initialize Firebase Admin (you'll need to add your service account key)
const firebaseApp = initializeApp({
  credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)),
});

export const verifyAppCheck = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const appCheckToken = req.headers["x-firebase-appcheck"] as string;

    if (!appCheckToken) {
      return res.status(401).json({ error: "App Check token required" });
    }

    const appCheckClaims = await getAppCheck().verifyToken(appCheckToken);

    if (!appCheckClaims) {
      return res.status(401).json({ error: "Invalid App Check token" });
    }

    // Store app check claims in request for later use
    (req as any).appCheck = appCheckClaims;
    next();
  } catch (error) {
    return res.status(401).json({ error: "App Check verification failed" });
  }
};
