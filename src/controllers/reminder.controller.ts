import { Request, Response } from "express";
import { z } from "zod";
import { Transaction } from "../models/transaction.model";
import { Reminder } from "../models/reminder.model";
import { Account } from "../models/account.models";
import { Debt } from "../models/debt.model";
import { debugPort } from "process";
import { calculateDebtPayoff } from "../services/notification.service";

const createRemindersSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["bill", "subscription", "debt", "custom"]),
  amount: z.number().optional(),
  // dueDate: z.string().datetime(),
  dueDate: z.preprocess((arg) => {
    if (typeof arg === "string" || arg instanceof Date) {
      return new Date(arg);
    }
  }, z.date()),
  frequency: z.enum(["once", "daily", "weekly", "monthly", "yearly"]),
  transaction: z.string().optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
  notification: z
    .object({
      method: z.enum(["email", "push", "both"]).optional(),
      daysBefore: z.array(z.number().min(0).max(30)).optional(),
    })
    .optional(),
});

const updateReminderSchema = createRemindersSchema.partial();

const createDebtSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["loan", "credit-card", "mortgage", "personal"]),
  initialAmount: z.number().positive(),
  currentAmount: z.number().positive(),
  interestRate: z.number().min(0).max(100),
  paymentFrequency: z.enum(["weekly", "bi-weekly", "monthly", "yearly"]),
  paymentAmount: z.number().positive(),
  startDate: z.preprocess((arg) => {
    if(typeof arg === 'string' || arg instanceof Date){
        return new Date(arg)
    }
  }, z.date()),
  endDate: z.preprocess((arg) => {
    if(typeof arg === 'string' || arg instanceof Date){
        return new Date(arg)
    }
  }, z.date()),
  account: z.string().optional(),
  lender: z.string().min(1),
  notes: z.string().optional(),
});

const updateDebtSchema = createDebtSchema.partial();

export const createReminder = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const input = createRemindersSchema.parse(req.body);

    // Validate transaction exists if provided
    if (input.transaction) {
      const transaction = await Transaction.find({
        _id: input.transaction,
        user: userId,
      });
      if (!transaction) {
        res.status(400).json({
          success: false,
          message: "Transaction was not found",
        });
        return 
      }
    }

    const reminder = await Reminder.create({
      ...input,
      user: userId,
      dueDate: new Date(input.dueDate),
      notification: {
        method: input.notification?.method || "both",
        daysBefore: input.notification?.daysBefore || [1, 3, 7],
      },
    });
    res.status(201).json({
      reminder,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
       res.status(400).json({
        message: "Validation failed",
        errors: error.errors,
      });
      return
    }
    res.status(500).json({
      success: false,
      message: "Failed to create reminder ...",
    });
  }
};

export const getReminders = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { type, upcoming } = req.query;

    const filter: any = { user: userId, isActive: true };
    if (type) filter.type = type;
    if (upcoming === "true") {
      const now = new Date();
      const upcomingDate = new Date();
      upcomingDate.setDate(upcomingDate.getDate() + 30);
      filter.dueDate = { $gte: now, $lte: upcomingDate };
    }
    const reminders = await Reminder.find(filter).sort({ dueDate: 1 });
    res.status(200).json({
      reminders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to get reminders",
      errors: error,
    });
  }
};

export const updateReminder = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const updates = await updateReminderSchema.parse(req.body);

    if (updates.dueDate) {
      updates.dueDate = new Date(updates.dueDate);
    }

    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params.id, user: userId },
      updates,
      { new: true }
    );
    if (!reminder) {
      res.status(404).json({
        success: false,
        message: "Reminder not found",
      });
      return 
    }
    res.status(200).json(reminder);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        message: "Validation failed",
        errors: error.errors,
      });
      return 
    }
    res.status(500).json({ message: "Something went wrong" });
  }
};

export const deleteReminder = async (req: Request, res: Response):Promise<void> => {
  try {
    const userId = req.user.id;
    const reminder = await Reminder.findByIdAndUpdate(
      { _id: req.params.id, user: userId },
      { isActive: false },
      { new: true }
    );

    if (!reminder) {
      res.status(404).json({
        success: false,
        message: "Reminder not found",
      });
      return 
    }
    res.status(200).json(reminder);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Unable to delete reminder",
      error: error.message,
    });
  }
};

export const createDebt = async (req: Request, res: Response):Promise<void> => {
  try {
    const userId = req.user.id;
    const debt = createDebtSchema.parse(req.body);

    if (debt.account) {
      const account = await Account.findById({
        _id: debt.account,
        user: userId,
      });
      if (!account) {
         res.status(404).json({
          status: "Failed",
          message: "Failed to create account. Account not found",
        });
        return
      }
    }

    const createDebt = await Debt.create({
      ...debt,
      user: userId,
      startDate: new Date(debt.startDate),
      endDate: debt.endDate ? new Date(debt.endDate) : undefined,
    });
    res.status(201).json({
      status: "Success",
      message: "Debt created successfully",
      data: createDebt,
    });
  } catch (error) {
    console.log(error)
    if (error instanceof z.ZodError) {
       res.status(400).json({
        message: "Validation failed",
        errors: error.errors,
      });
      return
    }
    res.status(500).json({
      success: false,
      message: "Unable to create Debt",
      error
    });
  }
};

