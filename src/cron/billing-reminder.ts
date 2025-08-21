
/** @format */

import { connect } from '../database/database';
import { sendBillingReminderEmail } from '../utils/mailer';
import dayjs from 'dayjs';

let prisma: any;

async function initializePrisma() {
  if (!prisma) {
    prisma = await connect();
  }
}

export async function checkBillingReminders() {
  try {
    await initializePrisma();
    
    // Calculate the target date (3 days from now)
    const targetDate = dayjs().add(3, 'day').startOf('day').toDate();
    const targetDateEnd = dayjs().add(3, 'day').endOf('day').toDate();
    
    console.log(`[BILLING REMINDER] Checking for billing dates on ${dayjs(targetDate).format('YYYY-MM-DD')}`);
    
    // Find users whose billing date is exactly 3 days from now
    const usersWithUpcomingBilling = await prisma.user.findMany({
      where: {
        nextBillingDate: {
          gte: targetDate,
          lte: targetDateEnd
        },
        hasVerifiedEmail: true,
        subscription: {
          in: ['premium', 'pro'] // Only send reminders for paid subscriptions
        }
      },
      select: {
        uid: true,
        name: true,
        email: true,
        username: true,
        subscription: true,
        nextBillingDate: true
      }
    });
    
    console.log(`[BILLING REMINDER] Found ${usersWithUpcomingBilling.length} users with upcoming billing dates`);
    
    // Send reminder emails
    for (const user of usersWithUpcomingBilling) {
      try {
        await sendBillingReminderEmail(
          user.email,
          user.name || user.username,
          user.subscription,
          dayjs(user.nextBillingDate).format('MMMM DD, YYYY')
        );
        
        console.log(`[BILLING REMINDER] Sent reminder email to ${user.email} for ${user.subscription} subscription due ${dayjs(user.nextBillingDate).format('YYYY-MM-DD')}`);
      } catch (emailError) {
        console.error(`[BILLING REMINDER] Failed to send email to ${user.email}:`, emailError);
      }
    }
    
    console.log(`[BILLING REMINDER] Billing reminder job completed. Processed ${usersWithUpcomingBilling.length} users.`);
    
  } catch (error) {
    console.error('[BILLING REMINDER] Error in billing reminder job:', error);
    throw error;
  }
}

// Run the job if this script is executed directly
if (require.main === module) {
  checkBillingReminders()
    .then(() => {
      console.log('[BILLING REMINDER] Job completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[BILLING REMINDER] Job failed:', error);
      process.exit(1);
    });
}
