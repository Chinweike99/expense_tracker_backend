import cron from "node-cron";
import { processRecurringTransactions } from "../utils/recurringTransactions";
import { processBudgetRollovers } from "../controllers/budget.controller";
import { sendBudgetAlerts, sendDebtPaymentReminders, sendReminderFunctions } from "./notification.service";

export const setupCronJobs = () => {
  cron.schedule("0 0 * * *", async () => {
    console.log("Processing recurring transactions ... ");
    await processRecurringTransactions();
    console.log("Finished Processing");
  });

  // Run at the end of each month for budget rollovers
  cron.schedule("0 0 28-31 * *", async () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Only run if tomorrow is the first day of the month
    if (tomorrow.getDate() === 1) {
      console.log("Processing budget rollovers ...");
      await processBudgetRollovers(
        {} as any,
        {
          status: () => ({ json: () => {} }),
        } as any
      );
      console.log("FInished processing budget rollovers");
    }
  });

  // Run every morning at 8am for reminders
  cron.schedule("0 8 * * *", async () => {
    console.log("Sending reminder notifications...");
    const result = await sendReminderFunctions();
    console.log(`Sent ${result.remindersProcessed} reminder notifications`);
  });

  // Run every evening at 8pm for budget alerts
  cron.schedule("0 20 * * *", async () => {
    console.log("Sending budget alerts...");
    const result = await sendBudgetAlerts();
    console.log(`Sent ${result.alertsProcessed} budget alerts`);
  });

  // Run every Monday at 9am for debt payment reminders
  cron.schedule("0 9 * * 1", async () => {
    console.log("Sending debt payment reminders...");
    const result = await sendDebtPaymentReminders();
    console.log(`Sent ${result.debtsProcessed} debt payment reminders`);
  });
};
