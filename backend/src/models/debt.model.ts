import mongoose, { Document, Schema } from "mongoose";
import { IUser } from "./user.models";
import { IAccount } from "./account.models";



export type DebtType = 'loan' | 'credit_card' | 'mortgage' | 'personal';
export type PaymentFrequency = 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'yearly';


export interface IDebt extends Document {
    name: string;
    type: DebtType;
    initialAmount: number;
    currentAmount: number;
    interestRate: number;
    paymentFrequency: PaymentFrequency;
    paymentAmount: number;
    startDate: Date;
    endDate?: Date;
    user: IUser['_id'];
    account?: IAccount['_id'] | IAccount;
    lender: string;
    isPaid: boolean;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
  }


  const debtSchema = new Schema<IDebt>(
    {
      name: { type: String, required: [true, 'Debt name is required'] },
      type: { 
        type: String, 
        enum: ['loan', 'credit-card', 'mortgage', 'personal'], 
        required: [true, 'Type is required'] 
      },
      initialAmount: { 
        type: Number, 
        required: [true, 'Initial amount is required'],
        min: 0
      },
      currentAmount: { 
        type: Number, 
        required: [true, 'Current amount is required'],
        min: 0
      },
      interestRate: { 
        type: Number, 
        required: [true, 'Interest rate is required'],
        min: 0,
        max: 100
      },
      paymentFrequency: { 
        type: String, 
        enum: ['weekly', 'bi-weekly', 'monthly', 'yearly'], 
        required: [true, 'Payment frequency is required'] 
      },
      paymentAmount: { 
        type: Number, 
        required: [true, 'Payment amount is required'],
        min: 0
      },
      startDate: { type: Date, required: [true, 'Start date is required'] },
      endDate: { type: Date },
      user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      account: { type: Schema.Types.ObjectId, ref: 'Account' },
      lender: { type: String, required: [true, 'Lender is required'] },
      isPaid: { type: Boolean, default: false },
      notes: { type: String }
    },
    { timestamps: true }
  );


  debtSchema.index({ user: 1, isPaid: 1 });
debtSchema.index({ user: 1, endDate: 1 });

export const Debt = mongoose.model<IDebt>('Debt', debtSchema);
  