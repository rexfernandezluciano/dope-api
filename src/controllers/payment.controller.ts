
import { Request, Response } from 'express';
import { z } from 'zod';
import { connect } from '../database/database';
import Stripe from 'stripe';

let prisma: any;
let stripe: Stripe;

(async () => {
  prisma = await connect();
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-06-20',
  });
})();

const PaymentMethodSchema = z.object({
  type: z.enum(['credit_card', 'debit_card', 'paypal', 'bank_transfer', 'crypto']),
  provider: z.string().optional(),
  stripePaymentMethodId: z.string().optional(),
  last4: z.string().optional(),
  expiryMonth: z.number().min(1).max(12).optional(),
  expiryYear: z.number().min(2024).optional(),
  holderName: z.string().optional(),
  paypalEmail: z.string().email().optional(),
  isDefault: z.boolean().default(false),
}).refine((data) => {
  if (data.type === 'credit_card' || data.type === 'debit_card') {
    return data.stripePaymentMethodId || (data.last4 && data.expiryMonth && data.expiryYear && data.holderName);
  }
  if (data.type === 'paypal') {
    return data.paypalEmail;
  }
  return true;
}, {
  message: "Required fields are missing for the selected payment method",
});

export const addPaymentMethod = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { uid: string };
    const paymentData = PaymentMethodSchema.parse(req.body);

    let stripeCustomerId: string;
    
    // Get or create Stripe customer
    const user = await prisma.user.findUnique({
      where: { uid: authUser.uid },
      select: { email: true, name: true, stripeCustomerId: true },
    });

    if (!user.stripeCustomerId) {
      const stripeCustomer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: { userId: authUser.uid },
      });
      
      await prisma.user.update({
        where: { uid: authUser.uid },
        data: { stripeCustomerId: stripeCustomer.id },
      });
      
      stripeCustomerId = stripeCustomer.id;
    } else {
      stripeCustomerId = user.stripeCustomerId;
    }

    let stripePaymentMethod;
    if (paymentData.stripePaymentMethodId) {
      // Attach existing Stripe payment method to customer
      stripePaymentMethod = await stripe.paymentMethods.attach(
        paymentData.stripePaymentMethodId,
        { customer: stripeCustomerId }
      );
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
        provider: paymentData.provider || (stripePaymentMethod?.card?.brand || 'unknown'),
        stripePaymentMethodId: paymentData.stripePaymentMethodId,
        last4: paymentData.last4 || stripePaymentMethod?.card?.last4,
        expiryMonth: paymentData.expiryMonth || stripePaymentMethod?.card?.exp_month,
        expiryYear: paymentData.expiryYear || stripePaymentMethod?.card?.exp_year,
        holderName: paymentData.holderName,
        paypalEmail: paymentData.paypalEmail,
        isDefault: paymentData.isDefault,
        userId: authUser.uid,
      },
    });

    res.status(201).json({
      message: 'Payment method added successfully',
      paymentMethod: {
        id: paymentMethod.id,
        type: paymentMethod.type,
        provider: paymentMethod.provider,
        last4: paymentMethod.last4,
        isDefault: paymentMethod.isDefault,
        paypalEmail: paymentData.type === 'paypal' ? paymentData.paypalEmail : undefined,
      },
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ message: 'Invalid payload', errors: err.errors });
    }
    console.error('Payment method error:', err);
    res.status(500).json({ error: 'Error adding payment method' });
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
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    res.json({ paymentMethods });
  } catch (error: any) {
    res.status(500).json({ error: 'Error fetching payment methods: ' + error.message });
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
      return res.status(404).json({ message: 'Payment method not found' });
    }

    await prisma.paymentMethod.delete({
      where: { id: paymentMethodId },
    });

    res.json({ message: 'Payment method deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Error deleting payment method: ' + error.message });
  }
};

export const purchaseMembership = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { uid: string };
    const { subscription, paymentMethodId } = req.body;

    // Validate subscription type
    if (!['premium', 'pro'].includes(subscription)) {
      return res.status(400).json({ message: 'Invalid subscription type' });
    }

    // Verify payment method belongs to user
    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        id: paymentMethodId,
        userId: authUser.uid,
      },
    });

    if (!paymentMethod) {
      return res.status(404).json({ message: 'Payment method not found' });
    }

    const user = await prisma.user.findUnique({
      where: { uid: authUser.uid },
      select: { email: true, name: true, stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      return res.status(400).json({ message: 'Stripe customer not found' });
    }

    // Define subscription prices
    const subscriptionPrices = {
      premium: { amount: 999, priceId: process.env.STRIPE_PREMIUM_PRICE_ID }, // $9.99
      pro: { amount: 1999, priceId: process.env.STRIPE_PRO_PRICE_ID }, // $19.99
    };

    const selectedPlan = subscriptionPrices[subscription as keyof typeof subscriptionPrices];

    try {
      // Create Stripe subscription
      const stripeSubscription = await stripe.subscriptions.create({
        customer: user.stripeCustomerId,
        items: [{
          price: selectedPlan.priceId || selectedPlan.amount.toString(), // Use price ID if available, otherwise amount
        }],
        default_payment_method: paymentMethod.stripePaymentMethodId,
        expand: ['latest_invoice.payment_intent'],
      });

      // Calculate next billing date
      const nextBillingDate = new Date(stripeSubscription.current_period_end * 1000);

      // Update user subscription
      const updatedUser = await prisma.user.update({
        where: { uid: authUser.uid },
        data: {
          subscription: subscription as 'premium' | 'pro',
          nextBillingDate,
          hasBlueCheck: true,
          stripeSubscriptionId: stripeSubscription.id,
        },
      });

      res.json({
        message: 'Membership purchased successfully',
        subscription: updatedUser.subscription,
        nextBillingDate: updatedUser.nextBillingDate,
        stripeSubscriptionId: stripeSubscription.id,
      });

    } catch (stripeError: any) {
      console.error('Stripe subscription error:', stripeError);
      
      if (stripeError.type === 'StripeCardError') {
        return res.status(400).json({ 
          message: 'Payment failed', 
          error: stripeError.message 
        });
      }
      
      throw stripeError;
    }

  } catch (error: any) {
    console.error('Purchase membership error:', error);
    res.status(500).json({ error: 'Error purchasing membership: ' + error.message });
  }
};

