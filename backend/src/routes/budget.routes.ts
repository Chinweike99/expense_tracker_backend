import express from 'express';
import {
  createBudget,
  getBudgets,
  getBudget,
  updateBudget,
  deleteBudget,
  getBudgetProgress,
  getSpendingForecast,
  getBudgetAlerts,
  processBudgetRollovers,
} from '../controllers/budget.controller';
import { protect } from '../controllers/auth.controllers';
// import { protect } from '../controllers/auth.controller';

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);

// Budget CRUD routes
router.route('/budgets')
  .post(createBudget)
  .get(getBudgets);

router.route('/budgets/:id')
  .get(getBudget)
  .patch(updateBudget)
  .delete(deleteBudget);

// Budget progress
router.get('/budgets/:id/progress', getBudgetProgress);

// Spending forecast
router.get('/budgets/forecast', getSpendingForecast);

// Budget alerts
router.get('/budgets/alerts', getBudgetAlerts);

// Budget rollover processing (typically called by a cron job)
router.post('/budgets/process-rollovers', processBudgetRollovers);

export default router;