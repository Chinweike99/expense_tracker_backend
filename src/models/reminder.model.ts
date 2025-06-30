import mongoose, { Document, Schema } from "mongoose";
import { IUser } from "./user.models";
import { ITransaction } from "./transaction.model";




export type ReminderType = 'bill' | 'subscription' | 'debt' | 'custom';
export type ReminderFrequency = 'once' | 'daily' |  'weekly' | 'monthly' | 'yearly';
export type NotificationMethod = 'email' | 'push' | 'both';


export interface IReminder extends Document {
    name: string;
    type: ReminderType;
    amount?: number;
    dueDate: Date;
    frequency: ReminderFrequency;
    user: IUser['_id'];
    transaction?: ITransaction['_id'];
    category?: string;
    notes?: string;
    isActive: boolean;
    notification: {
      method: NotificationMethod;
      daysBefore: number[];
      lastSent?: Date;
    };
    createdAt: Date;
    updatedAt: Date;
  }

  const reminderSchema = new Schema<IReminder>(
    {
        name: { type: String, required: [true, 'Reminder name is required'] },
        type: { 
          type: String, 
          enum: ['bill', 'subscription', 'debt', 'custom'], 
          required: [true, 'Type is required'] 
        },
        amount: { type: Number },
        dueDate: { type: Date, required: [true, 'Due date is required'] },
        frequency: { 
          type: String, 
          enum: ['once', 'daily', 'weekly', 'monthly', 'yearly'], 
          required: [true, 'Frequency is required'] 
        },
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        transaction: { type: Schema.Types.ObjectId, ref: 'Transaction' },
        category: { type: String },
        notes: { type: String },
        isActive: { type: Boolean, default: true },
        notification: {
          method: { 
            type: String, 
            enum: ['email', 'push', 'both'], 
            default: 'both' 
          },
          daysBefore: { 
            type: [Number], 
            default: [1, 3, 7],
            validate: {
              validator: (days: number[]) => days.every(d => d >= 0 && d <= 30),
              message: 'Days before must be between 0 and 30'
            }
          },
          lastSent: { type: Date }
        }
      },
      { timestamps: true }
  )

  //  Indexes for frequently queried fields
  reminderSchema.index({ user: 1, dueDate: 1});
  reminderSchema.index({ user: 1, isActive: 1});
  reminderSchema.index({ dueDate: 1, isActive: 1});

  export const Reminder = mongoose.model("Reminder", reminderSchema);