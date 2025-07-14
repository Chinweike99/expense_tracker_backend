jest.mock("dotenv", () => ({
  config: jest.fn(),
}));

// process.env.JWT_SECRET = 'tracker_jwt_secret_expense';
process.env.JWT_SECRET = "test_secret";
process.env.JWT_EXPIRES_IN = "1d";
process.env.FRONTEND_URL = "http://localhost:3000";
process.env.COOKIE_EXPIRES_IN = "7";

import jwt from "jsonwebtoken";
import { User } from "../models/user.models";
import { SendEmail } from "../utils/email";
import { Response } from "express";
import { signup } from "../controllers/auth.controllers";
import argon2 from "argon2";

// Mock dependencies
jest.mock("jsonwebtoken");
jest.mock("../models/user.models");
jest.mock("../utils/email");
jest.mock("speakeasy");
jest.mock("argon2");

const mockRequest = (
  body?: any,
  query?: any,
  cookies?: any,
  headers?: any
) => ({
  body,
  query,
  cookies,
  headers,
  user: null,
});

const mockResponse = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  return res as Response;
};

// SIGNUP TEST
describe("signup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should successfully create a new and send verification email", async () => {
    const request = mockRequest({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    });

    const res = mockResponse();

    // Mock User.findOne to return null (user doesn't exist)
    (User.findOne as jest.Mock).mockResolvedValue(null);

    // Mock argon2 hash
    (argon2.hash as jest.Mock).mockResolvedValue("hashedPassword123");

    // Mock JWT sign for verification token
    (jwt.sign as jest.Mock).mockReturnValue("mock-verification-token");

    // Mock SendEmail to succeed
    (SendEmail as jest.Mock).mockResolvedValue(true);

    await signup(request as any, res);

    expect(User.findOne).toHaveBeenCalledWith({ email: "test@example.com" });
    expect(argon2.hash).toHaveBeenCalledWith("password123");
    expect(jwt.sign).toHaveBeenCalledWith(
      {
        userData: {
          name: "Test User",
          email: "test@example.com",
          password: "hashedPassword123",
        },
      },
      "test_secret",
      { expiresIn: "24h" }
    );
    expect(SendEmail).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      status: "success",
      message:
        "Verification email sent! Please check your email inbox or spam to complete registration.",
      data: {
        email: "test@example.com",
        message: "User will be created after email verification",
      },
    });
  });

  it("should return 400 if email is already registered and verified", async () => {
    const req = mockRequest({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    });
    const res = mockResponse();

    // Mock existing verified user
    (User.findOne as jest.Mock).mockResolvedValue({
      _id: "456",
      email: "test@example.com",
      isEmailVerified: true,
    });

    await signup(req as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Email is already registered and verified",
    });
  });

  it("should delete unverified user and send new verification email", async () => {
    const req = mockRequest({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    });
    const res = mockResponse();

    // Mock existing unverified user
    const existingUser = {
      _id: "456",
      email: "test@example.com",
      isEmailVerified: false,
    };
    (User.findOne as jest.Mock).mockResolvedValue(existingUser);
    (User.findByIdAndDelete as jest.Mock).mockResolvedValue(true);

    (argon2.hash as jest.Mock).mockResolvedValue("hashedPassword123");
    (jwt.sign as jest.Mock).mockReturnValue("mock-verification-token");

    // Mock SendEmail to succeed
    (SendEmail as jest.Mock).mockResolvedValue(true);

    await signup(req as any, res);

    expect(User.findByIdAndDelete).toHaveBeenCalledWith("456");
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      status: "success",
      message:
        "Verification email sent! Please check your email inbox or spam to complete registration.",
      data: {
        email: "test@example.com",
        message: "User will be created after email verification",
      },
    });
  });

  it("should handle email sending failure", async () => {
    const req = mockRequest({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    });
    const res = mockResponse();

    (User.findOne as jest.Mock).mockResolvedValue(null);
    (argon2.hash as jest.Mock).mockResolvedValue("hashedPassword123");
    (jwt.sign as jest.Mock).mockReturnValue("mock-token");

    // Mock email failure
    const emailError = new Error("Email failed");
    (SendEmail as jest.Mock).mockRejectedValue(emailError);

    await signup(req as any, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      status: "failed",
      message: "Failed to send verification email. Please try again.",
      emailError,
    });
  });

  it("should return 400 for validation errors", async () => {
    const req = mockRequest({
      name: "",
      email: "invalid-email",
      password: "short",
    });
    const res = mockResponse();

    await signup(req as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      status: "failed",
      message: "Validation failed",
      errors: expect.any(Array),
    });
  });
});
