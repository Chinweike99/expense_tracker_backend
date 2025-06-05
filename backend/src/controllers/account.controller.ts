import { Request, Response } from "express";
import { z } from "zod";
import { Currency } from "../models/currency.model";
import { Account } from "../models/account.models";
import { updateExchangeRate } from "../services/exchange.service";



const createAccountSchema = z.object({
    name: z.string().min(2),
  type: z.enum(['cash', 'bank', 'credit card', 'investment', 'loan', 'other']),
  balance: z.number().default(0),
  currency: z.string().length(3).toUpperCase(),
})


const updateAccountSchema = createAccountSchema.partial();

const createCurrencySchema = z.object({
    code: z.string().length(3).toUpperCase(),
    name: z.string().min(1),
    symbol: z.string().min(1),
    isPrimary: z.boolean().optional(),
  });
  

export const createAccount = async(req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const {name, type, balance, currency} = createAccountSchema.parse(req.body);

        const currencyExist = await Currency.findOne({user: userId, code: currency});
        if(!currencyExist){
            return res.status(400).json({message: "Currency not found. Please add it first"})
        };

        const account = await Account.create({
            name, type, balance, currency, user: userId
        })
        res.status(201).json(account);
    } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            message: 'Validation failed',
            errors: error.errors,
          });
        }
        res.status(500).json({ message: 'Something went wrong' });
      }
} 



export const getAccount = async(req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const account = await Account.findOne({_id: req.params.id, user: userId});
        if(!account){
            return res.status(404).json({message: "Account not found"})
        };
        res.status(200).json(account)
    }  catch (error) {
        res.status(500).json({ message: 'Something went wrong' });
      }
}


export const updateAccount = async(req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
    const updates = updateAccountSchema.parse(req.body);

    const account = await Account.findOneAndUpdate(
        { _id: req.params.id, user: userId },
        updates,
        { new: true, runValidators: true }
      );

 if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    res.status(200).json(account);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: error.errors,
      });
    }
    res.status(500).json({ message: 'Something went wrong' });
  }
}


export const deleteAccount = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const account = await Account.findOneAndUpdate(
        { _id: req.params.id, user: userId },
        { isActive: false },
        { new: true }
      );
  
      if (!account) {
        return res.status(404).json({ message: 'Account not found' });
      }
  
      res.status(204).json();
    } catch (error) {
      res.status(500).json({ message: 'Something went wrong' });
    }
  };


  export const addCurrency = async(req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const { code, name, symbol, isPrimary} = createCurrencySchema.parse(req.body);

        if(isPrimary){
            await Currency.updateMany(
                {user: userId, isPrimary: true},
                {isPrimary: false}
            )
        }

        const currency = await Currency.create({
            code, name, symbol, user: userId,
            isPrimary: isPrimary || false
        });

        // If this is the first currency, set as primary
        const currenciesCount = await Currency.countDocuments({user: userId});
        if(currenciesCount === 1){
            await Currency.findByIdAndUpdate(currency._id, {isPrimary: true});
            currency.isPrimary = true;
        };

        if(!currency.isPrimary){
            const primaryCurrency = await Currency.findOne({user: userId, isPrimary: true});
            if(primaryCurrency){
                await updateExchangeRate(userId, primaryCurrency.code);
            }
        }
        res.status(201).json(currency);

    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
              message: 'Validation failed',
              errors: error.errors,
            });
          }
          res.status(500).json({ message: 'Something went wrong' });
    }
  }



  export const getCurrency = async(req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const currencies = await Currency.find({user: userId});
        res.status(200).json(currencies)
    } catch (error) {
        res.status(500).json({ message: 'Something went wrong' });
    }
  }


export const setPrimaryCurrency = async(req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const currencyId = req.params.id;

        // First, unset any existing primary currency
        await Currency.updateMany(
            {user: userId, isPrimary: true},
            {isPrimary: false}
        );
        // Set the new primary currency
        const currency = await Currency.findByIdAndUpdate(
            { _id: currencyId, user: userId },
            {isPrimary: true},
            {new: true}
        );

        if (!currency) {
            return res.status(404).json({ message: 'Currency not found' });
          }

          // Update all exchange rates based on the new primary currency
          await updateExchangeRate(userId, currency.code)
          res.status(200).json(currency)

    } catch (error) {
        res.status(500).json({ message: 'Something went wrong' });
    }
}





