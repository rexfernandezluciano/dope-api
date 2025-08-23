
/** @format */

// Standalone script for scheduled deployment
import('ts-node/register.d.ts');
import('./src/cron/billing-reminder.ts').checkBillingReminders();
