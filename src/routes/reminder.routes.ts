import express from 'express';
import {
  createReminder,
  getReminders,
  updateReminder,
  deleteReminder,
  createDebt,
  getDebts,
  getDebt,
  updateDebt,
  deleteDebt,
  calculatePayoffPlan,
  recordDebtPayment,
} from '../controllers/reminder.controller';
import { protect } from '../controllers/auth.controllers';

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);

// Reminder routes
router.route('/reminders')
  .post(createReminder)
  .get(getReminders);

router.route('/reminders/:id')
  .patch(updateReminder)
  .delete(deleteReminder);

// Debt routes
router.route('/debts')
  .post(createDebt)
  .get(getDebts);
// 
router.route('/debts/:id')
  .get(getDebt)
  .patch(updateDebt)
  .delete(deleteDebt);

// Debt payoff calculation
router.get('/debts/:id/payoff-plan', calculatePayoffPlan);

// Record debt payment
router.post('/debts/:id/payment', recordDebtPayment);

export default router;