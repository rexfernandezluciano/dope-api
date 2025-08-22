import { Request, Response } from "express";
import { z } from "zod";
import { connect } from "../database/database";
import axios from "axios";

let prisma: any;

(async () => {
  prisma = await connect();
})();

// PayMongo API helper
const paymongoAPI = axios.create({
  baseURL: "https://api.paymongo.com/v1",
  headers: {
    Authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY + ":").toString("base64")}`,
    "Content-Type": "application/json",
  },
});

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
      "credit_card",
      "debit_card",
      "gcash",
      "grabpay",
      "maya",
      "bank_transfer",
      "paypal_card",
      "paypal_wallet",
    ]),
    provider: z.enum(["paymongo", "paypal"]).optional(),
    paymentMethodId: z.string().optional(),
    paypalPaymentMethodId: z.string().optional(),
    last4: z.string().optional(),
    expiryMonth: z.number().min(1).max(12).optional(),
    expiryYear: z.number().min(2024).optional(),
    holderName: z.string().optional(),
    phoneNumber: z.string().optional(), // For mobile wallets
    paypalEmail: z.string().email().optional(), // For PayPal wallet
    isDefault: z.boolean().default(false),
  })
  .refine(
    (data) => {
      if (data.type === "credit_card" || data.type === "debit_card") {
        return (
          data.paymentMethodId ||
          (data.last4 && data.expiryMonth && data.expiryYear && data.holderName)
        );
      }
      if (
        data.type === "gcash" ||
        data.type === "grabpay" ||
        data.type === "maya"
      ) {
        return data.phoneNumber;
      }
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
      select: { email: true, name: true, paymongoCustomerId: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let providerPaymentMethod: any = null;
    const provider = paymentData.provider || (paymentData.type.startsWith('paypal') ? 'paypal' : 'paymongo');

    // PayMongo payment method handling
    if (provider === 'paymongo' && paymentData.paymentMethodId) {
      try {
        const response = await paymongoAPI.get(
          `/payment_methods/${paymentData.paymentMethodId}`,
        );
        providerPaymentMethod = response.data.data;
      } catch (error) {
        console.error("PayMongo payment method error:", error);
      }
    }

    // PayPal payment method handling
    if (provider === 'paypal' && paymentData.paypalPaymentMethodId) {
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
        provider: provider,
        paymongoPaymentMethodId: provider === 'paymongo' ? paymentData.paymentMethodId : null,
        paypalPaymentMethodId: provider === 'paypal' ? paymentData.paypalPaymentMethodId : null,
        last4: paymentData.last4 || 
              (provider === 'paymongo' ? providerPaymentMethod?.card?.last4 : null) ||
              (provider === 'paypal' ? providerPaymentMethod?.payment_source?.card?.last_digits : null),
        expiryMonth:
          paymentData.expiryMonth || 
          (provider === 'paymongo' ? providerPaymentMethod?.card?.exp_month : null) ||
          (provider === 'paypal' ? providerPaymentMethod?.payment_source?.card?.expiry?.split('/')[0] : null),
        expiryYear:
          paymentData.expiryYear || 
          (provider === 'paymongo' ? providerPaymentMethod?.card?.exp_year : null) ||
          (provider === 'paypal' ? parseInt('20' + providerPaymentMethod?.payment_source?.card?.expiry?.split('/')[1]) : null),
        holderName: paymentData.holderName || providerPaymentMethod?.payment_source?.card?.name,
        phoneNumber: paymentData.phoneNumber,
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
        provider: provider,
        last4: paymentMethod.last4,
        isDefault: paymentMethod.isDefault,
        phoneNumber: ["gcash", "grabpay", "maya"].includes(paymentData.type)
          ? paymentData.phoneNumber
          : undefined,
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
      select: { email: true, name: true, paymongoCustomerId: true },
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
      let subscriptionResult: any;
      
      if (paymentMethod.provider === 'paypal') {
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

        subscriptionResult = {
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
      } else {
        // Create PayMongo payment intent
        const paymongoPayment = await paymongoAPI.post("/payment_intents", {
          data: {
            attributes: {
              amount: selectedPlan.php_amount, // Amount in centavos
              payment_method_allowed: ["card", "gcash", "grab_pay", "maya"],
              payment_method_options: {
                card: {
                  request_three_d_secure: "automatic",
                },
              },
              currency: "PHP",
              description: selectedPlan.description,
              statement_descriptor: "DOPE Network",
              metadata: {
                user_id: authUser.uid,
                subscription: subscription,
                payment_method_id: paymentMethodId,
              },
            },
          },
        });

        subscriptionResult = paymongoPayment.data.data;

        res.json({
          message: "Payment initiated - complete payment to activate subscription",
          paymentIntentId: subscriptionResult.id,
          provider: 'paymongo',
          clientKey: subscriptionResult.attributes.client_key,
          nextActionUrl: subscriptionResult.attributes.next_action?.redirect?.url,
          amount: selectedPlan.php_amount,
          currency: "PHP",
          description: selectedPlan.description,
        });
      }
    } catch (providerError: any) {
      console.error("Payment provider error:", providerError);

      return res.status(400).json({
        message: "Payment failed",
        error:
          providerError.response?.data?.errors?.[0]?.detail ||
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

export const handlePayMongoWebhook = async (req: Request, res: Response) => {
  try {
    const event = req.body;

    if (event.data?.attributes?.type === "payment_intent.payment_succeeded") {
      const paymentIntent = event.data.attributes;
      const metadata = paymentIntent.metadata;

      if (metadata?.user_id && metadata?.subscription) {
        const nextBillingDate = new Date();
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

        await prisma.user.update({
          where: { uid: metadata.user_id },
          data: {
            subscription: metadata.subscription as "premium" | "pro",
            nextBillingDate,
            hasBlueCheck: true,
          },
        });

        console.log(
          `Subscription activated for user ${metadata.user_id}: ${metadata.subscription}`,
        );
      }
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error("PayMongo webhook handler error:", error);
    res.status(500).json({ error: "Webhook handler failed" });
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
        type: "credit_card",
        name: "Credit Card (PayMongo)",
        provider: "paymongo",
        supportedCards: ["Visa", "Mastercard", "JCB"],
        fees: "3.9% + ₱15",
        processingTime: "Instant",
      },
      {
        type: "debit_card",
        name: "Debit Card (PayMongo)",
        provider: "paymongo",
        supportedCards: ["Visa", "Mastercard"],
        fees: "3.9% + ₱15",
        processingTime: "Instant",
      },
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
      {
        type: "gcash",
        name: "GCash",
        provider: "paymongo",
        fees: "₱15 flat fee",
        processingTime: "Instant",
      },
      {
        type: "grabpay",
        name: "GrabPay",
        provider: "paymongo",
        fees: "₱15 flat fee",
        processingTime: "Instant",
      },
      {
        type: "maya",
        name: "Maya (PayMaya)",
        provider: "paymongo",
        fees: "₱15 flat fee",
        processingTime: "Instant",
      },
      {
        type: "bank_transfer",
        name: "Online Banking",
        provider: "paymongo",
        supportedBanks: [
          "BPI",
          "BDO",
          "Metrobank",
          "Unionbank",
          "RCBC",
          "Security Bank",
        ],
        fees: "₱15 flat fee",
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
          "Ad-free experience",
          "Priority support",
          "Extended analytics",
          "Custom themes",
        ],
      },
      {
        type: "pro",
        name: "Pro",
        price: 1120,
        currency: "PHP",
        interval: "month",
        features: [
          "All Premium features",
          "Advanced analytics",
          "API access",
          "Custom branding",
          "Priority moderation",
        ],
      },
    ];

    res.json({
      providers: ["PayMongo", "PayPal"],
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
