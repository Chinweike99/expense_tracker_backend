import jwt from 'jsonwebtoken';
import dotenv from 'dotenv'
dotenv.config();
import {z} from 'zod'
import { Request, Response } from 'express';
import { User } from '../models/user.models';
import { SendEmail } from '../utils/email';

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
        const verificationUrl = jwt.sign(
            {id: newUser._id}, jwt_secret + newUser.password, {expiresIn: '1d'}
        );

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
            })
        }
    }
}


