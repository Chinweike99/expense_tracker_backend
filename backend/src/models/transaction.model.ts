import mongoose, { Document, Schema } from "mongoose";
import { ICategory } from "./category.model";
import { IAccount } from "./account.models";
import { IUser } from "./user.models";


export type TransactionType = 'expense' | 'income' | 'transfer';

export interface ITransaction extends Document {
    amount: number;
    description: string;
    date: Date;
    type: TransactionType;
    category: ICategory['_id'];
    account: IAccount['_id'];
    user: IUser['_id'];
    tags: string[];
    notes: string;
    isRecurring: boolean;
    recurringId?: string;
    nextRecurringDate?: Date;
    frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    splitTransactions?: {
        amount: number;
        description: string;
        userId: IUser['_id'];
        paid: boolean;
    }[];
    createdAt: Date;
    updatedAt: Date;
};


const transactionSchema = new Schema<ITransaction>(
    {
        amount: { type: Number, required: [true, 'Amount is required'], min: 0 },
        description: { type: String, required: [true, 'Description is required'] },
        date: { type: Date, required: [true, 'Date is required'], default: Date.now },
        type: { 
          type: String, 
          enum: ['expense', 'income', 'transfer'], 
          required: [true, 'Type is required'] 
        },
        category: {
            type: Schema.Types.ObjectId,
            ref: 'Category',
            // required: function(this: ITransaction) {
            //     return this.type !== 'transfer';
            // }
        },
        account: { 
            type: Schema.Types.ObjectId, 
            ref: 'Account', 
            required: [true, 'Account is required'] 
          },
          user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          tags: { type: [String], default: [] },
          notes: { type: String, default: '' },
          isRecurring: { type: Boolean, default: false },
          recurringId: { type: String },
          nextRecurringDate: { type: Date },
          frequency: { 
            type: String, 
            enum: ['daily', 'weekly', 'monthly', 'yearly'],
            required: function(this: ITransaction) {
              return this.isRecurring;
            }
          },
          splitTransactions: {
            type: [{
              amount: { type: Number, required: true },
              description: { type: String, required: true },
              userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
              paid: { type: Boolean, default: false },
            }],
            validate: {
              validator: function (this: ITransaction, splits: any[]) {
                if (!splits || splits.length === 0) return true; // ✅ safe skip
                const totalSplit = splits.reduce((sum, split) => sum + split.amount, 0);
                return totalSplit === this.amount;
              },
              message: 'Sum of split amounts must equal transaction amount'
            }
          },
    },
    { timestamps: true }
)


// Indexes for performance
transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ user: 1, account: 1 });
transactionSchema.index({ user: 1, category: 1 });
transactionSchema.index({ user: 1, type: 1 });
transactionSchema.index({ recurringId: 1 });


// Middleware to update account balance
transactionSchema.pre<ITransaction>("save", async function(next){
    if(this.isNew){
        const Account = mongoose.model('Account');
        const account = await Account.findById(this.account);

        if(!account) {
            throw new Error("Account not found");
        };

        if(this.type === 'income'){
            account.balance += this.amount
        } else if (this.type === 'expense') {
            account.balance -= this.amount;
          }
          // Transfers will be handled seperately

          await account.save()
    };
    next();
});


// Middleware to revert account balance when transaction is deleted
transactionSchema.pre<ITransaction>('deleteOne', async function(next) {
    const Account = mongoose.model('Account');
    const account = await Account.findById(this.account);
    
    if (!account) {
      throw new Error('Account not found');
    }
  
    if (this.type === 'income') {
      account.balance -= this.amount;
    } else if (this.type === 'expense') {
      account.balance += this.amount;
    }
    // Transfers will be handled separately with two transactions
  
    await account.save();
    next();
  });
  
  export const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);

