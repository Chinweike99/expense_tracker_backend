import { Request, Response } from "express";
import { z } from "zod";
import { Category } from "../models/category.model";
import mongoose from "mongoose";




const createCategorySchema = z.object({
    name: z.string().min(1),
    icon: z.string().min(1),
    color: z.string().min(1),
    type: z.enum(['expense', 'income']),
});

const updateCategorySchema = createCategorySchema.partial();

export const createCategory = async(req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user.id;
        const {name, icon, color, type} = createCategorySchema.parse(req.body);

        const category = await Category.create({
            name, icon, color, type, user: userId
        });
        res.status(201).json(category);

    } catch (error) {
        if (error instanceof z.ZodError) {
           res.status(400).json({
            message: 'Validation failed',
            errors: error.errors,
          });
          return
        }
        res.status(500).json({ message: 'Something went wrong' });
      }
}


export const getCategories = async(req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const {type} = req.query;
        const filter: any = {
            $or: [{user: userId}, {isDefault: true}]
        };
        if(type){
            filter.type = type
        }
        const categories = await Category.find(filter).sort({isDefault: 1, name: 1});
        res.status(201).json(categories)

    } catch (error) {
      console.log(error)
        res.status(500).json({ message: 'Unable to get Categories' });
    }
}


export const updateCategory = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user.id;
      const updates = updateCategorySchema.parse(req.body);
  
      const category = await Category.findOneAndUpdate(
        { _id: req.params.id, user: userId },
        updates,
        { new: true }
      );
  
      if (!category) {
        res.status(404).json({ message: 'Category not found' });
        return
      }
  
      res.status(200).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          message: 'Validation failed',
          errors: error.errors,
        });
        return
      }
      res.status(500).json({ message: 'Unable to update category' });
    }
  };


  export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user.id;
      const category = await Category.findOneAndDelete({
        _id: req.params.id,
        user: userId,
      });
  
      if (!category) {
        res.status(404).json({ message: 'Category not found' });
        return
      }
  
      // Check if this category is used in any transactions
      const Transaction = mongoose.model('Transaction');
      const transactionsCount = await Transaction.countDocuments({ 
        category: category._id 
      });
  
      if (transactionsCount > 0) {
        res.status(400).json({
          message: 'Cannot delete category as it is being used by one or more transactions',
        });
        return
      }
  
      res.status(204).json();
    } catch (error) {
      console.log(error)
      res.status(500).json({ message: 'Something went wrong' });
    }
  };



  export const seedDefaultCategories = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user.id;
  
      const defaultExpenseCategories = [
        { name: 'Food', icon: 'utensils', color: '#FF6384', type: 'expense' },
        { name: 'Transport', icon: 'bus', color: '#36A2EB', type: 'expense' },
        { name: 'Shopping', icon: 'shopping-bag', color: '#FFCE56', type: 'expense' },
        { name: 'Entertainment', icon: 'film', color: '#4BC0C0', type: 'expense' },
        { name: 'Bills', icon: 'file-invoice-dollar', color: '#9966FF', type: 'expense' },
      ];
  
      const defaultIncomeCategories = [
        { name: 'Salary', icon: 'money-bill-wave', color: '#47B881', type: 'income' },
        { name: 'Bonus', icon: 'gift', color: '#F7C948', type: 'income' },
        { name: 'Investment', icon: 'chart-line', color: '#14B5D0', type: 'income' },
      ];
  
      // Check if user already has default categories
      const existingCategories = await Category.countDocuments({ user: userId });
      if (existingCategories > 0) {
        res.status(400).json({ message: 'User already has categories' });
        return
      }
  
      // Create default categories
      const expenseCategories = defaultExpenseCategories.map(cat => ({
        ...cat,
        user: userId,
      }));
  
      const incomeCategories = defaultIncomeCategories.map(cat => ({
        ...cat,
        user: userId,
      }));
  
      await Category.insertMany([...expenseCategories, ...incomeCategories]);
  
      res.status(201).json({ message: 'Default categories created' });
    } catch (error) {
      console.log(error)
      res.status(500).json({ message: 'Something went wrong' });
    }
  };

  



