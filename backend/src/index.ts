import app from './app';
import dotenv from 'dotenv';
import { setupCronJobs } from './services/cron.service';
import { getPeriodStartDate } from './models/budget.models';

dotenv.config();

const PORT = process.env.PORT || 5000;

const now = new Date('2025-06-11');


console.log(getPeriodStartDate('monthly', now));
// → 2025-06-01T00:00:00.000Z

console.log(getPeriodStartDate('weekly', now));
// → 2025-06-08T00:00:00.000Z (Sunday before 11th)

console.log(getPeriodStartDate('quarterly', now));
// → 2025-04-01T00:00:00.000Z

console.log(getPeriodStartDate('yearly', now));
// → 2025-01-01T00:00:00.000Z


app.listen(PORT, ()=>{
    // console.log('Connecting to:', process.env.EMAIL_HOST, process.env.EMAIL_PORT);
    console.log(`Server running on port ${PORT}`)
    setupCronJobs();
})
