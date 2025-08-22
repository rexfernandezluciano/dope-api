
# Payment API Documentation

This API provides payment functionality using PayPal as the exclusive payment provider. It supports both PayPal card payments and PayPal wallet payments for subscription purchases.

## Base URL
```
https://api.dopp.eu.org/v1/payments
```

## Authentication
All payment endpoints (except webhooks and providers) require authentication. Include the user's JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Endpoints

### 1. Get Available Payment Providers
**GET** `/providers`

Returns information about available payment methods and subscription plans.

**Response:**
```json
{
  "providers": ["PayPal"],
  "availableIn": "Philippines",
  "paymentMethods": [
    {
      "type": "paypal_card",
      "name": "Credit/Debit Card (PayPal)",
      "provider": "paypal",
      "supportedCards": ["Visa", "Mastercard", "American Express", "Discover"],
      "fees": "4.4% + ₱15",
      "processingTime": "Instant"
    },
    {
      "type": "paypal_wallet",
      "name": "PayPal Wallet",
      "provider": "paypal",
      "fees": "4.4% + ₱15",
      "processingTime": "Instant"
    }
  ],
  "membershipPlans": [
    {
      "type": "premium",
      "name": "Premium",
      "price": 560,
      "currency": "PHP",
      "interval": "month",
      "features": [
        "Ad-free experience",
        "Priority support",
        "Extended analytics",
        "Custom themes"
      ]
    },
    {
      "type": "pro",
      "name": "Pro",
      "price": 1120,
      "currency": "PHP",
      "interval": "month",
      "features": [
        "All Premium features",
        "Advanced analytics",
        "API access",
        "Custom branding",
        "Priority moderation"
      ]
    }
  ]
}
```

### 2. Add Payment Method
**POST** `/methods`

Adds a new PayPal payment method to the user's account.

**Request Body:**
```json
{
  "type": "paypal_card" | "paypal_wallet",
  "paypalPaymentMethodId": "string (optional)",
  "last4": "string (optional)",
  "expiryMonth": "number (1-12, optional)",
  "expiryYear": "number (≥2024, optional)",
  "holderName": "string (optional)",
  "paypalEmail": "string (optional, required for paypal_wallet)",
  "isDefault": "boolean (default: false)"
}
```

**Validation Rules:**
- For `paypal_card`: Requires either `paypalPaymentMethodId` OR (`last4`, `expiryMonth`, `expiryYear`, `holderName`)
- For `paypal_wallet`: Requires either `paypalEmail` OR `paypalPaymentMethodId`

**Response:**
```json
{
  "message": "Payment method added successfully",
  "paymentMethod": {
    "id": "string",
    "type": "paypal_card",
    "provider": "paypal",
    "last4": "1234",
    "isDefault": false,
    "paypalEmail": "user@example.com" // Only for paypal_wallet
  }
}
```

**Error Responses:**
- `400`: Invalid payload or validation errors
- `404`: User not found
- `500`: Server error

### 3. Get Payment Methods
**GET** `/methods`

Retrieves all payment methods for the authenticated user.

**Response:**
```json
{
  "paymentMethods": [
    {
      "id": "string",
      "type": "paypal_card",
      "provider": "paypal",
      "last4": "1234",
      "expiryMonth": 12,
      "expiryYear": 2025,
      "holderName": "John Doe",
      "paypalEmail": "user@example.com",
      "isDefault": true,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 4. Delete Payment Method
**DELETE** `/methods/:paymentMethodId`

Removes a payment method from the user's account.

**Parameters:**
- `paymentMethodId`: ID of the payment method to delete

**Response:**
```json
{
  "message": "Payment method deleted successfully"
}
```

**Error Responses:**
- `404`: Payment method not found
- `500`: Server error

### 5. Purchase Membership
**POST** `/purchase-membership`

Initiates a subscription purchase using PayPal.

**Request Body:**
```json
{
  "subscription": "premium" | "pro",
  "paymentMethodId": "string"
}
```

**Response:**
```json
{
  "message": "Payment initiated - complete payment to activate subscription",
  "paymentIntentId": "string",
  "provider": "paypal",
  "approveUrl": "https://paypal.com/approve/...",
  "amount": 56000,
  "currency": "PHP",
  "description": "Premium Subscription"
}
```

**Error Responses:**
- `400`: Invalid subscription type or payment failed
- `404`: Payment method or user not found
- `500`: Server error

### 6. PayPal Webhook
**POST** `/webhook/paypal`

Handles PayPal webhook events for payment processing.

**Webhook Events Handled:**
- `CHECKOUT.ORDER.APPROVED`: Activates subscription when payment is approved

**Request Body:** (PayPal webhook format)
```json
{
  "event_type": "CHECKOUT.ORDER.APPROVED",
  "resource": {
    "purchase_units": [
      {
        "custom_id": "userId_subscription_paymentMethodId"
      }
    ]
  }
}
```

**Response:**
```json
{
  "received": true
}
```

## Payment Flow

### For New Users:
1. Get available providers: `GET /providers`
2. Add a payment method: `POST /methods`
3. Purchase subscription: `POST /purchase-membership`
4. Complete payment on PayPal (user redirected to `approveUrl`)
5. PayPal sends webhook to activate subscription

### For Existing Users:
1. Get existing payment methods: `GET /methods`
2. Purchase subscription with existing method: `POST /purchase-membership`
3. Complete payment on PayPal
4. Subscription activated via webhook

## Error Handling

All endpoints return consistent error responses:

```json
{
  "message": "Error description",
  "error": "Detailed error message",
  "errors": [ // For validation errors
    {
      "field": "fieldName",
      "message": "Validation error message"
    }
  ]
}
```

## Environment Variables Required

```env
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com  # Use https://api-m.paypal.com for production
FRONTEND_URL=https://www.dopp.eu.org
```

## Subscription Pricing

- **Premium**: ₱560 PHP per month
- **Pro**: ₱1,120 PHP per month

All prices are in Philippine Peso (PHP) and charged monthly.
