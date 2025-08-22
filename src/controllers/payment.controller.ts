
import { Request, Response } from 'express';
import { z } from 'zod';
import { connect } from '../database/database';
import Stripe from 'stripe';
import axios from 'axios';

let prisma: any;
let stripe: Stripe;

(async () => {
  prisma = await connect();
  
  // Initialize Stripe if available
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-06-20',
    });
  }
})();

// PayMongo API helper
const paymongoAPI = axios.create({
  baseURL: 'https://api.paymongo.com/v1',
  headers: {
    'Authorization': `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY + ':').toString('base64')}`,
    'Content-Type': 'application/json',
  },
});

// Razorpay API helper
const razorpayAPI = axios.create({
  baseURL: 'https://api.razorpay.com/v1',
  auth: {
    username: process.env.RAZORPAY_KEY_ID || '',
    password: process.env.RAZORPAY_KEY_SECRET || '',
  },
});

// Xendit API helper
const xenditAPI = axios.create({
  baseURL: 'https://api.xendit.co',
  headers: {
    'Authorization': `Basic ${Buffer.from(process.env.XENDIT_SECRET_KEY + ':').toString('base64')}`,
    'Content-Type': 'application/json',
  },
});

const PaymentMethodSchema = z.object({
  type: z.enum(['credit_card', 'debit_card', 'paypal', 'bank_transfer', 'crypto', 'gcash', 'grabpay', 'maya']),
  provider: z.enum(['stripe', 'paymongo', 'razorpay', 'xendit']).default('paymongo'),
  paymentMethodId: z.string().optional(), // Generic payment method ID for any provider
  last4: z.string().optional(),
  expiryMonth: z.number().min(1).max(12).optional(),
  expiryYear: z.number().min(2024).optional(),
  holderName: z.string().optional(),
  paypalEmail: z.string().email().optional(),
  phoneNumber: z.string().optional(), // For mobile wallets
  isDefault: z.boolean().default(false),
}).refine((data) => {
  if (data.type === 'credit_card' || data.type === 'debit_card') {
    return data.paymentMethodId || (data.last4 && data.expiryMonth && data.expiryYear && data.holderName);
  }
  if (data.type === 'paypal') {
    return data.paypalEmail;
  }
  if (data.type === 'gcash' || data.type === 'grabpay' || data.type === 'maya') {
    return data.phoneNumber;
  }
  return true;
}, {
  message: "Required fields are missing for the selected payment method",
});

