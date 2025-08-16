/** @format */

// Placeholder: integrate real email (Resend, SendGrid, SES, Mailgun) later.
export async function sendVerificationEmail(to: string, code: string, verificationId: string) {
	// eslint-disable-next-line no-console
	console.log(`[MAILER] Send to=${to} code=${code} verificationId=${verificationId}`);
	// implement your provider here. Keep signature identical so controllers don’t change.
}
