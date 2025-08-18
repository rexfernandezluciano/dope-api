
/** @format */

import nodemailer from "nodemailer";

// Brevo SMTP configuration
const transporter = nodemailer.createTransport({
	host: "smtp-relay.brevo.com",
	port: 587,
	secure: false,
	auth: {
		user: process.env.BREVO_EMAIL_ADDRESS,
		pass: process.env.BREVO_EMAIL_PASSWORD,
	},
});

export async function sendVerificationEmail(to: string, code: string, verificationId: string) {
	try {
		const mailOptions = {
			from: '"DOPE Network" <noreply@dopp.eu.org>',
			to: to,
			subject: "Verify Your Email Address - DOPE Network",
			html: `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
					<h2 style="color: #333; text-align: center;">Welcome to DOPE Network!</h2>
					<p style="color: #666; font-size: 16px;">
						Thank you for registering with DOPE Network. Please verify your email address to complete your registration.
					</p>
					<div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
						<p style="color: #333; font-size: 18px; margin-bottom: 10px;">Your verification code is:</p>
						<h1 style="color: #007bff; font-size: 32px; letter-spacing: 4px; margin: 0;">${code}</h1>
					</div>
					<p style="color: #666; font-size: 14px;">
						This code will expire in 15 minutes. If you didn't request this verification, please ignore this email.
					</p>
					<p style="color: #666; font-size: 14px;">
						Verification ID: <code>${verificationId}</code>
					</p>
					<hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
					<p style="color: #999; font-size: 12px; text-align: center;">
						© 2025 DOPE Network. All rights reserved.
					</p>
				</div>
			`,
			text: `
				Welcome to DOPE Network!
				
				Thank you for registering with DOPE Network. Please verify your email address to complete your registration.
				
				Your verification code is: ${code}
				
				This code will expire in 15 minutes. If you didn't request this verification, please ignore this email.
				
				Verification ID: ${verificationId}
			`,
		};

		const info = await transporter.sendMail(mailOptions);
		console.log(`[MAILER] Email sent successfully to ${to}. Message ID: ${info.messageId}`);
		return info;
	} catch (error) {
		console.error(`[MAILER] Failed to send email to ${to}:`, error);
		throw error;
	}
}
