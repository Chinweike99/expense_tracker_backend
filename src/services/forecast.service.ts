import moment from "moment";
import { Transaction } from "../models/transaction.model";
import mongoose from "mongoose";
import { Budget } from "../models/budget.models";
import { ICategory } from "../models/category.model";



export const calculateSpendingForecast = async (userId: string, period: 'month' | 'year') => {
    try {
        
        const endDate = new Date();
        const startDate = period === "month" ? moment(endDate).subtract(6, 'months').toDate() : moment(endDate).subtract(2, 'years').toDate();

        const transactions = await Transaction.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    type: 'expense',
                    date: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$date' },
                        month: { $month: '$date' },
                        category: '$category'
                      },
                      total: { $sum: '$amount' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ])

        // Group by category and calculate averages
        
        const categoryForecasts: Record<string, any> = {};

        transactions.forEach(tx => {
            const categoryId = tx._id.category.toString();
            if(!categoryForecasts[categoryId]){
                categoryForecasts[categoryId] = {
                    totals: [],
                    average: 0,
                    trend: 0
                }
            }
            categoryForecasts[categoryId].totals.push(tx.total);
        });

        // Calculate averages and trends
        for (const categoryId in categoryForecasts) {
            const data = categoryForecasts[categoryId];
            if(data.totals.length > 0) {
                data.average = data.totals.reduce((sum: number, val: number) => sum + val, 0) / data.totals.length;

                // Simple trend claculation (linear rrgression slope)
                if(data.totals.length > 1) {
                  
                    const x = data.totals.map((_: any, i: number) => i);
                    const y = data.totals;
                    const n = y.length;

                    const sumX = x.reduce((a: number, b: number) => a + b, 0);
                    const sumY = y.reduce((a: number, b: number) => a + b, 0);
                    const sumXY = x.reduce((a: number, b: number, i: number) => a + b * y[i], 0);
                    const sumXX = x.reduce((a: number, b: number) => a + b * b, 0);

                    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
                    data.trend = slope / data.avergae * 100; // Percentage change per period
                }
            }
        }

        return categoryForecasts;
    } catch (error) {
        console.error('Error calculating spending forecast:', error);
        throw error;
    }
}


export const checkBudgetThresholds = async (userId?: string) => {
    try {
        const budgets = await Budget.find({
            user: userId,
            'notifications.enabled': true
        }).populate('category', 'name');

        const alerts = [];
        const now = new Date();

        for (const budget of budgets){
            const progress = budget.progressPercentage || 0;
            if (progress >= budget.notifications.threshold){
                alerts.push({
                    budgetId: budget._id,
                    budgetName: budget.name,
                    category: (budget.category as ICategory).name || 'Uncategorized',
                    amount: budget.amount,
                    spent: budget.spendAmount || 0,
                    remaining: budget.remainingAmount || 0,
                    progress: Math.round(progress),
                    threshold: budget.notifications.threshold,
                    period: budget.period,
                    periodStart: getPeriodStartDate(budget.period, now),
                    periodEnd: getPeriodEndDate(budget.period, now)
                })
            }
        }

        return alerts;
    } catch (error) {
      console.error('Error checking budget thresholds:', error);
      throw error;
    }
}



function getPeriodStartDate(period: string, date: Date) :Date {
    const d = new Date(date);
    switch (period){
        case 'weekly':{
      d.setDate(d.getDate() - d.getDay());
      break;
        }
    case 'monthly': {
      d.setDate(1);
      break;
    }
    case 'quarterly': {
      const quarter = Math.floor(d.getMonth() / 3);
      d.setMonth(quarter * 3, 1);
      break;
    }
    case 'yearly':{
      d.setMonth(0, 1);
      break;
    }
    }
    d.setHours(0, 0, 0, 0);
  return d;
}


// Helper function to get period end date (same as in budget model)
function getPeriodEndDate(period: string, date: Date): Date {
    const d = new Date(date);
    switch (period) {
      case 'weekly':
        d.setDate(d.getDate() + (6 - d.getDay()));
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




