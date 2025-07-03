import jwt from 'jsonwebtoken';
import dotenv from 'dotenv'
dotenv.config();
import {z} from 'zod'
import { NextFunction, Request, Response } from 'express';
import { User } from '../models/user.models';
import { SendEmail } from '../utils/email';
import speakeasy from 'speakeasy'

const jwt_secret = process.env.JWT_SECRET as string || "";
const jwt_expiresIn = process.env.JWT_EXPIRES_IN;
const frontend_url = process.env.FRONTEND_URL;

// zod schemas for validation
const signupSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8)
});

const verifyEmailSchema = z.object({
    token: z.string(),
});

const enable2FASchema = z.object({
    token: z.string(),
    code: z.string().length(6)
});

// Helper function to sign token
const signToken = (id: string) => {
    return jwt.sign({id}, jwt_secret, {
        expiresIn: jwt_expiresIn as jwt.SignOptions["expiresIn"]
    })
}

// SIGN UP 
export const signup = async(req: Request, res: Response):Promise<void> => {
    try {
        const {name, email, password} = signupSchema.parse(req.body);
        const userExists = await User.findOne({email});
        if(userExists){
            res.status(400).json({
                success: false,
                message: "Email is already registered"
            })
            return
        };

        if(!name || !email || !password){
            res.status(403).json({
                success: "Failed",
                message: "Details not correct"
            })
        }

        // Create user but don't save to main collection yet (or mark as unverified)
        const newUser = await User.create({
            name, 
            email, 
            password,
            isEmailVerified: false
        });

        console.log('User created:', newUser._id);

        // Generate verification token using user ID and a secret
        const verificationToken = jwt.sign(
            {userId: newUser._id.toString()}, 
            jwt_secret, 
            {expiresIn: '24h'}
        );

        console.log('Verification token generated');

        // Send verification email
        // const verificationUrl = `${frontend_url}/verify-email?token=${verificationToken}`;
        const url = "http://localhost:5000/api/auth"
        const verificationUrl = `${url}/verify-email?token=${verificationToken}`;
        
        console.log('Sending email to:', newUser.email);
        console.log('Verification URL:', verificationUrl); // Debug log

        try {
            await SendEmail({
                email: newUser.email,
                subject: "Verify Your Email - Action Required",
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2>Welcome ${name}!</h2>
                        <p>Thank you for signing up. Please verify your email address to complete your registration.</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${verificationUrl.toString()}" 
                               style="background-color: #007bff; color: white; padding: 12px 24px; 
                                      text-decoration: none; border-radius: 5px; display: inline-block;">
                                Verify Email Address
                            </a>
                        </div>
                        <p>Or copy and paste this link in your browser:</p>
                        <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
                        <p><small>This link will expire in 24 hours.</small></p>
                    </div>
                `
            });
            
            console.log('Email sent successfully'); // Debug log
            
        } catch (emailError) {
            console.log('Email sending failed:', emailError);
            // Delete the user if email fails
            await User.findByIdAndDelete(newUser._id);
            res.status(500).json({
                status: "failed",
                message: "Failed to send verification email. Please try again.",
                emailError
            });
            return;
        }

        res.status(201).json({
            status: "success",
            message: "Account created! Please check your email inbox or spam for verification link.",
            data: {
                userId: newUser._id,
                email: newUser.email
            }
        });

    } catch (error) {
        console.log('Signup error:', error); // Debug log
        
        if(error instanceof z.ZodError){
            res.status(400).json({
                status: "failed",
                message: "Validation failed",
                errors: error.errors
            });
            return
        }
        res.status(500).json({
            status: "failed",
            message: "Something went wrong during signup"
        })
    }
};

// VERIFY EMAIL - Improved version
export const verifyEmail = async(req: Request, res: Response): Promise<void> => {
    try {
        const {token} = verifyEmailSchema.parse(req.query);

        console.log('Verifying token:', token);

        // Verify and decode token
        let decoded;
        try {
            decoded = jwt.verify(token, jwt_secret) as {userId: string};
        } catch (jwtError) {
            console.error('JWT verification failed:', jwtError);
            res.status(400).json({
                status: "failed",
                message: "Invalid or expired verification token"
            });
            return;
        }

        if(!decoded || !decoded.userId){
            res.status(400).json({
                status: "failed",
                message: "Invalid token format"
            });
            return
        }

        const user = await User.findById(decoded.userId);
        console.log('User before verification:', user);
        if(!user){
            res.status(400).json({
                status: "failed",
                message: "User not found"
            })
            return
        }

        if(user.isEmailVerified){
            
            res.redirect(`${frontend_url}/verification-success?status=already-verified`);
            return;
        };

        // Update user verification status
        user.isEmailVerified = true;
        await user.save();

        console.log('User verified successfully:', user.email);
        // Redirect to frontend success page
        // res.redirect(`${frontend_url}/verification-success?status=verified`); // Use when frontend is added

        res.json({
            status: "Success",
            message: "Email verified, you can now log in"
        });

    } catch (error) {
        console.error('Email verification error:', error);
        res.status(400).json({
            status: "failed",
            message: "Email verification failed"
        })
    }
}




export const login = async(req: Request, res: Response): Promise<void> => {
    try {
        const {email, password} = loginSchema.parse(req.body);
        const user = await User.findOne({email}).select('+password');
        if(!user || !(await user.comparePassword(password))){
            res.status(401).json({
                status: "failed",
                message: "Invalid email or password"
            });
            return 
        }

        if(!user.isEmailVerified){
             res.status(401).json({
                status: "failed",
                message: 'Please verify your email to login'
            });
             return
        }

        // Check if 2FA is enabled
        if(user.twoFactorEnabled){
            const tempToken = jwt.sign({id: user._id}, jwt_secret, {expiresIn: '5m'});
            res.status(200).json({
                message: '2FA required',
                tempToken,
                twoFactorEnabled: true
            });
            return 
        };

        // Sign token
        const token = signToken(user._id.toString());
        res.cookie('jwt', token, {
            expires: new Date(
                Date.now() + parseInt(process.env.COOKIE_EXPIRES_IN!) * 24 * 60 * 60 * 1000
            ),
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
        });

        res.status(200).json({
            status: "success",
            message: "Login successfull",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            }
        })

    } catch (error) {
        if(error instanceof z.ZodError){
             res.status(400).json({
                message: 'Validation failed',
                errors: error.errors,
              });
              return
        };
        res.status(500).json({
            success: false,
            message: "Unable to login",
        });
    }
}


// SETUP 2 FACTOR AUTH;
export const setup2FA = async(req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);
        if(!user){
            res.status(404).json({message: "User not found"});
            return 
        };

        if(user.twoFactorEnabled){
            res.status(400).json({message: '2FA already enabled'});
            return;
        };

        const secret = speakeasy.generateSecret({
            name: `ExpenseTracker:${user.email}`
        });

        user.twoFactorSecret = secret.base32;
        await user.save();

        res.status(200).json({
            secret: secret.base32,
            otpauthURL: secret.otpauth_url,
        })

    } catch (error) {
        console.log(error)
        res.status(500).json({ message: 'Something went wrong' });
    }
}

// Verify 2 Factor Authentication
export const verify2FA = async(req: Request, res: Response): Promise<void> => {
    try {
        const {tempToken, code} =  req.body;
        const decoded = jwt.verify(tempToken, jwt_secret) as {id: string};
        const user = await User.findById(decoded.id).select('+twoFactorSecret');

        if(!user || !user.twoFactorSecret){
             res.status(400).json({
                status: "failed",
                message: "Invalid token",
            });
            return
        }

        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: code,
            window: 1,
        });

        if(!verified){
            res.status(401).json({message: "Invalid 2fA code"});
            return
        }

        const token = signToken(user._id.toString());

        res.cookie('jwt', token,{
            expires: new Date(
                Date.now() + parseInt(process.env.COOKIE_EXPIRES_IN!) * 24 * 60 * 60 * 1000
            ),
            httpOnly: true,
            secure: process.env.NODE_ENV=== 'production',
        });
        res.status(200).json({
            status: 'success',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            },
        });

    } catch (error) {
        console.log(error)
        res.status(401).json({ message: 'Invalid or expired token' });
    }
}

// CONFIRM 2 FACTOR AUTH;
export const confirm2FA = async(req: Request, res: Response): Promise<void> => {
    try {
        const { code } = enable2FASchema.parse(req.body);
        const userId = req.user.id
        const user = await User.findById(userId).select('+twoFactorSecret');

        if(!user || !user.twoFactorSecret){
            res.status(404).json({
                messaage: "User not found or 2FA not setup"
            });
            return 
        };

        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: code,
            window: 1
        });

        if(!verified){
            res.status(401).json({message: "invalid 2FA code"});
            return 
        }

        user.twoFactorEnabled = true;
        await user.save();

        res.status(200).json({
            message: "2FA Enabled successfully"
        })
        
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
              message: 'Validation failed',
              errors: error.errors,
            });
            return 
          }
          res.status(500).json({ message: 'Something went wrong' });
    }
};


// DISABLE 2 FACTOR AUTH
export const disable2FA = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);

        if(!user){
             res.status(404).json({
                message: "User not found"
            });
            return
        };
        if(!user.twoFactorEnabled){
           res.status(400).json({message: '2FA not enabled'});
           return
        };

        user.twoFactorEnabled = false;
        user.twoFactorSecret = undefined;
        await user.save()

        res.status(200).json({ message: '2FA disabled successfully' });

    } catch (error) {
        res.status(500).json({ message: 'Something went wrong', error });
    }
}


// LOGOUT
export const logout = (req: Request, res: Response) => {
   try {
    res.cookie('jwt', '', {
        // expires: new Date(Date.now() + 10 * 1000),
        expires: new Date(0),
        httpOnly: true
    });
    res.status(200).json({
        status: "success",
        message: "Logged out successfully"
    })
   } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Error Logging out', error });
   }
};


export const protect = async(req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        let token;
        if(req.headers.authorization && req.headers.authorization.startsWith("Bearer")){
            token = req.headers.authorization.split(' ')[1];
        }else if(req.cookies.jwt){
            token = req.cookies.jwt;
        };

        if(!token){
            res.status(401).json({
                message: 'You are not logged in!, Please log in to get access',
            });
            return
        };

        const decoded = jwt.verify(token, jwt_secret) as {id: string};
        const currentUser = await User.findById(decoded.id)
        if(!currentUser){
            res.status(401).json({
                message: 'User does no longer exist'
            });
            return 
        }

        req.user = currentUser;
        next();

    } catch (error) {
        console.log(error)
        res.status(401).json({
            success: false,
            message: 'Invalid token' });
    }
    
}


// RESTRICTED TO
export const restrictTo = (...roles: string[]) => {
    return (req: Request, res: Response, next: Function)=> {
        if(!roles.includes(req.user.role)){
            return res.status(403).json({
                message: "You do not have permission to perform this action"
            })
        }
        next();
    }
}


