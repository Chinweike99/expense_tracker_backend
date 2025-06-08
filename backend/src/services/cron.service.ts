import cron from 'node-cron'
import { processRecurringTransactions } from '../utils/recurringTransactions';

export const setupCronJobs = () => {
    cron.schedule('0 0 * * *', async() => {
        console.log("Processing recurring transactions ... ");
        await processRecurringTransactions();
        console.log("Finished Processing")
    })
}