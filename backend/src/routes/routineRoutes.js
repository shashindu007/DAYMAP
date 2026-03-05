const express = require('express');
const router = express.Router();
const RoutineController = require('../controllers/routineController');
const authMiddleware = require('../middleware/authMiddleware');
const {
    routineValidation,
    uuidParamValidation
} = require('../middleware/validator');

// All routes require authentication
router.use(authMiddleware);

// Routine CRUD routes
router.get('/', RoutineController.getAllRoutines);
router.get('/:id', uuidParamValidation, RoutineController.getRoutine);
router.post('/', routineValidation, RoutineController.createRoutine);
router.put('/:id', uuidParamValidation, routineValidation, RoutineController.updateRoutine);
router.delete('/:id', uuidParamValidation, RoutineController.deleteRoutine);

// Routine actions
router.patch('/:id/activate', uuidParamValidation, RoutineController.toggleActive);
router.post('/:id/apply', uuidParamValidation, RoutineController.applyRoutine);

module.exports = router;
