import express, { Request, Response } from "express";

import {
  confirm2FA,
  disable2FA,
  login,
  logout,
  protect,
  setup2FA,
  signup,
  verify2FA,
  verifyEmail,
} from "../controllers/auth.controllers";
import { SendEmail } from "../utils/email";

const router = express.Router();

router.post("/signup", signup);
router.get("/verify-email", verifyEmail);
router.post("/login", login);
router.get("/logout", logout);

//2FA routes
router.post("/setup-2fa", protect, setup2FA);
router.post("/confirm-2fa", protect, confirm2FA);
router.post("/disable-2fa", protect, disable2FA);
router.post("/verify-2fa", verify2FA);

router.post('/send-mail', async (req: Request, res: Response) => {
    try {
        const { email, subject, html } = req.body;
        
        await SendEmail({
            email: email || 'willsdan000@gmail.com',
            subject: subject || 'Expense Recorded!',
            html: html || '<p>Your recent expense has been recorded in your tracker., Go check it out</p>'
        });

        res.status(200).json({ 
            success: true,
            message: 'Email sent successfully' 
        });
    } catch (error: any) {
        console.error('Email route error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to send email',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});
export default router;
