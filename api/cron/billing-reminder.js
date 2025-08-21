
/** @format */

// Vercel serverless function for billing reminder cron
export default async function handler(req, res) {
  // Verify the request is from Vercel Cron (optional security check)
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Import the TypeScript cron function
    const { checkBillingReminders } = await import('../../src/cron/billing-reminder.ts');
    
    // Execute the billing reminder check
    await checkBillingReminders();
    
    return res.status(200).json({ 
      message: 'Billing reminder cron job completed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[VERCEL CRON] Billing reminder job failed:', error);
    return res.status(500).json({ 
      error: 'Billing reminder cron job failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
