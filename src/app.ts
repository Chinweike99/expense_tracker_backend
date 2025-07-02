import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { apiLimiter, errorHandler, loginLimiter } from './middlewares/auth.middlewares';
import authRoutes from './routes/auth.routes'
import transactionRouter from './routes/transaction.routes'
import analyticsRouter from './routes/analytics.routes'
import budgetRouter from './routes/budget.routes'
import reminderRouter from './routes/reminder.routes';
import mongoose from 'mongoose';
import dotenv from 'dotenv'
dotenv.config();

const app = express();

export const configCors = ()=> {
    return cors({
        origin: (origin, callback) => {
            const allowedOrigins = [
                process.env.FRONTEND_URL || "http://localhost:3000",
                process.env.FRONTEND_URL2 || "http://localhost:3001",
                process.env.FRONTEND_URL3 || "http://localhost:5173"
            ]
            if(!origin || allowedOrigins.includes(origin)){
                callback(null, true);
            }else{
                callback(new Error("Not allowed by cors"))
            }
        },
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "Accept",
            "Content-Range",
            "X-Content-Range"
        ],
        credentials: true,
        preflightContinue: false,
        maxAge: 600,
        optionsSuccessStatus: 204
    })
}

//Middlewares
app.use(helmet());
app.use(configCors());                
app.options("*", configCors());  
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

// Rate Limiting
app.get('/', (req, res) => {
    res.send('Expense Tracker API ...')
})
app.use('/api', apiLimiter);
app.use('/api/auth/login', loginLimiter);


//Routes
app.use('/api/auth', authRoutes);
app.use('/api', transactionRouter);
app.use('/api', analyticsRouter);
app.use('/api', budgetRouter);
app.use('/api', reminderRouter);

// Error handling
app.use(errorHandler);

// connect to Database
mongoose.connect(process.env.MONGODB_URI!).then(() => {
    console.log("Connected to MongoDB 😎")
}).catch((error) => console.log("Connection error: ", error));

export default app;

