const express = require('express');
const router = express.Router();
const CategoryController = require('../controllers/categoryController');
const authMiddleware = require('../middleware/authMiddleware');
const {
    categoryValidation,
    uuidParamValidation
} = require('../middleware/validator');

// All routes require authentication
router.use(authMiddleware);

// Category CRUD routes
router.get('/', CategoryController.getAllCategories);
router.get('/:id', uuidParamValidation, CategoryController.getCategory);
router.post('/', categoryValidation, CategoryController.createCategory);
router.put('/:id', uuidParamValidation, categoryValidation, CategoryController.updateCategory);
router.delete('/:id', uuidParamValidation, CategoryController.deleteCategory);

module.exports = router;
