import cron from 'node-cron'
import { processRecurringTransactions } from '../utils/recurringTransactions';
import { processBudgetRollovers } from '../controllers/budget.controller';

export const setupCronJobs = () => {
    cron.schedule('0 0 * * *', async() => {
        console.log("Processing recurring transactions ... ");
        await processRecurringTransactions();
        console.log("Finished Processing")
    });

    // Run at the end of each month for budget rollovers
    cron.schedule('0 0 28-31 * *', async () => {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Only run if tomorrow is the first day of the month
        if(tomorrow.getDate() === 1) {
            console.log('Processing budget rollovers ...');
            await processBudgetRollovers({} as any, {
                status: () => ({json: () => {}})
            } as any);
            console.log('FInished processing budget rollovers')
        }
    })

}