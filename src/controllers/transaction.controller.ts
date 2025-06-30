import { Request, Response } from "express";
import { z } from "zod";
import { Category } from "../models/category.model";
import { Account } from "../models/account.models";
import { Transaction } from "../models/transaction.model";




// Zod schemas for validation
const createTransactionSchema = z.object({
    amount: z.number().positive(),
    description: z.string().min(1),
    date: z.string().datetime().optional(),
    type: z.enum(['expense', 'income', 'transfer']),
    category: z.string().optional(),
    account: z.string(),
    tags: z.array(z.string()).optional(),
    notes: z.string().optional(),
    isRecurring: z.boolean().optional(),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional(),
    splitTransactions: z.array(z.object({
      amount: z.number().positive(),
      description: z.string().min(1),
      userId: z.string(),
      paid: z.boolean().optional(),
    })).optional(),
  });


const updateTransactionSchema = createTransactionSchema.partial();

export const createTransaction = async(req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user.id;
        const input = createTransactionSchema.parse(req.body);

        // Validate category exists if provided
        if(input.category){
            const category = await Category.findOne({
                _id: input.category,
                $or: [{ user: userId}, { isDefault: true }]
            });
            if(!category){
                res.status(400).json({
                    status: "failed",
                    message: "Category does not exist"
                });
                return 
            }

        }

        const account = await Account.findOne({
            _id: input.account,
            user: userId,
            isActive: true
        });

        if(!account){
            res.status(400).json({
                status: "failed",
                message: "Account does not exist"
            });
            return 
        }

        // Handle recurring transaction setup
        let nextRecurringDate;
        if(input.isRecurring && input.frequency){
            const now = new Date();
            nextRecurringDate = calculateNextDate(now, input.frequency)
        };

        const transaction = await Transaction.create({
            ...input,
            user: userId,
            nextRecurringDate,
            date: input.date ? new Date(input.date) : new Date(),
        });

        res.status(201).json(transaction);


    } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({
            message: 'Validation failed',
            errors: error.errors,
          });
          return 
        }
        res.status(500).json({ message: 'Unable to create transactions', error });
      }
}


export const getTransactions = async(req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const {
            startDate, endDate, account, category, type, tag, search, limit = 50, skip=0
        } = req.query
        const filter: any = {user: userId};

        // Date range filter
        if(startDate && endDate){
            filter.date = {
                $gte: new Date(startDate as string),
                $lte: new Date(endDate as string),
            };
        }else if(startDate){
            filter.date = {$gte: new Date(startDate as string)}
        }else if (endDate){
            filter.date = { $lte: new Date(endDate as string)};
        }

        // Other filters
    if (account) filter.account = account;
    if (category) filter.category = category;
    if (type) filter.type = type;
    if (tag) filter.tags = tag;
    if (search) {
      filter.$or = [
        { description: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
      ];
    }

    const transactions = await Transaction.find(filter)
      .populate('category', 'name icon color')
      .populate('account', 'name type currency')
      .sort({ date: -1 })
      .limit(Number(limit))
      .skip(Number(skip));

      const total = await Transaction.countDocuments(filter);
    res.status(200).json({
        transactions,
        total
    });

    } catch (error) {
      console.log(error);
        res.status(500).json({ message: 'Unable to get transactions', error });
    }
}


export const getTransaction = async(req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user.id;
        const transaction = await Transaction.findOne({
            _id: req.params.id,
            user: userId
        }).populate("category", "name icon color").populate('account', 'name type currency');

        if(!transaction){
            res.status(404).json({message: 'Transaction not found'});
            return 
        }
        res.status(200).json(transaction);
    } catch (error) {
      console.log(error)
        res.status(500).json({ message: 'Failed to get transaction' });
    }
}


export const updateTransaction = async(req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const updates = updateTransactionSchema.parse(req.body);

        // Validate category exists if provided
    if (updates.category) {
        const category = await Category.findOne({ 
          _id: updates.category, 
          $or: [{ user: userId }, { isDefault: true }] 
        });
        if (!category) {
          res.status(400).json({ message: 'Category not found' });
          return 
        }
      }
      
      // Validate account exists and belongs to user if provided
    if (updates.account) {
        const account = await Account.findOne({ 
          _id: updates.account, 
          user: userId, 
          isActive: true 
        });
        if (!account) {
          res.status(400).json({ message: 'Account not found' });
          return 
        }
      }

      const transaction = await Transaction.findOneAndUpdate(
        {_id: req.params.id, user: userId},
        updates,
        {new: true, runValidators: true}
      );

      if (!transaction) {
        res.status(404).json({ message: 'Transaction not found' });
        return 
      }
res.status(200).json(transaction) ;
        
    } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({
            message: 'Validation failed',
            errors: error.errors,
          });
          return 
        }
        res.status(500).json({ message: 'Something went wrong' });
      }
}

