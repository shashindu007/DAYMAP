const express = require('express');
const router = express.Router();
const TaskController = require('../controllers/taskController');
const authMiddleware = require('../middleware/authMiddleware');
const { taskCreationLimiter } = require('../middleware/rateLimiter');
const {
    taskValidation,
    taskStatusValidation,
    uuidParamValidation
} = require('../middleware/validator');

// All routes require authentication
router.use(authMiddleware);

// Task CRUD routes
router.get('/', TaskController.getAllTasks);
router.get('/today', TaskController.getTodayTasks);
router.get('/week', TaskController.getWeekTasks);
router.get('/upcoming', TaskController.getUpcomingTasks);
router.get('/:id', uuidParamValidation, TaskController.getTask);
router.post('/', taskCreationLimiter, taskValidation, TaskController.createTask);
router.put('/:id', uuidParamValidation, taskValidation, TaskController.updateTask);
router.delete('/:id', uuidParamValidation, TaskController.deleteTask);

// Task status routes
router.patch('/:id/complete', uuidParamValidation, TaskController.completeTask);
router.patch('/:id/status', uuidParamValidation, taskStatusValidation, TaskController.updateStatus);

// Bulk operations
router.post('/bulk-delete', TaskController.bulkDelete);

module.exports = router;
