const express = require('express');
const router = express.Router();
const WalletController = require('../controllers/walletController');
const authMiddleware = require('../middleware/authMiddleware');
const {
    expenseValidation,
    expenseUpdateValidation,
    budgetValidation,
    budgetUpdateValidation,
    walletPeriodQueryValidation,
    uuidParamValidation
} = require('../middleware/validator');

// All routes require authentication
router.use(authMiddleware);

// Literal paths before any /:id route
router.get('/summary', walletPeriodQueryValidation, WalletController.getSummary);
router.get('/today', WalletController.getTodaySpend);

// Expenses
router.get('/expenses', walletPeriodQueryValidation, WalletController.getExpenses);
router.post('/expenses', expenseValidation, WalletController.createExpense);
router.put('/expenses/:id', uuidParamValidation, expenseUpdateValidation, WalletController.updateExpense);
router.delete('/expenses/:id', uuidParamValidation, WalletController.deleteExpense);

// Budgets
router.get('/budgets', walletPeriodQueryValidation, WalletController.getBudgets);
router.post('/budgets', budgetValidation, WalletController.createBudget);
router.put('/budgets/:id', uuidParamValidation, budgetUpdateValidation, WalletController.updateBudget);
router.delete('/budgets/:id', uuidParamValidation, WalletController.deleteBudget);

module.exports = router;