export const deleteTransaction = async(req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user.id;
        const transaction = await Transaction.findOneAndDelete({
          _id: req.params.id,
          user: userId,
        });
    
        if (!transaction) {
          res.status(404).json({ message: 'Transaction not found' });
          return 
        }
    
        res.status(204).json();
      } catch (error) {
        console.log(error)
        res.status(500).json({ message: 'Failed to delete transactions' });
      }
}

export const createTransfer = async (req: Request, res: Response): Promise<void> =>{
    try {
        const userId = req.user.id;
        const { 
            amount, 
            description, 
            date, 
            fromAccount, 
            toAccount, 
            fee, 
            feeAccount 
          } = req.body;

          // Validate accounts
    const from = await Account.findOne({ 
        _id: fromAccount, 
        user: userId, 
        isActive: true 
      });
      const to = await Account.findOne({ 
        _id: toAccount, 
        user: userId, 
        isActive: true 
      });

      if(!from || !to) {
        res.status(400).json({ message: 'One or both accounts not found' });
        return 
      }

      const withdrawal = await Transaction.create({
        amount,
        description: description || `Transfer to ${to.name}`,
        date: date ? new Date(date) : new Date(),
        type: 'expense',
        account: from._id,
        user: userId,
        notes: `Transfer to ${to.name}`,
    });

    // Create deposit transaction
    const deposit = await Transaction.create({
        amount,
        description: description || `Transfer from ${from.name}`,
        date: date ? new Date(date) : new Date(),
        type: 'income',
        account: to._id,
        user: userId,
        notes: `Transfer from ${from.name}`,
      });

      
    // Handle transfer fee if applicable
    let feeTransaction;
    if (fee && fee > 0) {
      const feeAcc = feeAccount 
        ? await Account.findOne({ _id: feeAccount, user: userId, isActive: true })
        : from;

      if (!feeAcc) {
        res.status(400).json({ message: 'Fee account not found' });
        return 
      }

      feeTransaction = await Transaction.create({
        amount: fee,
        description: 'Transfer fee',
        date: date ? new Date(date) : new Date(),
        type: 'expense',
        account: feeAcc._id,
        user: userId,
        notes: `Fee for transfer from ${from.name} to ${to.name}`,
      });
    }
    res.status(201).json({
        withdrawal,
        deposit,
        fee: feeTransaction,
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: 'Failed to create transfer', error });
    }
}


export const getRecurringTransactions = async(req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const transactions = await Transaction.find({
          user: userId,
          isRecurring: true,
        })
          .populate('category', 'name icon color')
          .populate('account', 'name type currency')
          .sort({ nextRecurringDate: 1 });
    
        res.status(200).json(transactions);
      } catch (error) {
        console.log(error)
        res.status(500).json({ message: 'Failed to get recurring transactions' });
      }
};


export const updateRecurringTransactions = async(req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user.id;
      const {frequency, isRecurring} = req.body

      if(frequency && !['daily', 'weekly', 'monthly', 'yearly'].includes(frequency)){
        res.status(400).json({ message: 'Invalid frequency' });
        return ;
      }

      // Find the original transaction
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: userId,
      isRecurring: true,
    });

    if (!transaction) {
      res.status(404).json({ message: 'Recurring transaction not found' });
      return ;
    }

    // Update all transactions in this recurring series
    await Transaction.updateMany(
      { 
        user: userId,
        $or: [
          { _id: transaction.recurringId || transaction._id },
          { recurringId: transaction.recurringId || transaction._id }
        ]
      },
      { frequency, isRecurring }
    );

    // If turning off recurring, clear nextRecurringDate
    if (isRecurring === false) {
      await Transaction.updateMany(
        { 
          user: userId,
          $or: [
            { _id: transaction.recurringId || transaction._id },
            { recurringId: transaction.recurringId || transaction._id }
          ]
        },
        { $unset: { nextRecurringDate: "" } }
      );
    }

    res.status(200).json({ message: 'Recurring transactions updated' });
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Un able to get recurring transactions' });
  }
}








// Helper function to calcultate next rcurring date.. 
function calculateNextDate(currentDate: Date, frequency: string): Date {
    const date = new Date(currentDate);
    switch (frequency) {
        case 'daily':
          date.setDate(date.getDate() + 1);
          break;
        case 'weekly':
          date.setDate(date.getDate() + 7);
          break;
        case 'monthly':
          date.setMonth(date.getMonth() + 1);
          break;
        case 'yearly':
          date.setFullYear(date.getFullYear() + 1);
          break;
      }
      return date;
}





