
import { Request, Response } from 'express';
import { z } from 'zod';
import { connect } from '../database/database';

let prisma: any;

(async () => {
  prisma = await connect();
})();

const PaymentMethodSchema = z.object({
  type: z.enum(['credit_card', 'debit_card', 'paypal', 'bank_transfer', 'crypto']),
  provider: z.string(),
  last4: z.string().optional(),
  expiryMonth: z.number().min(1).max(12).optional(),
  expiryYear: z.number().min(2024).optional(),
  holderName: z.string().optional(),
  paypalEmail: z.string().email().optional(),
  isDefault: z.boolean().default(false),
}).refine((data) => {
  if (data.type === 'paypal') {
    return data.paypalEmail;
  }
  if (data.type === 'credit_card' || data.type === 'debit_card') {
    return data.last4 && data.expiryMonth && data.expiryYear && data.holderName;
  }
  return true;
}, {
  message: "Required fields are missing for the selected payment method",
});

export const addPaymentMethod = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { uid: string };
    const paymentData = PaymentMethodSchema.parse(req.body);

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
        last4: paymentData.last4,
        expiryMonth: paymentData.expiryMonth,
        expiryYear: paymentData.expiryYear,
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
