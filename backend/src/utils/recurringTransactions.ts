import { ITransaction, Transaction } from "../models/transaction.model";
import moment from "moment";

export const processRecurringTransactions = async () => {
  try {
    const now = new Date();
    const recurringTransactions = await Transaction.find({
      isRecurring: true,
      nextRecurringDate: { $lte: now },
    });

    for (const originalTx of recurringTransactions) {
      const newTxDate: Partial<ITransaction> = {
        amount: originalTx.amount,
        description: originalTx.description,
        date: originalTx.nextRecurringDate,
        type: originalTx.type,
        category: originalTx.category,
        account: originalTx.account,
        user: originalTx.user,
        tags: originalTx.tags,
        notes: originalTx.notes,
        isRecurring: true,
        recurringId:
          originalTx.recurringId || (originalTx._id as string).toString(),
        splitTransactions: originalTx.splitTransactions,
      };

      // Calculate next Occurance
      let nextDate;
      switch (originalTx.frequency) {
        case "daily":
          nextDate = moment(originalTx.nextRecurringDate)
            .add(1, "days")
            .toDate();
          break;
        case "weekly":
          nextDate = moment(originalTx.nextRecurringDate)
            .add(1, "weeks")
            .toDate();
          break;
        case "monthly":
          nextDate = moment(originalTx.nextRecurringDate)
            .add(1, "months")
            .toDate();
          break;
        case "yearly":
          nextDate = moment(originalTx.nextRecurringDate)
            .add(1, "years")
            .toDate();
          break;
      }

      // Update original transaction with next Date
      originalTx.nextRecurringDate = nextDate;
      await originalTx.save();

      //Create the new transaction..
      await Transaction.create(newTxDate);

    }
  } catch (error) {
    console.error('Error processing recurring transactions:', error);
  }
};
