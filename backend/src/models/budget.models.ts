import mongoose, { Document, Schema } from "mongoose";
import { ICategory } from "./category.model";
import { IUser } from "./user.models";



export type BudgetPeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type RolloverType = 'none' | 'full' | 'partial';

export interface IBudget extends Document {
    name: string;
    amount: number;
    period: BudgetPeriod;
    startDate: Date;
    endDate?: Date;
    category?: ICategory['_id'];
    user: IUser['_id'];
    isRecurring: boolean;
    rollover: {
        type: RolloverType;
        maxAmount?: boolean;
    };
    notifications: {
        enabled: boolean;
        threshold: number;
    };
    createdAt: Date;
    updatedAt: Date;
    spendAmount?: number;
    remainingAmount?: number;
    progressPercentgae?: number;
};


const budgetSchema = new Schema<IBudget>(
    {
        name: { type: String, required: [true, 'Budget name is required'] },
        amount: { type: Number, required: [true, 'Amount is required'], min: 0 },
        period: { 
          type: String, 
          enum: ['weekly', 'monthly', 'quarterly', 'yearly'], 
          required: [true, 'Period is required'] 
        },
        startDate: { type: Date, required: [true, 'Start date is required'] },
        endDate: { type: Date },
        category: { type: Schema.Types.ObjectId, ref: 'Category' },
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        isRecurring: { type: Boolean, default: false },
        rollover: {
          type: { 
            type: String, 
            enum: ['none', 'full', 'partial'], 
            default: 'none' 
          },
          maxAmount: { type: Number },
        },
        notifications: {
          enabled: { type: Boolean, default: true },
          threshold: { type: Number, default: 80 }, // percentage
        },
      },
      { 
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
      }
)

// Add indexes for performance
budgetSchema.index({ user: 1, startDate: 1 });
budgetSchema.index({ user: 1, category: 1 });
budgetSchema.index({ user: 1, isRecurring: 1 });


// Virtual for spent amount
budgetSchema.virtual('spendAmount', {
    ref: 'Transaction',
    localField: '_id',
    foreignField: 'budget',
    match: { type: 'expense' },
    options: {
        match: {
            date: {
                $gte: function(this: IBudget){
                    return getPeriodStartDate(this.period, new Date());
                },
                $lte: function(this: IBudget) {
                    return getPeriodEndDate(this.period, new Date())
                }
            }
        }
    },
    pipeline: [
        { $group:{ _id:null, total: { $sum: '$amount' } } }
    ],
});


// Virtual for remaining amount
budgetSchema.virtual('remainingAmount').get(function(this: IBudget) {
    return this.amount - (this.spendAmount || 0)
});

// Virtual for progress percentatge
budgetSchema.virtual('progressPercentage').get(function(this: IBudget) {
    return Math.min(100, ((this.spendAmount || 0) / this.amount) * 100);
})

// Helper function to get period start Date
function getPeriodStartDate(period: BudgetPeriod, date: Date) : Date {
    const d =  new Date(date);
    switch (period){
        case 'weekly':
            d.setDate(d.getDate() - d.getDay());
            break;
        case 'monthly':
            d.setDate(1);
            break;
        case 'quarterly':
            const quarter = Math.floor(d.getMonth() / 3)
            d.setMonth( quarter * 3, 1);
            break;
        case 'yearly':
            d.setMonth(0, 1);
            break;
    }
    d.setHours(0, 0, 0, 0);
    return d;
}


function getPeriodEndDate(period: BudgetPeriod, date: Date): Date {
    const d = new Date(date);
    switch (period) {
      case 'weekly':
        d.setDate(d.getDate() + (6 - d.getDay())); // End of week (Saturday)
        break;
      case 'monthly':
        d.setMonth(d.getMonth() + 1, 0);
        break;
      case 'quarterly':
        const quarter = Math.floor(d.getMonth() / 3);
        d.setMonth((quarter * 3) + 3, 0);
        break;
      case 'yearly':
        d.setMonth(11, 31);
        break;
    }
    d.setHours(23, 59, 59, 999);
    return d;
  }


export {getPeriodStartDate};

export const Budget = mongoose.model<IBudget>("Budget", budgetSchema);