export const addPaymentMethod = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { uid: string };
    const paymentData = PaymentMethodSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { uid: authUser.uid },
      select: { email: true, name: true, stripeCustomerId: true, paymongoCustomerId: true },
    });

    let customerId: string = '';
    let providerPaymentMethod: any = null;

    // Handle different payment providers
    switch (paymentData.provider) {
      case 'stripe':
        if (stripe && paymentData.paymentMethodId) {
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

          providerPaymentMethod = await stripe.paymentMethods.attach(
            paymentData.paymentMethodId,
            { customer: stripeCustomerId }
          );
          customerId = stripeCustomerId;
        }
        break;

      case 'paymongo':
        // PayMongo handles payment methods differently - store the payment method details
        if (paymentData.paymentMethodId) {
          try {
            const response = await paymongoAPI.get(`/payment_methods/${paymentData.paymentMethodId}`);
            providerPaymentMethod = response.data.data;
          } catch (error) {
            console.error('PayMongo payment method error:', error);
          }
        }
        break;

      case 'razorpay':
        // Store Razorpay customer and payment method details
        customerId = user?.email || authUser.uid;
        break;

      case 'xendit':
        // Store Xendit payment method details
        customerId = user?.email || authUser.uid;
        break;
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
        provider: paymentData.provider,
        stripePaymentMethodId: paymentData.provider === 'stripe' ? paymentData.paymentMethodId : null,
        paymongoPaymentMethodId: paymentData.provider === 'paymongo' ? paymentData.paymentMethodId : null,
        last4: paymentData.last4 || providerPaymentMethod?.card?.last4,
        expiryMonth: paymentData.expiryMonth || providerPaymentMethod?.card?.exp_month,
        expiryYear: paymentData.expiryYear || providerPaymentMethod?.card?.exp_year,
        holderName: paymentData.holderName,
        paypalEmail: paymentData.paypalEmail,
        phoneNumber: paymentData.phoneNumber,
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
        phoneNumber: ['gcash', 'grabpay', 'maya'].includes(paymentData.type) ? paymentData.phoneNumber : undefined,
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

    // Define subscription prices in PHP (Philippine Peso) for local providers
    const subscriptionPrices = {
      premium: { 
        amount: 999, // $9.99 USD
        php_amount: 56000, // ₱560 PHP
        description: 'Premium Subscription'
      },
      pro: { 
        amount: 1999, // $19.99 USD
        php_amount: 112000, // ₱1120 PHP  
        description: 'Pro Subscription'
      },
    };

    const selectedPlan = subscriptionPrices[subscription as keyof typeof subscriptionPrices];

    try {
      let subscriptionResult: any = null;
      let nextBillingDate = new Date();
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

      switch (paymentMethod.provider) {
        case 'stripe':
          if (stripe && user?.stripeCustomerId) {
            subscriptionResult = await stripe.subscriptions.create({
              customer: user.stripeCustomerId,
              items: [{
                price_data: {
                  currency: 'usd',
                  product_data: {
                    name: selectedPlan.description,
                  },
                  unit_amount: selectedPlan.amount,
                  recurring: {
                    interval: 'month',
                  },
                },
              }],
              default_payment_method: paymentMethod.stripePaymentMethodId,
              expand: ['latest_invoice.payment_intent'],
            });
            nextBillingDate = new Date(subscriptionResult.current_period_end * 1000);
          }
          break;

        case 'paymongo':
          // Create PayMongo payment intent
          const paymongoPayment = await paymongoAPI.post('/payment_intents', {
            data: {
              attributes: {
                amount: selectedPlan.php_amount, // Amount in centavos
                payment_method_allowed: ['card', 'gcash', 'grab_pay', 'maya'],
                payment_method_options: {
                  card: {
                    request_three_d_secure: 'automatic'
                  }
                },
                currency: 'PHP',
                description: selectedPlan.description,
                statement_descriptor: 'DOPE Network',
                metadata: {
                  user_id: authUser.uid,
                  subscription: subscription
                }
              }
            }
          });
          subscriptionResult = paymongoPayment.data.data;
          break;

        case 'razorpay':
          // Create Razorpay subscription
          const razorpaySubscription = await razorpayAPI.post('/subscriptions', {
            plan_id: `${subscription}_monthly`,
            customer_notify: 1,
            total_count: 12, // 12 months
            notes: {
              user_id: authUser.uid,
              subscription: subscription
            }
          });
          subscriptionResult = razorpaySubscription.data;
          break;

        case 'xendit':
          // Create Xendit invoice
          const xenditInvoice = await xenditAPI.post('/v2/invoices', {
            external_id: `subscription_${authUser.uid}_${Date.now()}`,
            amount: selectedPlan.php_amount / 100, // Convert from centavos to peso
            payer_email: user!.email,
            description: selectedPlan.description,
            invoice_duration: 86400, // 24 hours
            success_redirect_url: `${process.env.FRONTEND_URL}/payment/success`,
            failure_redirect_url: `${process.env.FRONTEND_URL}/payment/failed`,
            currency: 'PHP',
            items: [{
              name: selectedPlan.description,
              quantity: 1,
              price: selectedPlan.php_amount / 100,
              category: 'Subscription'
            }]
          });
          subscriptionResult = xenditInvoice.data;
          break;

        default:
          return res.status(400).json({ message: 'Unsupported payment provider' });
      }

      // For non-Stripe providers, we'll update subscription after payment confirmation
      // For now, create a pending status that will be updated via webhook
      const updatedUser = await prisma.user.update({
        where: { uid: authUser.uid },
        data: {
          subscription: paymentMethod.provider === 'stripe' ? subscription as 'premium' | 'pro' : 'free',
          nextBillingDate: paymentMethod.provider === 'stripe' ? nextBillingDate : null,
          hasBlueCheck: paymentMethod.provider === 'stripe',
          stripeSubscriptionId: paymentMethod.provider === 'stripe' ? subscriptionResult?.id : null,
        },
      });

      res.json({
        message: paymentMethod.provider === 'stripe' 
          ? 'Membership purchased successfully' 
          : 'Payment initiated - complete payment to activate subscription',
        subscription: updatedUser.subscription,
        nextBillingDate: updatedUser.nextBillingDate,
        paymentUrl: subscriptionResult?.checkout_url || subscriptionResult?.invoice_url,
        paymentId: subscriptionResult?.id,
        provider: paymentMethod.provider,
      });

    } catch (providerError: any) {
      console.error(`${paymentMethod.provider} payment error:`, providerError);
      
      return res.status(400).json({ 
        message: 'Payment failed', 
        error: providerError.response?.data?.message || providerError.message 
      });
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
        name: 'Credit/Debit Card',
        providers: ['paymongo', 'stripe'],
        supportedCards: ['Visa', 'Mastercard', 'American Express'],
        fees: '3.9% + ₱15 (PayMongo) | 2.9% + $0.30 (Stripe)',
        processingTime: 'Instant',
        availableIn: ['Philippines', 'Global'],
      },
      {
        type: 'gcash',
        name: 'GCash',
        providers: ['paymongo', 'xendit'],
        fees: '₱15 flat fee',
        processingTime: 'Instant',
        availableIn: ['Philippines'],
      },
      {
        type: 'grabpay',
        name: 'GrabPay',
        providers: ['paymongo', 'xendit'],
        fees: '₱15 flat fee',
        processingTime: 'Instant',
        availableIn: ['Philippines'],
      },
      {
        type: 'maya',
        name: 'Maya (PayMaya)',
        providers: ['paymongo', 'xendit'],
        fees: '₱15 flat fee',
        processingTime: 'Instant',
        availableIn: ['Philippines'],
      },
      {
        type: 'bank_transfer',
        name: 'Online Banking',
        providers: ['paymongo', 'xendit'],
        supportedBanks: ['BPI', 'BDO', 'Metrobank', 'Unionbank', 'RCBC'],
        fees: '₱15 flat fee',
        processingTime: 'Instant',
        availableIn: ['Philippines'],
      },
      {
        type: 'paypal',
        name: 'PayPal',
        providers: ['paypal'],
        fees: '3.9% + fixed fee',
        processingTime: 'Instant',
        availableIn: ['Global'],
      },
    ];

    const membershipPlans = [
      {
        type: 'premium',
        name: 'Premium',
        price: 9.99,
        pricePhp: 560,
        currency: 'USD',
        currencyPhp: 'PHP',
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
        pricePhp: 1120,
        currency: 'USD',
        currencyPhp: 'PHP',
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
