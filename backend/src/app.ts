import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { apiLimiter, errorHandler, loginLimiter } from './middlewares/auth.middlewares';
import authRoutes from './routes/auth.routes';
import accountRoutes from './routes/account.route';
import transactionRouter from './routes/transaction.routes';
import analyticsRouter from './routes/analytics.routes';

import mongoose from 'mongoose';
import dotenv from 'dotenv'
dotenv.config();

const app = express();

//Middlewares
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL, 
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));


// Rate Limiting
app.use('/api', apiLimiter);
app.use('/api/auth/login', loginLimiter);


//Routes
app.use('/api/auth', authRoutes);
app.use('/api', accountRoutes);
app.use('/api', transactionRouter);
app.use('/api', analyticsRouter);


// Error handling
app.use(errorHandler);

// connect to Database
mongoose.connect(process.env.MONGODB_URI!).then(() => {
    console.log("Connected to MongoDB 😎")
}).catch((error) => console.log("Connection error: ", error));

export default app;

