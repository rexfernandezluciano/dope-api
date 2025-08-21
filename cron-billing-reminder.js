
/** @format */

// Standalone script for scheduled deployment
require('ts-node/register');
require('./src/cron/billing-reminder.ts').checkBillingReminders();
