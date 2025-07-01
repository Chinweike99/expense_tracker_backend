import  jwt  from "jsonwebtoken";
import { User } from "../models/user.models";
import { SendEmail } from "../utils/email";
import {  Response } from "express";
import { signup } from "../controllers/auth.controllers";




// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../models/user.models');
jest.mock('../utils/email');
jest.mock('speakeasy');

// Mock environment variables
process.env.JWT_SECRET = 'test_secret';
process.env.JWT_EXPIRES_IN = '1d';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.COOKIE_EXPIRES_IN = '7';


// Helper functions for creating mock requests/responses
const mockRequest = (body?: any, query?: any, cookies?: any, headers?: any) =>  ({
    body, query, cookies, headers, user: null
})


const mockResponse = () => {
    const res: Partial<Response> = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    return res as Response;
}

// SIGNUP TEST
describe('signup', () =>{
    beforeEach(() => {
        jest.clearAllMocks();
    });

    
it('should successfully create a new and send verification email', async() => {
    const request = mockRequest({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
    });

    const res = mockResponse();

    // Mock User.findOne to return null (user doesn't exist);
    (User.findOne as jest.Mock).mockResolvedValue(null);
    const mockUser = {
        _id: '123',
        name: 'Test User',
        email: 'test@example.com',
        isEmailVerifed: false,
        save: jest.fn()
    };
    (User.create as jest.Mock).mockReturnValue(mockUser);

    (jwt.sign as jest.Mock).mockReturnValue('mock-verification-token');

    // Mock SendEmail
    (SendEmail as jest.Mock).mockReturnValue(true);

    await signup(request as any, res);
    expect(User.findOne).toHaveBeenCalledWith({email: "test@example.com"});
    expect(User.create).toHaveBeenCalledWith({
        name: "Test User",
        email: 'test@example.com',
        password: 'password123',
        isEmailVerified: false
    });
    expect(jwt.sign).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        message: "Account created! Please check your email inbox or spam for verification link.",
        data: {
            userId: '123',
            email: 'test@example.com'
        }
    })
});

it('should return 400 if email is already registered', async() => {
    const req = mockRequest({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password'
    });
    const res = mockResponse();

    (User.findOne as jest.Mock).mockResolvedValue({
        _id: '456',
        email: 'test@example.com'
    });

    await signup(req as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
        success: false,
      message: "Email is already registered"
    });
})

it('should handle email sending failure by deleting the user', async() => {
    const req = mockRequest({
        name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    });
    const res = mockResponse();

    (User.findOne as jest.Mock).mockResolvedValue(null);

    const mockUser = {
        _id: '123',
        name: 'Test User',
        email: 'test@example.com',
        isEmailVerified: false,
        save:jest.fn()
      };

      (User.create as jest.Mock).mockResolvedValue(mockUser);
    (jwt.sign as jest.Mock).mockReturnValue('mock-token');

    // Mock email failure
    (SendEmail as jest.Mock).mockRejectedValue(new Error('Email failed'));
    (User.findByIdAndDelete as jest.Mock).mockResolvedValue(true);

      await signup(req as any, res)
      expect(User.findByIdAndDelete).toHaveBeenCalledWith('123');
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: "failed",
        message: "Failed to send verification email. Please try again.",
        emailError: expect.any(Error)
      });
});

it('should return 400 for validation errors', async() => {
    const req = mockRequest({
        name: '', // Invalid name
        email: 'invalid-email',
        password: 'short'
    });
    const res = mockResponse();

    await signup(req as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
        status: "failed",
        message: "Validation failed",
        errors: expect.any(Array)
    });
});

});
