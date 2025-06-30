import mongoose, { Document, Schema } from "mongoose";
import { IUser } from "./user.models";


export interface IAccount extends Document {
    name: string;
    type: 'cash' | 'credit card' | 'investment' | 'loan' | 'other';
    balance: number;
    currency: string;
    user: IUser['_id'];
    isActive: boolean;
    creadtedAt: Date;
    updatedAt: Date;
};


const accountSchema = new Schema<IAccount>(
    {
        name: { type: String, required: [true, 'Account name is required'] },
        type: {
          type: String,
          enum: ['cash', 'bank', 'credit card', 'investment', 'loan', 'other'],
          required: [true, 'Account type is required'],
        },
        balance: { type: Number, default: 0, required: true },
        currency: { type: String, required: [true, 'Currency is required'] },
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        isActive: { type: Boolean, default: true },
      },
      { timestamps: true }
);

// Index for frequently queried fields
accountSchema.index({user: 1, isActive: 1});
export const Account = mongoose.model<IAccount>("Account", accountSchema)