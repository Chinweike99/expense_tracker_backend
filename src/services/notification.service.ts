import { IAccount } from "../models/account.models";
import { Budget } from "../models/budget.models";
import { Debt, PaymentFrequency } from "../models/debt.model";
import { Reminder } from "../models/reminder.model";
import { IUser } from "../models/user.models";
import { SendEmail } from "../utils/email";
import { checkBudgetThresholds } from "./forecast.service";

const isPopulatedAccount = (account: IAccount['_id'] | IAccount | undefined): account is IAccount => {
    return account !== null && typeof account === 'object' && 'name' in account;
};


export const sendReminderFunctions =  async() => {
    try {
        const now = new Date();
        const upcomingDate = new Date();
        upcomingDate.setDate(upcomingDate.getDate() + 7);

        // Find reminders due in the next 7 days
        const reminders = await Reminder.find({
            dueDate: {$lte: upcomingDate, $gte: now},
            isActive: true,
            $or: [
                { 'notification.lastSent': {$exists: false}},
                { 'notification.lastSent': { $lt: now}}
            ]
        }).populate('user', 'email name');

        for (const reminder of reminders){
            const user = reminder.user as unknown as IUser;
            const daysUntilDue = Math.ceil(
                (reminder.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );

            // Check if we should notify based on daysBefore settings
            if(reminder.notification.method === 'email' || reminder.notification.method === 'both'){
                await SendEmail({
                    email: user.email,
                    subject: `Reminder: ${reminder.name} is due in ${daysUntilDue} days`,
                    html: `
                        <h2>Reminder: ${reminder.name}</h2>
                        <P>Dur in ${daysUntilDue} day(s) on ${reminder.dueDate.toString()}</p>
                        ${reminder.amount ? `<p>Amount: $${reminder.amount.toFixed(2)}</p>` : ''}
              ${reminder.notes ? `<p>Notes: ${reminder.notes}</p>` : ''}
              <p>Thank you for using Expense Tracker!</p>
                    `
                })
            }

            // For Push notification, we'd typically send to a message service
            if(reminder.notification.method === 'push' || reminder.notification.method === 'both'){
                // In a real app, this would call firebase cloud message or similar
                console.log(`Push notification sent for reminder: ${reminder.name}`);
                // Update last sent time
                reminder.notification.lastSent = now;
                await reminder.save();
            }

        }
        return { 
            success: true, 
            message: "Reminder successfully sent",
            remindersProcessed: reminders.length
        };
    } catch (error) {
        console.error('Error sending reminder notification:', error)
        throw error
    }
}


export const sendBudgetAlerts = async() => {
    try {
        // Get all budgets alerts
        const budgets = await Budget.find({
            'notifications.enabled': true
        }).populate('user', 'email name');

        const alerts = await checkBudgetThresholds();

        for(const alert of alerts){
            const budget = budgets.find(b => (b._id as any).equals(alert.budgetId));
            if(!budget) continue;

            const user = budget.user as unknown as IUser;
            const notificationMethod = budget.notifications.method || 'both';
            if(notificationMethod === 'email' || notificationMethod === 'both' ){
                await SendEmail({
                    email: user.email,
          subject: `Budget Alert: ${budget.name}`,
          html: `
            <h2>Budget Alert: ${budget.name}</h2>
            <p>You've reached ${alert.progress}% of your ${alert.period} budget</p>
            <p>Budget: $${budget.amount.toFixed(2)}</p>
            <p>Spent: $${alert.spent.toFixed(2)}</p>
            <p>Remaining: $${alert.remaining.toFixed(2)}</p>
            <p>Period: ${alert.periodStart.toDateString()} to ${alert.periodEnd.toDateString()}</p>
            <p>Thank you for using Expense Tracker!</p>
          `
                })
            }
            if (notificationMethod === 'push' || notificationMethod === 'both') {
                console.log(`Push notification sent for budget alert: ${budget.name}`);
              }
        }
        return { success: true, alertsProcessed: alerts.length };
    } catch (error) {
      console.error('Error sending budget alerts:', error);
      throw error;
    }
  };


  export const sendDebtPaymentReminders = async () => {
    try {
        const now = new Date();
        const upcomingDate = new Date();
        upcomingDate.setDate(upcomingDate.getDate() + 3);

        const debts = await Debt.find({
            endDate: {$lte: now},
            isPaid: false,
            $expr: {
                $lte: [
                   {
                    $dateAdd: {
                        startDate: "$startDate",
                        unit: "$paymentFrequency",
                        amount: {
                            $ceil: {
                                $divide: [
                                    { $subtract: [now, "$startDate"] },
                                    { $cond: [
                                        { $eq: ['$paymentFrequency', 'weekly']},
                                        7 * 24 * 60 * 60 * 1000,
                                        { $cond: [
                                            { $eq: ['$paymentFrequency', 'bi-weekly']},
                                            14 * 24 * 60 * 60 * 1000,
                                            { $cond: [
                                                { $eq: ['paymentFrequency', 'monthly']},
                                                30 * 24 * 60 * 60 * 1000,
                                                365 * 24 * 60 * 60 * 1000
                                            ]}
                                        ]}
                                    ]}
                                ]
                            }
                        }
                    }
                   },
                   upcomingDate
                ]
            }
        }).populate('user', 'email name').populate('account', 'name');

        for (const debt of debts){
            const user = debt.user as unknown as IUser;

            // Calculate next payment date
            const nextPaymentDate = calculateNextPaymentDate(
                debt.startDate,
                debt.paymentFrequency
            );

             // Send email notification
        await SendEmail({
            email: user.email,
            subject: `Upcoming Payment Due: ${debt.name}`,
            html: `
              <h2>Upcoming Payment Due: ${debt.name}</h2>
              <p>Payment Amount: $${debt.paymentAmount.toFixed(2)}</p>
              <p>Due Date: ${nextPaymentDate.toDateString()}</p>
              <p>Current Balance: $${debt.currentAmount.toFixed(2)}</p>
             ${isPopulatedAccount(debt.account) ? `<p>Payment Account: ${debt.account.name}</p>` : ''}
}
              <p>Thank you for using Expense Tracker!</p>
            `
        })
        // For push notifications
        console.log(`Debt payment reminder sent for: ${debt.name}`);
        }
        return { success: true, debtsProcessed: debts.length };
    } catch (error) {
      console.error('Error sending debt payment reminders:', error);
      throw error;
    }
  };



  function calculateNextPaymentDate(startDate: Date, frequency: string): Date{
    const now = new Date();
    const nextDate = new Date(startDate);

    while(nextDate < now){
        switch(frequency){
            case 'weekly':
                nextDate.setDate(nextDate.getDate() + 7);
                break;
            case 'bi-weekly':
                nextDate.setDate(nextDate.getDate() + 14);
                break;
            case 'monthly':
                nextDate.setMonth(nextDate.getMonth() + 1);
                break;
            case 'yearly':
                nextDate.setFullYear(nextDate.getFullYear() + 1);
        }
    }
    return nextDate;
  }


  export const calculateDebtPayoff = (
    principal: number,
    interestRate: number,
    paymentAmount: number,
    frequency: PaymentFrequency
  ) => {
    const monthlyRate = interestRate / 100 / 12;
    let balance = principal;
    let totalInterst = 0;
    let payment = 0;
    const paymentSchedule = [];

    // Adjust payment amount for non-monthly frequencies
    let adjustedPayment = paymentAmount;
    if(frequency === 'weekly'){
        adjustedPayment = paymentAmount * 4;
    }else if(frequency === 'bi-weekly'){
        adjustedPayment = paymentAmount * 2;
    }

    while(balance > 0 && payment < 1200){
        const interest = balance * monthlyRate;
        let principalPayment = adjustedPayment - interest;

        if(principalPayment > balance){
            principalPayment = balance;
            adjustedPayment = principalPayment + interest;
        }
        balance -= principalPayment;
        totalInterst += interest;
        payment++;
        paymentSchedule.push({
            payment: payment,
            date: new Date(new Date().setMonth(new Date().getMonth() + payment)),
            principal: principalPayment,
            interest: interest,
            balance: balance
        })
    }

    return {
        payoffDate: paymentSchedule[paymentSchedule.length - 1]?.date || null,
        totalInterst,
        totalPayments: payment,
        paymentSchedule
    }

  }