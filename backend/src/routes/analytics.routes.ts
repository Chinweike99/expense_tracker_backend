import express from 'express';
import { protect } from '../controllers/auth.controllers';
import { exportTransactions, getCategoryComparison, getDashboardStats, getExpenseHeatMap, getSpendingTrends } from '../controllers/analytics.controllers';


const router = express.Router();

// Protect all routes after this middleware;
router.use(protect);

router.get('/dashboard', getDashboardStats);

// Spending trends
router.get('/analytics/trends', getSpendingTrends);

// Category comparison
router.get('/analytics/category-comparison', getCategoryComparison);

// Expense heatmap
router.get('/analytics/heatmap', getExpenseHeatMap);

// Export transactions
router.get('/analytics/export', exportTransactions);

export default router;
