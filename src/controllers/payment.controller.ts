
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
  baseURL: process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com", // Use sandbox for testing
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json",
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
    const response = await paypalAPI.post("/v1/oauth2/token", 
      "grant_type=client_credentials", {
      headers: {
        "Authorization": `Basic ${Buffer.from(process.env.PAYPAL_CLIENT_ID + ":" + process.env.PAYPAL_CLIENT_SECRET).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    paypalAccessToken = response.data.access_token;
    tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // Subtract 1 minute for safety
    return paypalAccessToken;
  } catch (error) {
    console.error("PayPal token error:", error);
    throw error;
  }
};

const PaymentMethodSchema = z
  .object({
    type: z.enum([
      "paypal_card",
      "paypal_wallet",
    ]),
    paypalPaymentMethodId: z.string().optional(),
    last4: z.string().optional(),
    expiryMonth: z.number().min(1).max(12).optional(),
    expiryYear: z.number().min(2024).optional(),
    holderName: z.string().optional(),
    paypalEmail: z.string().email().optional(), // For PayPal wallet
    isDefault: z.boolean().default(false),
  })
  .refine(
    (data) => {
      if (data.type === "paypal_card") {
        return data.paypalPaymentMethodId || (data.last4 && data.expiryMonth && data.expiryYear && data.holderName);
      }
      if (data.type === "paypal_wallet") {
        return data.paypalEmail || data.paypalPaymentMethodId;
      }
      return true;
    },
    {
      message: "Required fields are missing for the selected payment method",
    },
  );

export const addPaymentMethod = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { uid: string };
    const paymentData = PaymentMethodSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { uid: authUser.uid },
      select: { email: true, name: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let providerPaymentMethod: any = null;

    // PayPal payment method handling
    if (paymentData.paypalPaymentMethodId) {
      try {
        const accessToken = await getPayPalAccessToken();
        const response = await paypalAPI.get(
          `/v3/vault/payment-tokens/${paymentData.paypalPaymentMethodId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
        providerPaymentMethod = response.data;
      } catch (error) {
        console.error("PayPal payment method error:", error);
      }
    }

    // If this is set as default, unset other default methods
    if (paymentData.isDefault) {
      await prisma.paymentMethod.updateMany({
        where: { userId: authUser.uid, isDefault: true },
        data: { isDefault: false },
      });
    }

    const paymentMethod = await prisma.paymentMethod.create({
      data: {
        type: paymentData.type,
        provider: 'paypal',
        paypalPaymentMethodId: paymentData.paypalPaymentMethodId,
        last4: paymentData.last4 || providerPaymentMethod?.payment_source?.card?.last_digits,
        expiryMonth: paymentData.expiryMonth || (providerPaymentMethod?.payment_source?.card?.expiry?.split('/')[0] ? parseInt(providerPaymentMethod.payment_source.card.expiry.split('/')[0]) : null),
        expiryYear: paymentData.expiryYear || (providerPaymentMethod?.payment_source?.card?.expiry?.split('/')[1] ? parseInt('20' + providerPaymentMethod.payment_source.card.expiry.split('/')[1]) : null),
        holderName: paymentData.holderName || providerPaymentMethod?.payment_source?.card?.name,
        paypalEmail: paymentData.paypalEmail,
        isDefault: paymentData.isDefault,
        userId: authUser.uid,
      },
    });

    res.status(201).json({
      message: "Payment method added successfully",
      paymentMethod: {
        id: paymentMethod.id,
        type: paymentMethod.type,
        provider: 'paypal',
        last4: paymentMethod.last4,
        isDefault: paymentMethod.isDefault,
        paypalEmail: paymentData.type === "paypal_wallet" ? paymentData.paypalEmail : undefined,
      },
    });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return res
        .status(400)
        .json({ message: "Invalid payload", errors: err.errors });
    }
    console.error("Payment method error:", err);
    res.status(500).json({ error: "Error adding payment method" });
  }
};

export const getPaymentMethods = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { uid: string };

    const paymentMethods = await prisma.paymentMethod.findMany({
      where: { userId: authUser.uid },
      select: {
        id: true,
        type: true,
        provider: true,
        last4: true,
        expiryMonth: true,
        expiryYear: true,
        holderName: true,
        paypalEmail: true,
        isDefault: true,
        createdAt: true,
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    res.json({ paymentMethods });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: "Error fetching payment methods: " + error.message });
  }
};

export const deletePaymentMethod = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { uid: string };
    const { paymentMethodId } = req.params;

    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        id: paymentMethodId,
        userId: authUser.uid,
      },
    });

    if (!paymentMethod) {
      return res.status(404).json({ message: "Payment method not found" });
    }

    await prisma.paymentMethod.delete({
      where: { id: paymentMethodId },
    });

    res.json({ message: "Payment method deleted successfully" });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: "Error deleting payment method: " + error.message });
  }
};

