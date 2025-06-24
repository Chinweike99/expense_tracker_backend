import { Request, Response } from "express";
import { z } from "zod";
import { Category } from "../models/category.model";
import { Budget, getPeriodEndDate, getPeriodStartDate } from "../models/budget.models";
import mongoose from "mongoose";
import { calculateSpendingForecast, checkBudgetThresholds } from "../services/forecast.service";



const createBudgetSchema = z.object({
    name: z.string().min(1),
    amount: z.number().positive(),
    period: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
    startDate: z.string().datetime(),
    endDate: z.string().datetime().optional(),
    category: z.string().optional(),
    isRecurring: z.boolean().optional(),
    rollover: z.object({
      type: z.enum(['none', 'full', 'partial']),
      maxAmount: z.number().positive().optional(),
    }).optional(),
    notifications: z.object({
      enabled: z.boolean().optional(),
      threshold: z.number().min(0).max(100).optional(),
    }).optional(),
  });


const updateBudgetSchema = createBudgetSchema.partial();


export const createBudget = async(req: Request, res: Response): Promise<void> => {
     console.log("Endpoint Hit")
    try {
            const userId = req.user.id;
            const input = createBudgetSchema.parse(req.body);

            if(input.category){
                const category = await Category.findOne({
                    _id: input.category,
                    $or: [ { user: userId }, { isDefault: true }]
                });
                if(!category) {
                    res.status(400).json({ message: 'Category not found'});
                    return 
                }
            }

            // Handle rollover defaults
            const rollover = input.rollover || { type: 'none' };

            // Handles notification
            const notifications = input.notifications || {
                enabled: true,
                threshold: 80
            };

            const budget = await Budget.create({
                ...input,
                user: userId,
                rollover,
                notifications,
                startDate: new Date(input.startDate),
                endDate: input.endDate ? new Date(input.endDate) : undefined,
            })
            res.status(201).json(budget)
    } catch (error) {
        console.log(error)
        if (error instanceof z.ZodError) {
            res.status(400).json({
              message: 'Validation failed',
              errors: error.errors,
            });
            return 
          }
          res.status(500).json({ message: 'Budget not created' });
    }
}


export const getBudgets = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { period, active } = req.query;
  
      const filter: any = { user: userId };
      if (period) filter.period = period;
      if (active === 'true') {
        const now = new Date();
        filter.$or = [
          { endDate: { $gte: now } },
          { endDate: { $exists: false } }
        ];
      }
  
      const budgets = await Budget.find(filter)
        .populate('category', 'name icon color')
        .sort({ startDate: -1 });
  
      res.status(200).json(budgets);
    } catch (error) {
      res.status(500).json({ message: 'Something went wrong' });
    }
  };



export const getBudget = async(req: Request, res:Response): Promise<void> => {
    try {
        const userId = req.user.id;
        const budget = await Budget.findOne({
            _id: req.params.id,
            user: userId
        }).populate('category', 'name icon color');

        if(!budget){
             res.status(404).json({
                status: "Failed",
                message: 'Budget not found'
            });
            return
        }
        res.status(200).json(budget);
    } catch (error) {
        console.log("Error geting budgets")
        res.status(500).json({
            status: "Failed",
            message: 'Unable to get budget'
        })
    }
}


export const updateBudget = async(req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user.id;
        const update = updateBudgetSchema.parse(req.body);

        const parsedUpdate = {
            ...update,
            startDate: update.startDate ? new Date(update.startDate) : undefined,
            endDate: update.endDate ? new Date(update.endDate) : undefined
          };

        // Validate  category exists if provided
        if(parsedUpdate.category){
            const categ = await Category.findOne({
                _id: parsedUpdate.category,
                $or: [{ user: userId }, { isDefault: true}]
            });
            if(!categ){
                 res.status(400).json({
                    status: "Fail",
                    message: "Category not found"
                });
                return
            }
        }

        const budget = await Budget.findOneAndUpdate(
            {_id: req.params.id, user: userId},
            parsedUpdate,
            {new: true}
        ).populate('category', 'name icon color');

        if(!budget){
             res.status(404).json({
                status: "Failed",
                message: "Budget not found"
            })
            return 
        }
       res.status(200).json(budget)

    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
              message: 'Validation failed',
              errors: error.errors,
            });
            return 
          }
          res.status(500).json({ message: 'Something went wrong trying to update budget' });
        }
}


export const deleteBudget = async(req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const budget = await Budget.findByIdAndDelete({
            _id: req.params.id,
            user: userId
        });

        if(!budget){
            res.status(404).json({
                status: "Failed",
                message: "Budget not found"
            })
        }
        res.status(204).json()

    } catch (error) {
        res.status(500).json({ message: 'Something went wrong trying to delete budget' });
    }
}


