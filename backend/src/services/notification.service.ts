import { Reminder } from "../models/reminder.model";




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
        }).populate('user', 'email name')

    } catch (error) {
        
    }
}