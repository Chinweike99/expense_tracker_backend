import express from 'express';
import { protect } from '../controllers/auth.controllers';
import { createTransaction, createTransfer, deleteTransaction, getRecurringTransactions, getTransaction, getTransactions, updateRecurringTransactions, updateTransaction } from '../controllers/transaction.controller';
import { createCategory, deleteCategory, getCategories, seedDefaultCategories, updateCategory } from '../controllers/category.controller';


const router = express.Router();

// Protect all routes after this middleware
router.use(protect);


// Transaction routes
router.route('/transactions')
  .post(createTransaction)
  .get(getTransactions);

router.route('/transactions/:id')
  .get(getTransaction)
  .patch(updateTransaction)
  .delete(deleteTransaction);

// Transfer route
router.post('/transactions/transfer', createTransfer);

// Recurring transactions
router.get('/transactions/recurring', getRecurringTransactions);
router.patch('/transactions/recurring/:id', updateRecurringTransactions);

// Category routes
router.route('/categories')
  .post(createCategory)
  .get(getCategories);

router.route('/categories/:id')
  .patch(updateCategory)
  .delete(deleteCategory);

router.post('/categories/seed-defaults', seedDefaultCategories);

export default router;
