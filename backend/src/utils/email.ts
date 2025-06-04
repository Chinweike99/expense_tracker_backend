// import nodemailer from 'nodemailer';
// import dotenv from 'dotenv'
// dotenv.config();

// const transporter = nodemailer.createTransport({
//     host: process.env.EMAIL_HOST,
//     port: parseInt(process.env.EMAIL_PORT!),
//     // secure: false,
//     auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS
//     }
// });

// interface SendEmailOptions { 
//     email: string;
//     subject: string;
//     html: string;
// }

// export const SendEmail = async(options: SendEmailOptions) => {
//     const mailOptions ={
//         from: `Expense Tracker <${process.env.EMAIL_USER}>`,
//         to: options.email,
//         subject: options.subject,
//         html: options.html
//     };

//     await transporter.sendMail(mailOptions)
// };


import dotenv from 'dotenv'
import nodemailer from 'nodemailer';
import dns from 'dns';
dotenv.config();

dns.setDefaultResultOrder('ipv4first');

// console.log('EMAIL_USER:', process.env.EMAIL_USER);
// console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '***HIDDEN***' : 'MISSING');
// console.log('EMAIL_HOST:', process.env.EMAIL_HOST);
// console.log('EMAIL_PORT:', process.env.EMAIL_PORT);

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('Missing EMAIL_USER or EMAIL_PASS environment variables');
}

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT!) || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false,
    },
    // authMethod: 'PLAIN', // Explicitly set auth method
    // connectionTimeout: 60000,
    // greetingTimeout: 30000,
    // socketTimeout: 60000,
} as any);

interface SendEmailOptions { 
    email: string;
    subject: string;
    html: string;
}

export const SendEmail = async(options: SendEmailOptions) => {
    try {
        console.log('Attempting to verify SMTP connection...');
        await transporter.verify();
        console.log('SMTP connection verified successfully');
        
        const mailOptions = {
            from: `Expense Tracker <${process.env.EMAIL_USER}>`,
            to: options.email,
            subject: options.subject,
            html: options.html
        };
        
        console.log('Sending email to:', options.email);
        const result = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', result.messageId);
        return result;
    } catch (error) {
        console.error('Email sending failed:', error);
        throw error;
    }
};







export const sendVerificationEmail = async (email: string, token: string) => {
    try {
      // Generate the verification URL using the built-in URL module for safer URL construction
      const clientUrl = process.env.CLIENT_URL || "http://localhost:5000";
      const verificationUrl = new URL("/verify-email", clientUrl);
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
  
      console.log(
        `Verification email sent to ${email}. Message ID: ${mailInfo.messageId}`
      );
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
      // Generate the verification URL using the built-in URL module for safer URL construction
      const clientUrl = process.env.CLIENT_URL || "http://localhost:5000";
      const resetUrl = new URL("/reset-password", clientUrl);
      resetUrl.searchParams.append("token", token);
  
      // Construct the HTML message
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
  
      console.log(
        `Verification email sent to ${email}. Message ID: ${mailInfo.messageId}`
      );
      return mailInfo;
    } catch (error) {
      console.error(`Failed to send verification email to ${email}:`, error);
      throw new Error(
        "Failed to send verification email. Please try again later."
      );
    }
  };