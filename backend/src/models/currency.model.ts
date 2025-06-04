import mongoose, { Document } from "mongoose";
import { IUser } from "./user.models";
import { Schema } from "mongoose";


export interface ICurrency extends Document {
    code: string; // ISO currency code (USD, EUR, etc)
    name: string;
    symbol: string;
    user: IUser['_id'];
    isPrimary: boolean;
    exchangeRate?: number;
    lastUpdated?: Date;
}

const currencySchema = new Schema<ICurrency>(
    {
      code: { type: String, required: [true, 'Currency code is required'], uppercase: true },
      name: { type: String, required: [true, 'Currency name is required'] },
      symbol: { type: String, required: [true, 'Currency symbol is required'] },
      user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      isPrimary: { type: Boolean, default: false },
      exchangeRate: { type: Number },
      lastUpdated: { type: Date },
    },
    { timestamps: true }
  );


  //Ensure only one primary currency per user
  currencySchema.index({user: 1, isPrimary: 1}, {unique: true, partialFilterExpression: {isPrimary: true}});
  export const Currency =  mongoose.model<ICurrency>("Currency", currencySchema);

