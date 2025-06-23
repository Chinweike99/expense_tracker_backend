import { Request, Response } from "express";
import { z } from "zod";
import { Category } from "../models/category.model";
import { Budget } from "../models/budget.models";



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


export const createBudget = async(req: Request, res: Response) => {
    try {
            const userId = req.user.id;
            const input = createBudgetSchema.parse(req.body);

            if(input.category){
                const category = await Category.findOne({
                    _id: input.category,
                    $or: [ { user: userId }, { isDefault: true }]
                });
                if(!category) {
                    return res.status(400).json({ message: 'Category not found'})
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
        if (error instanceof z.ZodError) {
            return res.status(400).json({
              message: 'Validation failed',
              errors: error.errors,
            });
          }
          res.status(500).json({ message: 'Budget not created' });
    }
}


export const getBudget = async(req: Request, res:Response) => {
    try {
        const userId = req.user.id;
        const budget = await Budget.findOne({
            _id: req.params.id,
            user: userId
        }).populate('category', 'name icon color');

        if(!budget){
            return res.status(404).json({
                status: "Failed",
                message: 'Budget not found'
            })
        }
        res.status(200).json(budget);
    } catch (error) {
        res.status(500).json({
            status: "Failed",
            message: 'Unable to get budget'
        })
    }
}


export const updateBudget = async(req: Request, res: Response) => {
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
                return res.status(400).json({
                    status: "Fail",
                    message: "Category not found"
                })
            }
        }

        const budget = await Budget.findOneAndUpdate(
            {_id: req.params.id, user: userId},
            parsedUpdate,
            {new: true}
        ).populate('category', 'name icon color');

        if(!budget){
            return res.status(404).json({
                status: "Failed",
                message: "Budget not found"
            })
        }
       res.status(200).json(budget)

    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
              message: 'Validation failed',
              errors: error.errors,
            });
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


export const getBudgetProgress = async(req: Request, res: Response) => {
    try {
        
    } catch (error) {
        
    }
}






