import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();
import { z } from "zod";
import { NextFunction, Request, Response } from "express";
import { User } from "../models/user.models";
import { SendEmail } from "../utils/email";
import speakeasy from "speakeasy";
import argon2 from "argon2";

const jwt_secret = (process.env.JWT_SECRET as string) || "";
const jwt_expiresIn = process.env.JWT_EXPIRES_IN;
const frontend_url = process.env.DEPLOYED_FRONTEND;
// const frontend_url = process.env.FRONTEND_URL;

// zod schemas for validation
const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const verifyEmailSchema = z.object({
  token: z.string(),
});

const enable2FASchema = z.object({
  token: z.string(),
  code: z.string().length(6),
});

// Helper function to sign token
const signToken = (id: string) => {
  return jwt.sign({ id }, jwt_secret, {
    expiresIn: jwt_expiresIn as jwt.SignOptions["expiresIn"],
  });
};

export const signup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = signupSchema.parse(req.body);

    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser.isEmailVerified) {
      res.status(400).json({
        success: false,
        message: "Email is already registered and verified",
      });
      return;
    }

    if (existingUser && !existingUser.isEmailVerified) {
      await User.findByIdAndDelete(existingUser._id);
      console.log("Deleted unverified user record for:", email);
    }

    if (!name || !email || !password) {
      res.status(403).json({
        success: "Failed",
        message: "Details not correct",
      });
      return;
    }

    const hashedPassword = await argon2.hash(password);

    const verificationToken = jwt.sign(
      {
        userData: {
          name,
          email,
          password: hashedPassword,
        },
      },
      jwt_secret,
      { expiresIn: "24h" }
    );

    console.log("Verification token generated for:", email);

    // Send verification email with correct URL
    const url = "https://expense-tracker-frontend-eight-lake.vercel.app";
    // const url = "http://localhost:5000"
    // const verificationUrl = `${url}/api/auth/verify-email?token=${verificationToken}`;
    const verificationUrl = `${url}/verify-email?token=${verificationToken}`;

    console.log("Sending email to:", email);
    console.log("Verification URL:", verificationUrl);

    try {
        await SendEmail({
            email: email,
            subject: "Welcome to ExpensePro - Please Verify Your Email",
            html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #ff6033 0%, #ff8866 100%); padding: 40px 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">ExpensePro</h1>
                        <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0 0; font-size: 16px;">Smart Expense Management</p>
                    </div>
                    
                    <!-- Main Content -->
                    <div style="padding: 40px 30px;">
                        <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">Welcome to ExpensePro, ${name}!</h2>
                        
                        <p style="color: #555555; line-height: 1.6; margin: 0 0 20px 0; font-size: 16px;">
                            Thank you for choosing ExpensePro to manage your expenses efficiently. We're excited to have you on board!
                        </p>
                        
                        <p style="color: #555555; line-height: 1.6; margin: 0 0 30px 0; font-size: 16px;">
                            To get started and secure your account, please verify your email address by clicking the button below:
                        </p>
                        
                        <!-- CTA Button -->
                        <div style="text-align: center; margin: 40px 0;">
                            <a href="${verificationUrl.toString()}" 
                               style="background-color: #ff6033; color: white; padding: 16px 32px; 
                                      text-decoration: none; border-radius: 8px; display: inline-block; 
                                      font-size: 16px; font-weight: 600; letter-spacing: 0.5px;
                                      box-shadow: 0 4px 12px rgba(255, 96, 51, 0.3);
                                      transition: all 0.3s ease;">
                                ✓ Verify Email Address
                            </a>
                        </div>
                        
                        <p style="color: #666666; line-height: 1.6; margin: 30px 0 10px 0; font-size: 14px;">
                            Having trouble with the button? Copy and paste this link into your browser:
                        </p>
                        <p style="word-break: break-all; color: #ff6033; background-color: #f8f9fa; padding: 12px; border-radius: 6px; font-size: 14px; font-family: 'Courier New', monospace;">
                            ${verificationUrl}
                        </p>
                        
                        <!-- Important Notice -->
                        <div style="background-color: #fff3f0; border-left: 4px solid #ff6033; padding: 16px; margin: 30px 0; border-radius: 0 6px 6px 0;">
                            <p style="color: #333333; margin: 0; font-size: 14px;">
                                <strong>⏰ Important:</strong> This verification link will expire in 24 hours for security reasons. Please verify your email as soon as possible.
                            </p>
                        </div>
                        
                        <p style="color: #555555; line-height: 1.6; margin: 30px 0 0 0; font-size: 16px;">
                            Once verified, you'll be able to:
                        </p>
                        <ul style="color: #555555; line-height: 1.6; margin: 10px 0 0 20px; font-size: 16px;">
                            <li>Track and categorize your expenses effortlessly</li>
                            <li>Generate detailed financial reports</li>
                            <li>Set budgets and receive smart alerts</li>
                            <li>Access your data across all devices</li>
                        </ul>
                    </div>
                    
                    <!-- Footer -->
                    <div style="background-color: #f8f9fa; padding: 30px; text-align: center; border-radius: 0 0 10px 10px; border-top: 1px solid #e9ecef;">
                        <p style="color: #666666; margin: 0 0 15px 0; font-size: 14px;">
                            Questions? We're here to help! Contact our support team at 
                            <a href="mailto:support@expensepro.com" style="color: #ff6033; text-decoration: none;">support@expensepro.com</a>
                        </p>
                        <p style="color: #999999; margin: 0; font-size: 12px;">
                            © 2025 ExpensePro. All rights reserved.<br>
                            You're receiving this email because you signed up for an ExpensePro account.
                        </p>
                    </div>
                </div>
            `,
        });

      console.log("Email sent successfully");
    } catch (emailError) {
      console.log("Email sending failed:", emailError);
      res.status(500).json({
        status: "failed",
        message: "Failed to send verification email. Please try again.",
        emailError,
      });
      return;
    }

    res.status(201).json({
      status: "success",
      message:
        "Verification email sent! Please check your email inbox or spam to complete registration.",
      data: {
        email: email,
        message: "User will be created after email verification",
      },
    });
  } catch (error) {
    console.log("Signup error:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({
        status: "failed",
        message: "Validation failed",
        errors: error.errors,
      });
      return;
    }
    res.status(500).json({
      status: "failed",
      message: "Something went wrong during signup",
    });
  }
};

// VERIFY EMAIL - Modified to create user upon verification
export const verifyEmail = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { token } = verifyEmailSchema.parse(req.query);

    console.log("Verifying token:", token);

    let decoded;
    try {
      decoded = jwt.verify(token, jwt_secret) as {
        userData: { name: string; email: string; password: string };
      };
    } catch (jwtError) {
      console.error("JWT verification failed:", jwtError);
      res.status(400).json({
        status: "failed",
        message: "Invalid or expired verification token",
      });
      return;
    }

    if (!decoded || !decoded.userData) {
      res.status(400).json({
        status: "failed",
        message: "Invalid token format",
      });
      return;
    }

    const { name, email, password } = decoded.userData;

    // Check if user already exists and is verified
    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser.isEmailVerified) {
      res.redirect(
        `${frontend_url}/verification-success?status=already-verified`
      );
      return;
    }

    if (existingUser && !existingUser.isEmailVerified) {
      await User.findByIdAndDelete(existingUser._id);
    }

    const newUser = await User.create({
      name,
      email,
      password,
      isEmailVerified: true,
    });

    console.log("User created and verified successfully:", newUser.email);

    res.redirect(`${frontend_url}/verification-success?status=verified`);
  } catch (error) {
    console.error("Email verification error:", error);

    if (error instanceof z.ZodError) {
      res.redirect(
        `${frontend_url}/verification-error?message=Invalid token format`
      );
      return;
    }

    res.redirect(
      `${frontend_url}/verification-error?message=Email verification failed`
    );
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({
        status: "failed",
        message: "Invalid email or password",
      });
      return;
    }

    if (!user.isEmailVerified) {
      res.status(401).json({
        status: "failed",
        message: "Please verify your email to login",
      });
      return;
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      const tempToken = jwt.sign({ id: user._id }, jwt_secret, {
        expiresIn: "5m",
      });
      res.status(200).json({
        message: "2FA required",
        tempToken,
        twoFactorEnabled: true,
      });
      return;
    }

    // Sign token
    const token = signToken(user._id.toString());
    res.cookie("jwt", token, {
      expires: new Date(
        Date.now() +
          parseInt(process.env.COOKIE_EXPIRES_IN!) * 24 * 60 * 60 * 1000
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
      },
    });
  } catch (error: any) {
    console.log(error);
    if (error instanceof z.ZodError) {
      res.status(400).json({
        message: "Validation failed",
        errors: error.errors,
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: "Unable to login",
      error: error.message,
    });
  }
};

// SETUP 2 FACTOR AUTH;
export const setup2FA = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (user.twoFactorEnabled) {
      res.status(400).json({ message: "2FA already enabled" });
      return;
    }

    const secret = speakeasy.generateSecret({
      name: `ExpenseTracker:${user.email}`,
    });

    user.twoFactorSecret = secret.base32;
    await user.save();

    res.status(200).json({
      secret: secret.base32,
      otpauthURL: secret.otpauth_url,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// Verify 2 Factor Authentication
export const verify2FA = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tempToken, code } = req.body;
    const decoded = jwt.verify(tempToken, jwt_secret) as { id: string };
    const user = await User.findById(decoded.id).select("+twoFactorSecret");

    if (!user || !user.twoFactorSecret) {
      res.status(400).json({
        status: "failed",
        message: "Invalid token",
      });
      return;
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: code,
      window: 1,
    });

    if (!verified) {
      res.status(401).json({ message: "Invalid 2fA code" });
      return;
    }

    const token = signToken(user._id.toString());

    res.cookie("jwt", token, {
      expires: new Date(
        Date.now() +
          parseInt(process.env.COOKIE_EXPIRES_IN!) * 24 * 60 * 60 * 1000
      ),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
    res.status(200).json({
      status: "success",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.log(error);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

// CONFIRM 2 FACTOR AUTH;
export const confirm2FA = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { code } = enable2FASchema.parse(req.body);
    const userId = req.user.id;
    const user = await User.findById(userId).select("+twoFactorSecret");

    if (!user || !user.twoFactorSecret) {
      res.status(404).json({
        messaage: "User not found or 2FA not setup",
      });
      return;
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: code,
      window: 1,
    });

    if (!verified) {
      res.status(401).json({ message: "invalid 2FA code" });
      return;
    }

    user.twoFactorEnabled = true;
    await user.save();

    res.status(200).json({
      message: "2FA Enabled successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        message: "Validation failed",
        errors: error.errors,
      });
      return;
    }
    res.status(500).json({ message: "Something went wrong" });
  }
};

// DISABLE 2 FACTOR AUTH
export const disable2FA = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({
        message: "User not found",
      });
      return;
    }
    if (!user.twoFactorEnabled) {
      res.status(400).json({ message: "2FA not enabled" });
      return;
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    await user.save();

    res.status(200).json({ message: "2FA disabled successfully" });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong", error });
  }
};

// LOGOUT
export const logout = (req: Request, res: Response) => {
  try {
    res.cookie("jwt", "", {
      // expires: new Date(Date.now() + 10 * 1000),
      expires: new Date(0),
      httpOnly: true,
    });
    res.status(200).json({
      status: "success",
      message: "Logged out successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error Logging out", error });
  }
};

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      res.status(401).json({
        message: "You are not logged in!, Please log in to get access",
      });
      return;
    }

    const decoded = jwt.verify(token, jwt_secret) as { id: string };
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      res.status(401).json({
        message: "User does no longer exist",
      });
      return;
    }

    req.user = currentUser;
    next();
  } catch (error) {
    console.log(error);
    res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};

// RESTRICTED TO
export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: Function) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "You do not have permission to perform this action",
      });
    }
    next();
  };
};
