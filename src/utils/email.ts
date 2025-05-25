import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT!),
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

interface SendEmailOptions { 
    email: string;
    subject: string;
    html: string;
}

export const SendEmail = async(options: SendEmailOptions) => {
    const mailOptions ={
        from: `Expense Tracker <${process.env.EMAIL_USER}>`,
        to: options.email,
        subject: options.subject,
        html: options.html
    };

    await transporter.sendMail(mailOptions)
};
