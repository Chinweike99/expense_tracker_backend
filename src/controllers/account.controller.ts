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
  

export const createAccount = async(req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user.id;
        const {name, type, balance, currency} = createAccountSchema.parse(req.body);

        const currencyExist = await Currency.findOne({user: userId, code: currency});
        if(!currencyExist){
             res.status(400).json({message: "Currency not found. Please add it first"});
             return
        };

        const account = await Account.create({
            name, type, balance, currency, user: userId
        })
        res.status(201).json(account);
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

export const getAccounts = async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const accounts = await Account.find({ user: userId, isActive: true });
      res.status(200).json(accounts);
    } catch (error) {
      res.status(500).json({ 
        message: 'Unable to get accounts',
        error
      });
    }
  };
  


export const getAccount = async(req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user.id;
        const account = await Account.findOne({_id: req.params.id, user: userId});
        if(!account){
             res.status(404).json({message: "Account not found"});
             return
        };
        res.status(200).json(account)
    }  catch (error) {
        res.status(500).json({ 
          message: 'Error getting account',
          error
        });
      }
}


export const updateAccount = async(req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user.id;
    const updates = updateAccountSchema.parse(req.body);

    const account = await Account.findOneAndUpdate(
        { _id: req.params.id, user: userId },
        updates,
        { new: true, runValidators: true }
      );

 if (!account) {
        res.status(404).json({ message: 'Account not found' });
        return
    }

    res.status(200).json(account);
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


export const deleteAccount = async (req: Request, res: Response):Promise<void> => {
    try {
      const userId = req.user.id;
      const account = await Account.findOneAndUpdate(
        { _id: req.params.id, user: userId },
        { isActive: false },
        { new: true }
      );
  
      if (!account) {
        res.status(404).json({ message: 'Account not found' });
        return 
      }
  
      res.status(204).json();
    } catch (error) {
      res.status(500).json({ 
        message: 'Error deleting account',
        error
      });
    }
  };


  export const addCurrency = async(req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user.id;
        const { code, name, symbol, isPrimary} = createCurrencySchema.parse(req.body);

        const existingCurrency = await Currency.findOne({
            user: userId,
            code: code
        });
        
        if(existingCurrency){
            res.status(400).json({
                status: "failed",
                message: "Currency already exists"
            });
            return;
        }

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
        return;

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



  export const getCurrency = async(req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const currencies = await Currency.find({user: userId});
        res.status(200).json(currencies)
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: 'Unable to add currency' });
    }
  }


export const setPrimaryCurrency = async(req: Request, res: Response): Promise<void> => {
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
            res.status(404).json({ message: 'Currency not found' });
            return 
          }

          // Update all exchange rates based on the new primary currency
          await updateExchangeRate(userId, currency.code)
          res.status(200).json(currency)

    } catch (error) {
        res.status(500).json({ message: 'Unable to set Primary currecny', error });
    }
}


export const updateCurrencyRate = async(req:Request, res: Response): Promise<void> => {
    try {
        const userId = req.user.id;
    const primaryCurrency = await Currency.findOne({ user: userId, isPrimary: true });

    if (!primaryCurrency) {
        res.status(400).json({ message: 'No primary currency set' });
        return
      };

      const success = await updateExchangeRate(userId, primaryCurrency.code);
      if (!success) {
        res.status(500).json({ message: 'Failed to update exchange rates' });
        return 
      }

      const currencies = await Currency.find({user: userId});
      res.status(200).json(currencies);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update currency rate', error });
    }
};


export const deleteCurreny = async(req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user.id;
    const currencyId = req.params.id;

    // Check if this is the primary currecency
    const currency = await Currency.findOne({_id: currencyId, user: userId});
    if (!currency) {
        res.status(404).json({ message: 'Currency not found' });
        return 
      }
    if (currency.isPrimary) {
        res.status(400).json({ message: 'Cannot delete primary currency, choose a new Primary currency as to delete' });
        return
      }
      // Check if any accounts are using this currency
    const accountsUsingCurrency = await Account.countDocuments({
        user: userId,
        currency: currency.code,
        isActive: true,
      });

      if (accountsUsingCurrency > 0) {
        res.status(400).json({
          message: 'Cannot delete currency as it is being used by one or more accounts',
        });
        return 
      }
      await Currency.deleteOne({ _id: currencyId, user: userId });  
      res.status(204).json();
    } catch (error) {
        res.status(500).json({message: "Failed to delete currency", error})
    }
}



