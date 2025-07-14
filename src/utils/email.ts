

import dotenv from "dotenv";
dotenv.config();
import sgMail from "@sendgrid/mail";

interface SendEmailOptions {
  email: string;
  subject: string;
  html: string;
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export const SendEmail = async (options: SendEmailOptions) => {
  try {
    const msg = {
      to: options.email,
      from: `Expense Tracker <${process.env.EMAIL_FROM}>`,
      subject: options.subject,
      html: options.html,
    };

    const result = await sgMail.send(msg);
    console.log("Email sent successfully:", result[0].statusCode);
    return result;
  } catch (error) {
    console.error("Email sending failed:", error);
    throw error;
  }
};

export const sendVerificationEmail = async (email: string, token: string) => {
  try {
    
    // Generate the verification URL using the built-in URL module for safer URL construction
    // const clientUrl = process.env.CLIENT_URL || "http://localhost:5000";
    const clientUrl = process.env.DEPLOYED_FRONTEND || "https://expense-tracker-frontend-eight-lake.vercel.app";
    const verificationUrl = new URL("/api/auth/verify-email", clientUrl);
    verificationUrl.searchParams.append("token", token);

    const message = `
              <h1>Verify Your Email</h1>
              <p>Please click the link below to verify your email address:</p>
              <a href="${verificationUrl.toString()}" target="_blank">Verify Email</a>
              <p>If you did not create an account, please ignore this email.</p>
          `;

    // Send the email
    const mailInfo = await SendEmail({
      email,
      subject: "Email Verification",
      html: message,
    });

    console.log(`Verification email sent to ${email}. Message ID: ${mailInfo}`);
    return mailInfo;
  } catch (error) {
    console.error(`Failed to send verification email to ${email}:`, error);
    throw new Error(
      "Failed to send verification email. Please try again later."
    );
  }
};

export const sendPasswordResetEmail = async (email: string, token: string) => {
  try {
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5000";
    const resetUrl = new URL("/reset-password", clientUrl);
    resetUrl.searchParams.append("token", token);

    const message = `
                  <h1>Reset your Password</h1>
                  <p>Please click the link below to reset your password:</p>
                  <a href="${resetUrl.toString()}" target="_blank">Verify Email</a>
                  <p>If you did not create an account, please ignore this email.</p>
              `;

    // Send the email
    const mailInfo = await SendEmail({
      email,
      subject: "Reset Password",
      html: message,
    });

    console.log(`Verification email sent to ${email}. Message ID: ${mailInfo}`);
    return mailInfo;
  } catch (error) {
    console.error(`Failed to send verification email to ${email}:`, error);
    throw new Error(
      "Failed to send verification email. Please try again later."
    );
  }
};
