
import { Request, Response } from "express";
import { z } from "zod";
import { connect } from "../database/database";
import axios from "axios";

let prisma: any;

(async () => {
  prisma = await connect();
})();

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

const PurchaseCreditsSchema = z.object({
  amount: z.number().min(500).max(50000), // Minimum ₱5, Maximum ₱500
  paymentMethodId: z.string(),
});

// Get user's current credits
export const getCredits = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { uid: string };

    const user = await prisma.user.findUnique({
      where: { uid: authUser.uid },
      select: { credits: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      credits: user.credits / 100, // Convert from centavos to pesos
      creditsInCentavos: user.credits,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Error fetching credits: " + error.message });
  }
};

// Purchase credits
export const purchaseCredits = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { uid: string };
    const { amount, paymentMethodId } = PurchaseCreditsSchema.parse(req.body);

    // Verify payment method belongs to user
    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        id: paymentMethodId,
        userId: authUser.uid,
      },
    });

    if (!paymentMethod) {
      return res.status(404).json({ message: "Payment method not found" });
    }

    const user = await prisma.user.findUnique({
      where: { uid: authUser.uid },
      select: { email: true, name: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    try {
      // Create PayPal order for credits
      const accessToken = await getPayPalAccessToken();

      const paypalOrder = await paypalAPI.post(
        "/v2/checkout/orders",
        {
          intent: "CAPTURE",
          purchase_units: [
            {
              amount: {
                currency_code: "PHP",
                value: (amount / 100).toFixed(2), // Convert centavos to peso
              },
              description: `Ad Campaign Credits - ₱${(amount / 100).toFixed(2)}`,
              custom_id: `credits_${authUser.uid}_${amount}`,
            },
          ],
          payment_source:
            paymentMethod.type === "paypal_wallet"
              ? {
                  paypal: {
                    email_address: paymentMethod.paypalEmail,
                    experience_context: {
                      return_url: `${process.env.FRONTEND_URL}/credits/success`,
                      cancel_url: `${process.env.FRONTEND_URL}/credits/cancel`,
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

      res.json({
        message: "Credit purchase initiated - complete payment to add credits",
        paymentIntentId: paypalOrder.data.id,
        provider: "paypal",
        approveUrl: paypalOrder.data.links?.find(
          (link: any) => link.rel === "approve",
        )?.href,
        amount: amount,
        currency: "PHP",
        description: `Ad Campaign Credits - ₱${(amount / 100).toFixed(2)}`,
      });
    } catch (providerError: any) {
      console.error("PayPal error:", providerError);
      return res.status(400).json({
        message: "Payment failed",
        error: providerError.response?.data?.message || providerError.message,
      });
    }
  } catch (err: any) {
    if (err.name === "ZodError") {
      return res
        .status(400)
        .json({ message: "Invalid payload", errors: err.errors });
    }
    console.error("Purchase credits error:", err);
    res.status(500).json({ error: "Error purchasing credits" });
  }
};

// Handle PayPal webhook for credits
export const handleCreditsWebhook = async (req: Request, res: Response) => {
  try {
    const event = req.body;

    if (event.event_type === "CHECKOUT.ORDER.APPROVED") {
      const resource = event.resource;
      const customId = resource.purchase_units?.[0]?.custom_id;

      if (customId && customId.startsWith("credits_")) {
        const [, userId, amount] = customId.split("_");

        if (userId && amount) {
          // Add credits to user account
          await prisma.user.update({
            where: { uid: userId },
            data: {
              credits: { increment: parseInt(amount) },
            },
          });

          console.log(`Credits added for user ${userId}: ₱${(parseInt(amount) / 100).toFixed(2)}`);
        }
      }
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error("Credits webhook handler error:", error);
    res.status(500).json({ error: "Credits webhook handler failed" });
  }
};

// Get available credit packages
export const getCreditPackages = async (req: Request, res: Response) => {
  try {
    const packages = [
      {
        amount: 500, // ₱5
        credits: 500,
        bonus: 0,
        popular: false,
        description: "Starter pack for small campaigns",
      },
      {
        amount: 1000, // ₱10
        credits: 1000,
        bonus: 100, // 10% bonus
        popular: false,
        description: "Good for medium campaigns",
      },
      {
        amount: 2500, // ₱25
        credits: 2500,
        bonus: 375, // 15% bonus
        popular: true,
        description: "Most popular package",
      },
      {
        amount: 5000, // ₱50
        credits: 5000,
        bonus: 1000, // 20% bonus
        popular: false,
        description: "Best value for large campaigns",
      },
      {
        amount: 10000, // ₱100
        credits: 10000,
        bonus: 2500, // 25% bonus
        popular: false,
        description: "Professional package",
      },
    ];

    res.json({
      packages: packages.map(pkg => ({
        ...pkg,
        totalCredits: pkg.credits + pkg.bonus,
        priceInPHP: pkg.amount / 100,
        priceDisplay: `₱${(pkg.amount / 100).toFixed(2)}`,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: "Error fetching credit packages: " + error.message });
  }
};
