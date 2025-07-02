import express from 'express';
import {
  createBudget,
  getBudgets,
  getBudget,
  updateBudget,
  deleteBudget,
  getBudgetProgress,
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

// Budget alerts
router.get('/budgets/alerts', getBudgetAlerts);
router.post('/budgets/process-rollovers', processBudgetRollovers);
// router.post('/budgets/process-rollovers', processBudgetRollovers);


router.route('/budgets/:id')
  .get(getBudget)
  .patch(updateBudget)
  .delete(deleteBudget);

// Budget progress
router.get('/budgets/:id/progress', getBudgetProgress);



router.get('/test', (req, res) => {
    res.send("Test route works!");
  });

export default router;