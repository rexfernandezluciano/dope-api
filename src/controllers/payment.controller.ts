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

const PaymentMethodSchema = z
  .object({
    type: z.enum([
      "credit_card",
      "debit_card",
      "gcash",
      "grabpay",
      "maya",
      "bank_transfer",
    ]),
    paymentMethodId: z.string().optional(),
    last4: z.string().optional(),
    expiryMonth: z.number().min(1).max(12).optional(),
    expiryYear: z.number().min(2024).optional(),
    holderName: z.string().optional(),
    phoneNumber: z.string().optional(), // For mobile wallets
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

    // PayMongo payment method handling
    if (paymentData.paymentMethodId) {
      try {
        const response = await paymongoAPI.get(
          `/payment_methods/${paymentData.paymentMethodId}`,
        );
        providerPaymentMethod = response.data.data;
      } catch (error) {
        console.error("PayMongo payment method error:", error);
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
        provider: "paymongo",
        paymongoPaymentMethodId: paymentData.paymentMethodId,
        last4: paymentData.last4 || providerPaymentMethod?.card?.last4,
        expiryMonth:
          paymentData.expiryMonth || providerPaymentMethod?.card?.exp_month,
        expiryYear:
          paymentData.expiryYear || providerPaymentMethod?.card?.exp_year,
        holderName: paymentData.holderName,
        phoneNumber: paymentData.phoneNumber,
        isDefault: paymentData.isDefault,
        userId: authUser.uid,
      },
    });

    res.status(201).json({
      message: "Payment method added successfully",
      paymentMethod: {
        id: paymentMethod.id,
        type: paymentMethod.type,
        provider: "paymongo",
        last4: paymentMethod.last4,
        isDefault: paymentMethod.isDefault,
        phoneNumber: ["gcash", "grabpay", "maya"].includes(paymentData.type)
          ? paymentData.phoneNumber
          : undefined,
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

      const subscriptionResult = paymongoPayment.data.data;

      res.json({
        message:
          "Payment initiated - complete payment to activate subscription",
        paymentIntentId: subscriptionResult.id,
        clientKey: subscriptionResult.attributes.client_key,
        nextActionUrl: subscriptionResult.attributes.next_action?.redirect?.url,
        amount: selectedPlan.php_amount,
        currency: "PHP",
        description: selectedPlan.description,
      });
    } catch (providerError: any) {
      console.error("PayMongo payment error:", providerError);

      return res.status(400).json({
        message: "Payment failed",
        error:
          providerError.response?.data?.errors?.[0]?.detail ||
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

export const getAvailablePaymentProviders = async (
  req: Request,
  res: Response,
) => {
  try {
    const paymentMethods = [
      {
        type: "credit_card",
        name: "Credit Card",
        supportedCards: ["Visa", "Mastercard", "JCB"],
        fees: "3.9% + ₱15",
        processingTime: "Instant",
      },
      {
        type: "debit_card",
        name: "Debit Card",
        supportedCards: ["Visa", "Mastercard"],
        fees: "3.9% + ₱15",
        processingTime: "Instant",
      },
      {
        type: "gcash",
        name: "GCash",
        fees: "₱15 flat fee",
        processingTime: "Instant",
      },
      {
        type: "grabpay",
        name: "GrabPay",
        fees: "₱15 flat fee",
        processingTime: "Instant",
      },
      {
        type: "maya",
        name: "Maya (PayMaya)",
        fees: "₱15 flat fee",
        processingTime: "Instant",
      },
      {
        type: "bank_transfer",
        name: "Online Banking",
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
      provider: "PayMongo",
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