export const purchaseMembership = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { uid: string };
    const { subscription, paymentMethodId } = req.body;

    // Validate subscription type
    if (!["premium", "pro"].includes(subscription)) {
      return res.status(400).json({ message: "Invalid subscription type" });
    }

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

    // Define subscription prices in PHP (Philippine Peso)
    const subscriptionPrices = {
      premium: {
        php_amount: 56000, // ₱560 PHP (in centavos)
        description: "Premium Subscription",
      },
      pro: {
        php_amount: 112000, // ₱1120 PHP (in centavos)
        description: "Pro Subscription",
      },
    };

    const selectedPlan =
      subscriptionPrices[subscription as keyof typeof subscriptionPrices];

    try {
      // Create PayPal order
      const accessToken = await getPayPalAccessToken();
      
      const paypalOrder = await paypalAPI.post("/v2/checkout/orders", {
        intent: "CAPTURE",
        purchase_units: [{
          amount: {
            currency_code: "PHP",
            value: (selectedPlan.php_amount / 100).toFixed(2), // Convert centavos to peso
          },
          description: selectedPlan.description,
          custom_id: `${authUser.uid}_${subscription}_${paymentMethodId}`,
        }],
        payment_source: paymentMethod.type === 'paypal_wallet' ? {
          paypal: {
            email_address: paymentMethod.paypalEmail,
            experience_context: {
              return_url: `${process.env.FRONTEND_URL}/payment/success`,
              cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
            }
          }
        } : {
          card: {
            vault_id: paymentMethod.paypalPaymentMethodId,
          }
        },
      }, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const subscriptionResult = {
        id: paypalOrder.data.id,
        provider: 'paypal',
        status: paypalOrder.data.status,
        approveUrl: paypalOrder.data.links?.find((link: any) => link.rel === 'approve')?.href,
      };

      res.json({
        message: "Payment initiated - complete payment to activate subscription",
        paymentIntentId: subscriptionResult.id,
        provider: 'paypal',
        approveUrl: subscriptionResult.approveUrl,
        amount: selectedPlan.php_amount,
        currency: "PHP",
        description: selectedPlan.description,
      });
    } catch (providerError: any) {
      console.error("PayPal error:", providerError);

      return res.status(400).json({
        message: "Payment failed",
        error:
          providerError.response?.data?.message ||
          providerError.message,
      });
    }
  } catch (error: any) {
    console.error("Purchase membership error:", error);
    res
      .status(500)
      .json({ error: "Error purchasing membership: " + error.message });
  }
};

export const handlePayPalWebhook = async (req: Request, res: Response) => {
  try {
    const event = req.body;

    if (event.event_type === "CHECKOUT.ORDER.APPROVED") {
      const resource = event.resource;
      const customId = resource.purchase_units?.[0]?.custom_id;

      if (customId) {
        const [userId, subscription, paymentMethodId] = customId.split('_');
        
        if (userId && subscription) {
          const nextBillingDate = new Date();
          nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

          await prisma.user.update({
            where: { uid: userId },
            data: {
              subscription: subscription as "premium" | "pro",
              nextBillingDate,
              hasBlueCheck: true,
            },
          });

          console.log(`PayPal subscription activated for user ${userId}: ${subscription}`);
        }
      }
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error("PayPal webhook handler error:", error);
    res.status(500).json({ error: "PayPal webhook handler failed" });
  }
};

export const getAvailablePaymentProviders = async (
  req: Request,
  res: Response,
) => {
  try {
    const paymentMethods = [
      {
        type: "paypal_card",
        name: "Credit/Debit Card (PayPal)",
        provider: "paypal",
        supportedCards: ["Visa", "Mastercard", "American Express", "Discover"],
        fees: "4.4% + ₱15",
        processingTime: "Instant",
      },
      {
        type: "paypal_wallet",
        name: "PayPal Wallet",
        provider: "paypal",
        fees: "4.4% + ₱15",
        processingTime: "Instant",
      },
    ];

    const membershipPlans = [
      {
        type: "premium",
        name: "Premium",
        price: 560,
        currency: "PHP",
        interval: "month",
        features: [
          "10 images per post",
          "Verification badge",
          "Basic support",
          "Advanced analytics",
          "Security protection"
        ],
      },
      {
        type: "pro",
        name: "Pro",
        price: 1120,
        currency: "PHP",
        interval: "month",
        features: [
          "Unlimited images per post",
          "Verification badge",
          "Advanced analytics",
          "Priority support",
          "Security protection",
          "Priority moderation",
        ],
      },
    ];

    res.json({
      providers: ["PayPal"],
      availableIn: "Philippines",
      paymentMethods,
      membershipPlans,
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: "Error fetching payment providers: " + error.message });
  }
};
