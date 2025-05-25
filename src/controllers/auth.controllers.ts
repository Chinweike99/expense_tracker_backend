
import dotenv from 'dotenv'
dotenv.config();

const jwt_secret = process.env.JWT_SECRET;
const jwt_expiresIn = process.env.JWT_EXPIRES_IN;
const frontend_url = process.env.FRONTEND_URL;

// zod schemas for validation

