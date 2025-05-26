import express from 'express';
import { confirm2FA, disable2FA, login, logout, protect, setup2FA, signup, verify2FA, verifyEmail } from '../controllers/auth.controllers';


const router = express.Router();

router.post('/signup', signup);
router.get('/verify-email', verifyEmail);
router.post('/login', login);
router.get('/logout', logout);

//2FA routes
router.post('/setup-2fa', protect, setup2FA);
router.post('/confirm-2fa', protect, confirm2FA);
router.post('/disable-2fa', protect, disable2FA);
router.post('/verify-2fa', verify2FA);


export default router;