export const getBudgetProgress = async(req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user.id;
        const  budget = await Budget.findOne({
            _id: req.params.id,
            user: userId
        }).populate('category', 'name icon color').select('+spendAmount +remainingAmount +progressPercentage');

        if(!budget){
             res.status(404).json({message: 'Budget not found'});
             return
        }

        res.status(200).json({
            budget: {
                _id: budget._id,
                name: budget.name,
                amount: budget.amount,
                period: budget.period,
                category: budget.category
            },
            spent: budget.spendAmount || 0,
            remaining: budget.remainingAmount || 0,
            progress: budget.progressPercentage || 0,
            periodStart: budget.startDate,
            periodEnd: budget.endDate || getPeriodEndDate(budget.period, new Date())
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Cannont get budget progress"
        })
    }
}



export const getSpendingForecast = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const period = req.query.period === 'year' ? 'year' : 'month';
      
      const forecast = await calculateSpendingForecast(userId, period);
  
      // Get category details for the forecast
      const categoryIds = Object.keys(forecast).filter(id => mongoose.Types.ObjectId.isValid(id));
      const categories = await Category.find({ _id: { $in: categoryIds } });
  
      const result = Object.entries(forecast).map(([categoryId, data]) => {
        const category = categories.find(cat => (cat._id as any).equals(categoryId));
        return {
          category: {
            id: categoryId,
            name: category?.name || 'Uncategorized',
            icon: category?.icon || 'question',
            color: category?.color || '#999999',
          },
          average: data.average,
          trend: data.trend,
          historicalData: data.totals,
        };
      });
  
      res.status(200).json({
        period,
        forecast: result,
      });
    } catch (error) {
      res.status(500).json({ message: 'Something went wrong' });
    }
  };


  export const getBudgetAlerts = async(req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user.id;
        const alerts = await checkBudgetThresholds(userId);
        if(!alerts) {
            res.status(200).json({ message: 'No alerts' });
        }

        res.status(200).json({
            success: true,
            message: "Alert sent",
            data: alerts
        })
    } catch (error) {
        // console.log("Unable to get budgets", error)
        res.status(500).json({
            success: false,
            message: "Budget Alert Errors"
        })
    }
  }


  export const processBudgetRollovers = async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const now = new Date();

        // Find budgets that needs rollover processing
        const budgets = await Budget.find({
            user: userId,
            isRecurring: true,
            $or: [
                { endDate: {$lte: now}},
                {
                    $expr: {
                        $lte: [
                            { $dateToString: {format: "%Y-%m-%d", date: "$endDate"}},
                            { $dateToString: {format: "%Y-%m-%d", date: now}},
                        ]
                    }
                }
            ]
        });

        const results = [];
        for (const budget of budgets){
            // Calculate remaining amount
            const spent = budget.spendAmount || 0;
            const remaining = budget.amount - spent;

            // Determine rollover amount based on type;
            let rolloverAmount = 0;
            if(budget.rollover.type === 'full') {
                rolloverAmount = remaining;
            }else if(budget.rollover.type === 'partial' && budget.rollover.maxAmount){
                rolloverAmount = Math.min(remaining, budget.rollover.maxAmount);
            };
            if(rolloverAmount > 0) {
                const newBudget = await Budget.create({
                    name: budget.name,
                    amount: budget.amount + rolloverAmount,
                    period: budget.period,
                    startDate: getNextPeriodStartDate(budget.period, budget.endDate || new Date()),
                    endDate: getNextPeriodEndDate(budget.period, budget.endDate || new Date()),
                    category: budget.category,
                    user: budget.user,
                    isRecurring: budget.isRecurring,
                    rollover: budget.rollover,
                    notifications: budget.notifications
                });
                results.push({
                    oldBudgetId: budget._id,
                    newBudgetId: newBudget._id,
                    rolloverAmount,
                    newAmount: newBudget.period,
                    period: newBudget.period,
                    startDate: newBudget.startDate,
                    endDate: newBudget.endDate
                })
            
            }
            if(!budget.endDate) {
                await Budget.findByIdAndUpdate(budget._id, {isRecurring: false})
            }
        }

        res.status(200).json({
            processed: results.length,
            results
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to process Budget Rollovers"
        })
    }
  }

// Function to get next period start date
function getNextPeriodStartDate(period: string, date: Date) : Date {
    const d = new Date(date);
    switch(period) {
        case 'weekly':
            d.setDate(d.getDate() + 7);
            break;
        case 'monthly':
            d.setMonth(d.getMonth() + 1, 1);
            break;
        case 'quarterly':
            d.setMonth(d.getMonth() + 3, 1);
            break;
        case 'yearly':
            d.setFullYear(d.getFullYear() + 1, 0, 1);
            break;
    }
    d.setHours(0, 0, 0, 0);
    return d;
}


// Helper function to get next period end date
function getNextPeriodEndDate(period: string, date: Date): Date {
    const d = new Date(date);
    switch (period) {
      case 'weekly':
        d.setDate(d.getDate() + 13); 
        break;
      case 'monthly':
        d.setMonth(d.getMonth() + 2, 0); 
        break;
      case 'quarterly':
        d.setMonth(d.getMonth() + 6, 0);
        break;
      case 'yearly':
        d.setFullYear(d.getFullYear() + 2, 11, 31);
        break;
    }
    d.setHours(23, 59, 59, 999);
    return d;
  }
  




