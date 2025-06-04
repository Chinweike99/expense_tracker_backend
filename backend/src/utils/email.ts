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
    port: parseInt(process.env.EMAIL_PORT!) || 465,
    secure: true,
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