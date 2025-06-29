import app from './app';
import dotenv from 'dotenv';
import { setupCronJobs } from './services/cron.service';
import { getPeriodStartDate } from './models/budget.models';

dotenv.config();

const PORT = process.env.PORT || 5000;

const now = new Date('2025-06-11');


console.log(getPeriodStartDate('monthly', now));
console.log(getPeriodStartDate('weekly', now));
console.log(getPeriodStartDate('quarterly', now));
console.log(getPeriodStartDate('yearly', now));


app.listen(PORT, ()=>{
    // console.log('Connecting to:', process.env.EMAIL_HOST, process.env.EMAIL_PORT);
    console.log(`Server running on port ${PORT}`)
    setupCronJobs();
})
