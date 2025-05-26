import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { apiLimiter, errorHandler, loginLimiter } from './middlewares/auth.middlewares';
import authRoutes from './routes/auth.routes'
import mongoose from 'mongoose';

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
app.use('api/auth', authRoutes);

// Error handling
app.use(errorHandler);

// connect to Database
mongoose.connect(process.env.MONGODB_URI!).then(() => {
    console.log("Connected to MongoDB 😎")
});

export default app;

