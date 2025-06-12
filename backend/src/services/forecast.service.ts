import moment from "moment";
import { Transaction } from "../models/transaction.model";
import mongoose from "mongoose";



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
            const categoryId = tx._id.catgeory.toString();
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
            }
        }


    } catch (error) {
        
    }
}