export const getDebts = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { type, paid } = req.query;

    const filter: any = { user: userId };
    if (type) filter.type = type;
    if (paid === "true") filter.isPaid = true;
    if (paid === "false") filter.isPaid = false;

    const debts = await Debt.find(filter).populate(
      "account", "name currency").sort({isPaid: 1, endDate: 1});
      res.status(200).json(debts)
  } catch (error) {
    console.log(error)
    res.status(500).json({ 
        success: false,
        message: 'Unable to get your DEBTS',
        error
    });
  }
};


export const getDebt = async(req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user.id;
        const fetch_debt = await Debt.findOne({
            _id: req.params.id,
            user: userId
        }).populate('account', 'name currency')

        if(!fetch_debt){
            res.status(404).json({
                status: 'Failed',
                message: "This debt does not exit, or was not found"
            });
            return 
        }
        res.status(200).json({
            status: "Debt gotten",
            message: fetch_debt
        })
    } catch (error) {
        res.status(500).json({ 
            success: false,
            message: 'Failed to get debt' 
        });
    }
}


export const updateDebt = async(req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user.id;
        const updates = updateDebtSchema.parse(req.body);

        if(updates.startDate) updates.startDate = new Date(updates.startDate);
        if(updates.endDate) updates.endDate = new Date(updates.endDate);

        const debt = await Debt.findOneAndUpdate(
            {_id: req.params.id, user: userId},
            updates,
            {new: true}
        ).populate('account', 'name currency');

        if (!debt) {
            res.status(404).json({ message: 'Debt not found' });
            return;
          }
      
          res.status(200).json(debt);
        } catch (error) {
          if (error instanceof z.ZodError) {
            res.status(400).json({
              message: 'Validation failed',
              errors: error.errors,
            });
            return;
          }
          res.status(500).json({ message: 'Something went wrong, Unable to update debt' });
        }
      };

      
export const deleteDebt = async(req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const debt = await Debt.findOneAndDelete({
            _id: req.params.id,
            user: userId,
          });
        if(!debt){
            res.status(404).json({
                status: "Failed",
                message: "Unable to delete debt. Debt not found"
            })
        }
        res.status(200).json({
            status: "Success",
            message: "Debt deleted successfully"
        })
    } catch (error) {
        res.status(500).json({ 
            success: false,
            message: 'Unable to delete debt' 
        });
    }
}


export const calculatePayoffPlan = async(req: Request, res: Response) : Promise<void> => {
    try {
        const userId = req.user.id;
        const {extraPayment} = req.query;
        const debt = await Debt.findOne({
            _id: req.params.id,
            user: userId
        });

        if (!debt) {
            res.status(404).json({ message: 'Debt not found' });
            return
          }

          const extra = parseFloat(extraPayment as string) || 0;
          const payoffData = calculateDebtPayoff(
            debt.currentAmount,
            debt.interestRate,
            debt.paymentAmount + extra,
            debt.paymentFrequency
          )

          res.status(200).json({
            status: "Success",
            message: payoffData
          })

    } catch (error) {
        res.status(500).json({ 
            success: false,
            message: 'Failed to get calaulate pay off plan' 
        });
    }
}


export const recordDebtPayment = async(req: Request, res: Response) :Promise<void> => {
    try {
        const userId = req.user.id;
        const { amount, date, accountId } = req.body;

        const debt = await Debt.findOne({
            _id: req.params.id,
            user: userId,
          });
          
          if (!debt) {
            res.status(404).json({ message: 'Debt not found' });
            return 
          }

          // Validate account exists if provided
    if (accountId) {
        const account = await Account.findOne({
          _id: accountId,
          user: userId
        });
        if (!account) {
          res.status(400).json({ message: 'Account not found' });
          return;
        }
      }

      // Calculate interest and principal portions
    const monthlyRate = debt.interestRate / 100 / 12;
    const interest = debt.currentAmount * monthlyRate;
    const principal = amount - interest;

    // Update debt
    debt.currentAmount = Math.max(0, debt.currentAmount - principal);
    debt.isPaid = debt.currentAmount <= 0;

    if (debt.isPaid) {
        debt.endDate = new Date();
      }
      
      await debt.save();

       // Create transaction record
    const transaction = await Transaction.create({
        amount,
        description: `Payment for ${debt.name}`,
        date: date ? new Date(date) : new Date(),
        type: 'expense',
        account: accountId,
        user: userId,
        // category: 'Debt Payment',
        notes: `Debt payment: ${principal.toFixed(2)} principal, ${interest.toFixed(2)} interest`
      });
      res.status(201).json({
        debt,
        transaction,
      });
    } catch (error) {
        console.log(error)
      res.status(500).json({ 
        success: false,
        message: 'Unable to record debt payment',
        error: error
    });
    }
  };


