
declare module 'activitypub-express' {
  import { RequestHandler } from 'express';

  export interface ActivityPubExpressOptions {
    domain: string;
    context: any[];
    actorParam: string;
    objectParam: string;
    activityParam: string;
    routes: {
      actor: string;
      object: string;
      activity: string;
      inbox: string;
      outbox: string;
      followers: string;
      following: string;
      liked: string;
      collections: string;
      blocked: string;
      rejections: string;
      rejected: string;
      shares: string;
      liked_: string;
    };
    endpoints: {
      proxyUrl: string;
      uploadMedia: string;
    };
  }

  export interface ActivityPubExpress extends RequestHandler {
    domain: string;
    context: any[];
    resolveActor: (username: string) => Promise<any>;
    resolveObject: (id: string) => Promise<any>;
    onActivity: (activity: any, recipient: any) => Promise<void>;
  }

  export default function ActivitypubExpress(options: ActivityPubExpressOptions): ActivityPubExpress;
  export function ActivitypubExpress(options: ActivityPubExpressOptions): ActivityPubExpress;
}
