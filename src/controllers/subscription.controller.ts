import { Request, Response } from "express";
import { z } from "zod";
import { connect } from "../database/database";
import axios from "axios";

let prisma: any;

const initializePrisma = async () => {
  if (!prisma) {
    prisma = await connect();
  }
  return prisma;
};

// PayPal API helper
const paypalAPI = axios.create({
  baseURL: process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Accept-Language": "en_US",
  },
});

// PayPal OAuth token cache
let paypalAccessToken: string | null = null;
let tokenExpiry: number | null = null;

const getPayPalAccessToken = async () => {
  if (paypalAccessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return paypalAccessToken;
  }

  try {
    const response = await paypalAPI.post(
      "/v1/oauth2/token",
      "grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${Buffer.from(process.env.PAYPAL_CLIENT_ID + ":" + process.env.PAYPAL_CLIENT_SECRET).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    paypalAccessToken = response.data.access_token;
    tokenExpiry = Date.now() + response.data.expires_in * 1000 - 60000;
    return paypalAccessToken;
  } catch (error) {
    console.error("PayPal token error:", error);
    throw error;
  }
};

const SubscribeToUserSchema = z.object({
  creatorId: z.string().min(1),
  tier: z.enum(["basic", "premium", "vip"]),
  paymentMethodId: z.string().min(1),
});

const TipUserSchema = z.object({
  receiverId: z.string().min(1),
  amount: z.number().min(100).max(500000), // Min ₱1, Max ₱5000
  message: z.string().max(280).optional(),
  postId: z.string().optional(),
  stickerId: z.string().optional(),
});

const DonateToUserSchema = z.object({
  receiverId: z.string().min(1),
  amount: z.number().min(500).max(1000000), // Min ₱5, Max ₱10000
  message: z.string().max(500).optional(),
  isAnonymous: z.boolean().default(false),
});

const CreateStickerSchema = z.object({
  name: z.string().min(1).max(50),
  imageUrl: z.string().url(),
  price: z.number().min(100).max(10000).optional(), // ₱1-₱100
  category: z.enum(["custom", "emoji", "animated", "premium"]).default("custom"),
});

const CreatePerkSchema = z.object({
  tier: z.enum(["basic", "premium", "vip"]),
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
});

// Subscription tier pricing in PHP centavos
const SUBSCRIPTION_PRICES = {
  basic: 2500,   // $25
  premium: 5000, // $50
  vip: 30000,    // ₱300
};

export const subscribeToUser = async (req: Request, res: Response) => {
  try {
    await initializePrisma();
    const authUser = (req as any).user as { uid: string };
    const { creatorId, tier, paymentMethodId } = SubscribeToUserSchema.parse(req.body);

    // Check if user is trying to subscribe to themselves
    if (authUser.uid === creatorId) {
      return res.status(400).json({ message: "You cannot subscribe to yourself" });
    }

    // Check if creator exists and is not restricted
    const creator = await prisma.user.findUnique({
      where: { uid: creatorId },
      select: { uid: true, username: true, name: true, isRestricted: true, isBlocked: true },
    });

    if (!creator) {
      return res.status(404).json({ message: "Creator not found" });
    }

    if (creator.isRestricted || creator.isBlocked) {
      return res.status(400).json({ message: "Creator is not available for subscriptions" });
    }

    // Check if already subscribed
    const existingSubscription = await prisma.userSubscription.findUnique({
      where: { subscriberId_creatorId: { subscriberId: authUser.uid, creatorId } },
    });

    if (existingSubscription && existingSubscription.status === 'active') {
      return res.status(400).json({ message: "Already subscribed to this creator" });
    }

    // Verify payment method
    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, userId: authUser.uid },
    });

    if (!paymentMethod) {
      return res.status(404).json({ message: "Payment method not found" });
    }

    const amount = SUBSCRIPTION_PRICES[tier as keyof typeof SUBSCRIPTION_PRICES];

    try {
      // Create PayPal order
      const accessToken = await getPayPalAccessToken();

      const paypalOrder = await paypalAPI.post(
        "/v2/checkout/orders",
        {
          intent: "CAPTURE",
          purchase_units: [
            {
              amount: {
                currency_code: "PHP",
                value: (amount / 100).toFixed(2),
              },
              description: `${tier.charAt(0).toUpperCase() + tier.slice(1)} subscription to @${creator.username}`,
              custom_id: `subscription_${authUser.uid}_${creatorId}_${tier}_${paymentMethodId}`,
            },
          ],
          payment_source:
            paymentMethod.type === "paypal_wallet"
              ? {
                  paypal: {
                    email_address: paymentMethod.paypalEmail,
                    experience_context: {
                      return_url: `${process.env.FRONTEND_URL}/subscription/success`,
                      cancel_url: `${process.env.FRONTEND_URL}/subscription/cancel`,
                    },
                  },
                }
              : {
                  card: {
                    vault_id: paymentMethod.paypalPaymentMethodId,
                  },
                },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const approveUrl = paypalOrder.data.links?.find(
        (link: any) => link.rel === "approve" || link.rel === "payer-action"
      )?.href || null;

      res.json({
        message: "Subscription payment initiated",
        paymentIntentId: paypalOrder.data.id,
        provider: "paypal",
        approveUrl: approveUrl,
        amount: amount,
        currency: "PHP",
        tier: tier,
        creator: {
          username: creator.username,
          name: creator.name,
        },
        status: paypalOrder.data.status,
      });
    } catch (providerError: any) {
      console.error("PayPal error:", providerError);
      return res.status(400).json({
        message: "Payment failed",
        error: providerError.response?.data || providerError.message,
      });
    }
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    }
    console.error("Subscribe to user error:", error);
    res.status(500).json({ error: "Error processing subscription: " + error.message });
  }
};