export const createPaymentIntent = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { uid: string };
    const { subscription } = req.body;

    if (!['premium', 'pro'].includes(subscription)) {
      return res.status(400).json({ message: 'Invalid subscription type' });
    }

    const user = await prisma.user.findUnique({
      where: { uid: authUser.uid },
      select: { email: true, name: true, stripeCustomerId: true },
    });

    let stripeCustomerId = user?.stripeCustomerId;

    if (!stripeCustomerId) {
      const stripeCustomer = await stripe.customers.create({
        email: user!.email,
        name: user!.name || undefined,
        metadata: { userId: authUser.uid },
      });
      
      await prisma.user.update({
        where: { uid: authUser.uid },
        data: { stripeCustomerId: stripeCustomer.id },
      });
      
      stripeCustomerId = stripeCustomer.id;
    }

    const subscriptionPrices = {
      premium: 999, // $9.99
      pro: 1999, // $19.99
    };

    const amount = subscriptionPrices[subscription as keyof typeof subscriptionPrices];

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      customer: stripeCustomerId,
      metadata: {
        userId: authUser.uid,
        subscription,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      amount,
      currency: 'usd',
    });

  } catch (error: any) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ error: 'Error creating payment intent: ' + error.message });
  }
};

export const handleStripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const userId = paymentIntent.metadata.userId;
        const subscription = paymentIntent.metadata.subscription;

        if (userId && subscription) {
          const nextBillingDate = new Date();
          nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

          await prisma.user.update({
            where: { uid: userId },
            data: {
              subscription: subscription as 'premium' | 'pro',
              nextBillingDate,
              hasBlueCheck: true,
            },
          });

          console.log(`Subscription activated for user ${userId}: ${subscription}`);
        }
        break;

      case 'invoice.payment_failed':
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        
        const failedUser = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (failedUser) {
          // Handle failed payment - could downgrade to free tier
          console.log(`Payment failed for user ${failedUser.uid}`);
        }
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
};

export const getAvailablePaymentProviders = async (req: Request, res: Response) => {
  try {
    const providers = [
      {
        type: 'credit_card',
        name: 'Credit Card',
        providers: ['Visa', 'Mastercard', 'American Express', 'Discover'],
        fees: '2.9% + $0.30',
        processingTime: 'Instant',
      },
      {
        type: 'debit_card',
        name: 'Debit Card',
        providers: ['Visa', 'Mastercard'],
        fees: '2.9% + $0.30',
        processingTime: 'Instant',
      },
      {
        type: 'paypal',
        name: 'PayPal',
        providers: ['PayPal'],
        fees: '2.9% + $0.30',
        processingTime: 'Instant',
      },
      {
        type: 'bank_transfer',
        name: 'Bank Transfer',
        providers: ['ACH', 'Wire Transfer'],
        fees: '$0.80',
        processingTime: '1-3 business days',
      },
      {
        type: 'crypto',
        name: 'Cryptocurrency',
        providers: ['Bitcoin', 'Ethereum', 'USDC'],
        fees: '1.5%',
        processingTime: '10-60 minutes',
      },
    ];

    const membershipPlans = [
      {
        type: 'premium',
        name: 'Premium',
        price: 9.99,
        currency: 'USD',
        interval: 'month',
        features: [
          'Ad-free experience',
          'Priority support',
          'Extended analytics',
          'Custom themes',
        ],
      },
      {
        type: 'pro',
        name: 'Pro',
        price: 19.99,
        currency: 'USD',
        interval: 'month',
        features: [
          'All Premium features',
          'Advanced analytics',
          'API access',
          'Custom branding',
          'Priority moderation',
        ],
      },
    ];

    res.json({ providers, membershipPlans });
  } catch (error: any) {
    res.status(500).json({ error: 'Error fetching payment providers: ' + error.message });
  }
};
