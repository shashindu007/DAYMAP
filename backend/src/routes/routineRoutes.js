const express = require('express');
const router = express.Router();
const RoutineController = require('../controllers/routineController');
const authMiddleware = require('../middleware/authMiddleware');
const {
    uuidParamValidation,
    dateParamValidation,
    routineTemplateCreateValidation,
    routineTemplateUpdateValidation,
    routineInstanceItemUpdateValidation
} = require('../middleware/validator');

// All routes require authentication
router.use(authMiddleware);

// Routine CRUD routes
router.get('/', RoutineController.getAllRoutines);
router.get('/daily/:date', dateParamValidation, RoutineController.getDailyRoutine);
router.get('/analytics/:date', dateParamValidation, RoutineController.getRoutineAnalytics);
router.get('/:id', uuidParamValidation, RoutineController.getRoutine);
router.post('/', routineTemplateCreateValidation, RoutineController.createRoutine);
router.put('/:id', uuidParamValidation, routineTemplateUpdateValidation, RoutineController.updateRoutine);
router.delete('/:id', uuidParamValidation, RoutineController.deleteRoutine);

// Routine actions
router.patch('/:id/activate', uuidParamValidation, RoutineController.toggleActive);
router.post('/:id/apply', uuidParamValidation, RoutineController.applyRoutine);
router.patch('/instances/:id/items/:itemId', uuidParamValidation, routineInstanceItemUpdateValidation, RoutineController.updateRoutineInstanceItem);
router.patch('/instances/:id/items/:itemId/complete', uuidParamValidation, RoutineController.completeRoutineInstanceItem);

module.exports = router;