export const tipUser = async (req: Request, res: Response) => {
  try {
    await initializePrisma();
    const authUser = (req as any).user as { uid: string };
    const { receiverId, amount, message, postId, stickerId } = TipUserSchema.parse(req.body);

    if (authUser.uid === receiverId) {
      return res.status(400).json({ message: "You cannot tip yourself" });
    }

    const receiver = await prisma.user.findUnique({
      where: { uid: receiverId },
      select: { 
        uid: true, 
        username: true, 
        name: true,
        isBlocked: true,
        isRestricted: true,
        _count: {
          select: {
            followers: true,
          },
        },
        reports: {
          where: {
            status: { in: ["pending", "reviewed"] },
          },
        },
      },
    });

    if (!receiver) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if receiver posted within the last 24 hours
    const lastDayPosts = await prisma.post.count({
      where: {
        authorId: receiverId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    // Check monetization eligibility
    const isEligibleForMonetization = 
      receiver._count.followers >= 500 && 
      lastDayPosts >= 1 && 
      !receiver.isBlocked && 
      !receiver.isRestricted &&
      receiver.reports.length === 0;

    if (!isEligibleForMonetization) {
      return res.status(400).json({ 
        message: "This user is not eligible to receive tips",
        requirements: {
          followers: {
            current: receiver._count.followers,
            required: 500,
            met: receiver._count.followers >= 500,
          },
          recentActivity: {
            postsLast24h: lastDayPosts,
            required: 1,
            met: lastDayPosts >= 1,
          },
          accountStatus: {
            blocked: receiver.isBlocked,
            restricted: receiver.isRestricted,
            violations: receiver.reports.length,
            goodStanding: !receiver.isBlocked && !receiver.isRestricted && receiver.reports.length === 0,
          },
        },
      });
    }

    // Get sender's current credits
    const sender = await prisma.user.findUnique({
      where: { uid: authUser.uid },
      select: { credits: true, username: true },
    });

    if (!sender) {
      return res.status(404).json({ message: "Sender not found" });
    }

    // Check if sender has enough credits
    if (sender.credits < amount) {
      return res.status(400).json({
        message: "Insufficient credits",
        availableCredits: sender.credits,
        requiredCredits: amount,
      });
    }

    // Process the tip transaction
    const [tip] = await prisma.$transaction([
      // Create tip record
      prisma.tip.create({
        data: {
          senderId: authUser.uid,
          receiverId: receiverId,
          amount: amount,
          message: message || `Tip from @${sender.username}`,
          postId: postId,
          stickerId: stickerId,
        },
      }),
      // Deduct credits from sender
      prisma.user.update({
        where: { uid: authUser.uid },
        data: {
          credits: {
            decrement: amount,
          },
        },
      }),
      // Add credits to receiver
      prisma.user.update({
        where: { uid: receiverId },
        data: {
          credits: {
            increment: amount,
          },
        },
      }),
    ]);

    res.json({
      message: "Tip sent successfully",
      tip: {
        id: tip.id,
        amount: amount,
        currency: "PHP",
        receiver: {
          username: receiver.username,
          name: receiver.name,
        },
        sender: {
          username: sender.username,
        },
        createdAt: tip.createdAt,
      },
      transaction: {
        type: "credit_transfer",
        status: "completed",
        amount: amount,
        remainingCredits: sender.credits - amount,
      },
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    }
    console.error("Tip user error:", error);
    res.status(500).json({ error: "Error processing tip: " + error.message });
  }
};

export const donateToUser = async (req: Request, res: Response) => {
  try {
    await initializePrisma();
    const authUser = (req as any).user as { uid: string };
    const { receiverId, amount, message, isAnonymous } = DonateToUserSchema.parse(req.body);

    if (authUser.uid === receiverId) {
      return res.status(400).json({ message: "You cannot donate to yourself" });
    }

    const receiver = await prisma.user.findUnique({
      where: { uid: receiverId },
      select: { 
        uid: true, 
        username: true, 
        name: true,
        isBlocked: true,
        isRestricted: true,
        _count: {
          select: {
            followers: true,
          },
        },
        reports: {
          where: {
            status: { in: ["pending", "reviewed"] },
          },
        },
      },
    });

    if (!receiver) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if receiver posted within the last 24 hours
    const lastDayPosts = await prisma.post.count({
      where: {
        authorId: receiverId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    // Check monetization eligibility
    const isEligibleForMonetization = 
      receiver._count.followers >= 500 && 
      lastDayPosts >= 1 && 
      !receiver.isBlocked && 
      !receiver.isRestricted &&
      receiver.reports.length === 0;

    if (!isEligibleForMonetization) {
      return res.status(400).json({ 
        message: "This user is not eligible to receive donations",
        requirements: {
          followers: {
            current: receiver._count.followers,
            required: 500,
            met: receiver._count.followers >= 500,
          },
          recentActivity: {
            postsLast24h: lastDayPosts,
            required: 1,
            met: lastDayPosts >= 1,
          },
          accountStatus: {
            blocked: receiver.isBlocked,
            restricted: receiver.isRestricted,
            violations: receiver.reports.length,
            goodStanding: !receiver.isBlocked && !receiver.isRestricted && receiver.reports.length === 0,
          },
        },
      });
    }

    // Get sender's current credits
    const sender = await prisma.user.findUnique({
      where: { uid: authUser.uid },
      select: { credits: true, username: true },
    });

    if (!sender) {
      return res.status(404).json({ message: "Sender not found" });
    }

    // Check if sender has enough credits
    if (sender.credits < amount) {
      return res.status(400).json({
        message: "Insufficient credits",
        availableCredits: sender.credits,
        requiredCredits: amount,
      });
    }

    // Process the donation transaction
    const [donation] = await prisma.$transaction([
      // Create donation record
      prisma.donation.create({
        data: {
          senderId: authUser.uid,
          receiverId: receiverId,
          amount: amount,
          message: message || `Donation from ${isAnonymous ? "Anonymous" : `@${sender.username}`}`,
          isAnonymous: isAnonymous,
        },
      }),
      // Deduct credits from sender
      prisma.user.update({
        where: { uid: authUser.uid },
        data: {
          credits: {
            decrement: amount,
          },
        },
      }),
      // Add credits to receiver
      prisma.user.update({
        where: { uid: receiverId },
        data: {
          credits: {
            increment: amount,
          },
        },
      }),
    ]);

    res.json({
      message: "Donation sent successfully",
      donation: {
        id: donation.id,
        amount: amount,
        currency: "PHP",
        receiver: {
          username: receiver.username,
          name: receiver.name,
        },
        sender: isAnonymous ? "Anonymous" : {
          username: sender.username,
        },
        isAnonymous: isAnonymous,
        createdAt: donation.createdAt,
      },
      transaction: {
        type: "credit_transfer",
        status: "completed",
        amount: amount,
        remainingCredits: sender.credits - amount,
      },
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    }
    console.error("Donate to user error:", error);
    res.status(500).json({ error: "Error processing donation: " + error.message });
  }
};

export const getUserSubscriptions = async (req: Request, res: Response) => {
  try {
    await initializePrisma();
    const authUser = (req as any).user as { uid: string };

    const subscriptions = await prisma.userSubscription.findMany({
      where: { subscriberId: authUser.uid },
      include: {
        creator: {
          select: {
            uid: true,
            username: true,
            name: true,
            photoURL: true,
            hasBlueCheck: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ subscriptions });
  } catch (error: any) {
    console.error("Get subscriptions error:", error);
    res.status(500).json({ error: "Error fetching subscriptions: " + error.message });
  }
};

export const getCreatorSubscribers = async (req: Request, res: Response) => {
  try {
    await initializePrisma();
    const authUser = (req as any).user as { uid: string };

    const subscribers = await prisma.userSubscription.findMany({
      where: { creatorId: authUser.uid, status: "active" },
      include: {
        subscriber: {
          select: {
            uid: true,
            username: true,
            name: true,
            photoURL: true,
            hasBlueCheck: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const stats = await prisma.userSubscription.aggregate({
      where: { creatorId: authUser.uid, status: "active" },
      _sum: { amount: true },
      _count: { id: true },
    });

    res.json({ 
      subscribers,
      stats: {
        totalRevenue: stats._sum.amount || 0,
        totalSubscribers: stats._count.id || 0,
      },
    });
  } catch (error: any) {
    console.error("Get subscribers error:", error);
    res.status(500).json({ error: "Error fetching subscribers: " + error.message });
  }
};

export const createSticker = async (req: Request, res: Response) => {
  try {
    await initializePrisma();
    const authUser = (req as any).user as { uid: string };
    const { name, imageUrl, price, category } = CreateStickerSchema.parse(req.body);

    const sticker = await prisma.sticker.create({
      data: {
        name,
        imageUrl,
        price,
        category,
        creatorId: authUser.uid,
      },
    });

    res.status(201).json({
      message: "Sticker created successfully",
      sticker,
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    }
    console.error("Create sticker error:", error);
    res.status(500).json({ error: "Error creating sticker: " + error.message });
  }
};

export const getStickers = async (req: Request, res: Response) => {
  try {
    await initializePrisma();
    const { creatorId, category } = req.query;

    const where: any = { isActive: true };
    if (creatorId) where.creatorId = creatorId;
    if (category) where.category = category;

    const stickers = await prisma.sticker.findMany({
      where,
      include: {
        creator: {
          select: {
            uid: true,
            username: true,
            name: true,
            photoURL: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ stickers });
  } catch (error: any) {
    console.error("Get stickers error:", error);
    res.status(500).json({ error: "Error fetching stickers: " + error.message });
  }
};

export const createSubscriptionPerk = async (req: Request, res: Response) => {
  try {
    await initializePrisma();
    const authUser = (req as any).user as { uid: string };
    const { tier, title, description } = CreatePerkSchema.parse(req.body);

    const perk = await prisma.subscriptionPerk.create({
      data: {
        tier,
        title,
        description,
        creatorId: authUser.uid,
      },
    });

    res.status(201).json({
      message: "Subscription perk created successfully",
      perk,
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    }
    console.error("Create perk error:", error);
    res.status(500).json({ error: "Error creating perk: " + error.message });
  }
};

export const getSubscriptionPerks = async (req: Request, res: Response) => {
  try {
    await initializePrisma();
    const { creatorId } = req.params;

    const perks = await prisma.subscriptionPerk.findMany({
      where: { creatorId, isActive: true },
      orderBy: [{ tier: "asc" }, { createdAt: "desc" }],
    });

    const groupedPerks = {
      basic: perks.filter((p: any) => p.tier === "basic"),
      premium: perks.filter((p: any) => p.tier === "premium"),
      vip: perks.filter((p: any) => p.tier === "vip"),
    };

    res.json({ 
      perks: groupedPerks,
      pricing: SUBSCRIPTION_PRICES,
    });
  } catch (error: any) {
    console.error("Get perks error:", error);
    res.status(500).json({ error: "Error fetching perks: " + error.message });
  }
};

export const handleSubscriptionWebhook = async (req: Request, res: Response) => {
  try {
    const event = req.body;

    if (event.event_type === "CHECKOUT.ORDER.APPROVED") {
      const resource = event.resource;
      const customId = resource.purchase_units?.[0]?.custom_id;

      if (customId) {
        const parts = customId.split("_");

        if (parts[0] === "subscription") {
          // Handle subscription payments
          const [, userId, creatorId, tier, paymentMethodId] = parts;

          if (userId && creatorId && tier) {
            const nextBillingDate = new Date();
            nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

            await prisma.userSubscription.create({
              data: {
                subscriberId: userId,
                creatorId: creatorId,
                tier: tier as "basic" | "premium" | "vip",
                amount: SUBSCRIPTION_PRICES[tier as keyof typeof SUBSCRIPTION_PRICES],
                status: "active",
                expiresAt: nextBillingDate,
              },
            });

            console.log(`User subscription created: ${userId} -> ${creatorId} (${tier})`);
          }
        } else if (parts[0] === "tip" && parts[1] === "comment") {
          // Handle tip payments from comments
          const [, , senderId, receiverId, amount, paymentMethodId] = parts;

          if (senderId && receiverId && amount) {
            await prisma.tip.create({
              data: {
                senderId: senderId,
                receiverId: receiverId,
                amount: parseInt(amount),
                message: "Tip via comment - payment completed",
              },
            });

            // Update receiver's credits
            await prisma.user.update({
              where: { uid: receiverId },
              data: {
                credits: {
                  increment: parseInt(amount),
                },
              },
            });

            console.log(`Comment tip completed: ${senderId} -> ${receiverId} (₱${parseInt(amount) / 100})`);
          }
        } else if (parts[0] === "donation" && parts[1] === "comment") {
          // Handle donation payments from comments
          const [, , senderId, receiverId, amount, paymentMethodId] = parts;

          if (senderId && receiverId && amount) {
            await prisma.donation.create({
              data: {
                senderId: senderId,
                receiverId: receiverId,
                amount: parseInt(amount),
                message: "Donation via comment - payment completed",
              },
            });

            // Update receiver's credits
            await prisma.user.update({
              where: { uid: receiverId },
              data: {
                credits: {
                  increment: parseInt(amount),
                },
              },
            });

            console.log(`Comment donation completed: ${senderId} -> ${receiverId} (₱${parseInt(amount) / 100})`);
          }
        } else if (parts[0] === "tip") {
          // Handle regular tip payments
          const [, senderId, receiverId, amount, paymentMethodId] = parts;

          if (senderId && receiverId && amount) {
            await prisma.tip.create({
              data: {
                senderId: senderId,
                receiverId: receiverId,
                amount: parseInt(amount),
                message: "Tip payment completed",
              },
            });

            // Update receiver's credits
            await prisma.user.update({
              where: { uid: receiverId },
              data: {
                credits: {
                  increment: parseInt(amount),
                },
              },
            });

            console.log(`Tip completed: ${senderId} -> ${receiverId} (₱${parseInt(amount) / 100})`);
          }
        } else if (parts[0] === "donation") {
          // Handle regular donation payments
          const [, senderId, receiverId, amount, paymentMethodId] = parts;

          if (senderId && receiverId && amount) {
            await prisma.donation.create({
              data: {
                senderId: senderId,
                receiverId: receiverId,
                amount: parseInt(amount),
                message: "Donation payment completed",
              },
            });

            // Update receiver's credits
            await prisma.user.update({
              where: { uid: receiverId },
              data: {
                credits: {
                  increment: parseInt(amount),
                },
              },
            });

            console.log(`Donation completed: ${senderId} -> ${receiverId} (₱${parseInt(amount) / 100})`);
          }
        }
      }
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error("Subscription webhook handler error:", error);
    res.status(500).json({ error: "Subscription webhook handler failed" });
  }
};

export const getSubscriptionTiers = async (req: Request, res: Response) => {
  try {
    res.json({
      tiers: [
        {
          id: "basic",
          name: "Basic Supporter",
          price: SUBSCRIPTION_PRICES.basic,
          currency: "USD",
          interval: "month",
          description: "Support your favorite creator",
          features: [
            "Exclusive subscriber badge",
            "Access to subscriber-only posts",
            "Priority comments",
            "Monthly subscriber newsletter",
          ],
        },
        {
          id: "premium",
          name: "Premium Supporter",
          price: SUBSCRIPTION_PRICES.premium,
          currency: "USD",
          interval: "month",
          description: "Enhanced creator support",
          features: [
            "All Basic features",
            "Custom subscriber badge",
            "Access to premium content",
            "Direct messaging with creator",
            "Early access to new content",
            "Monthly video call opportunity",
          ],
        },
        {
          id: "vip",
          name: "VIP Supporter",
          price: SUBSCRIPTION_PRICES.vip,
          currency: "USD",
          interval: "month",
          description: "Ultimate creator support",
          features: [
            "All Premium features",
            "VIP subscriber badge",
            "Behind-the-scenes content",
            "One-on-one creator sessions",
            "Custom content requests",
            "Merchandise discounts",
            "Name in creator's thank you posts",
          ],
        },
      ],
    });
  } catch (error: any) {
    console.error("Get subscription tiers error:", error);
    res.status(500).json({ error: "Error fetching subscription tiers: " + error.message });
  }
};