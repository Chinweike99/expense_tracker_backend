import jwt from 'jsonwebtoken';
import dotenv from 'dotenv'
dotenv.config();
import {z, ZodError} from 'zod'
import { Request, Response } from 'express';
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
export const signup = async(req: Request, res: Response) => {
    try {
        const {name, email, password} = signupSchema.parse(req.body);
        const userExists = await User.findOne({email});
        if(userExists){
            return res.status(400).json({
                success: false,
                message: "Email is already registered"
            })
        };

        const newUser = await User.create({name, email, password});

        // Generate verification token
        const verificationToken = jwt.sign(
            {id: newUser._id}, jwt_secret + newUser.password, {expiresIn: '1d'}
        );

        // Send verification email
        const verificationUrl = `${frontend_url}/verify-email?token=${verificationToken}`;

        await SendEmail({
            email: newUser.email,
            subject: "Verify Your Email",
            html: `Please click <a href="${verificationUrl}"> here</a> to verify your email`
        })

        res.status(201).json({
            status: "sucess",
            message: "Verification email sent"
        })

    } catch (error) {
        if(error instanceof z.ZodError){
            return res.status(400).json({
                status: "failed",
                message: error.errors
            });
        }
        res.status(500).json({message: "Something went wrong"})
    }
};



// VERIFY EMAIL
export const verifyEmail = async(req: Request, res: Response) => {
    try {
        const {token} = verifyEmailSchema.parse(req.query);

        //Decode token
        const decodeToken = jwt.decode(token) as {id: string} || null;
        if(!decodeToken || !decodeToken.id){
            return res.status(400).json({
                message: "Inavlid token"
            })
        }

        const user = await User.findById(decodeToken.id);
        if(!user){
            return res.status(400).json({
                message: "User with token not found"
            })
        }
        
        // verify token
        jwt.verify(token, jwt_secret + user.password) ;

        if(user.isEmailVerified){
            return res.status(400).json({
                message: "Email is already verified"
            })
        };

        user.isEmailVerified = true;
        await user.save();

        res.status(200).json({
            status: "success",
            message: "Email verified successfully"
        })

    } catch (error) {
        res.status(400).json({
            status: "Failed",
            message:"Token is invalid, or token is expired"
        })
    }
}


export const login = async(req: Request, res: Response) => {
    try {
        const {email, password} = loginSchema.parse(req.body);
        const user = await User.findOne({email}).select('+password');
        if(!user || !(await user.comparePassword(password))){
            return res.status(401).json({
                status: "failed",
                message: "Invalid email or password"
            })
        }

        if(!user.isEmailVerified){
            return res.status(401).json({message: 'Please verify your email to login'})
        }

        // Check if 2FA is enabled
        if(user.twoFactorEnabled){
            const tempToken = jwt.sign({id: user._id}, jwt_secret, {expiresIn: '5m'});
            return res.status(200).json({
                message: '2FA required',
                tempToken,
                twoFactorEnabled: true
            })
        };

        // Sign token
        const token = signToken(user._id.toString());

        // Set Cookie
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
            return res.status(400).json({
                message: 'Validation failed',
                errors: error.errors,
              });
        };
        res.status(500).json({message: "Something went wrong"});
    }
}


// Verify 2 Factor Authentication
export const verify2FA = async(req: Request, res: Response) => {
    try {
        const {tempToken, code} =  req.body;
        const decoded = jwt.verify(tempToken, jwt_secret) as {id: string};
        const user = await User.findById(decoded.id).select('+twoFactorSecret');

        if(!user || !user.twoFactorSecret){
            return res.status(400).json({
                status: "failed",
                message: "Invalid token",
            });
        }

        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: code,
            window: 1,
        });

        if(!verified){
            return res.status(401).json({message: "Invalid 2fA code"})
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
        
    }
}




