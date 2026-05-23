const express = require('express');
const router = express.Router();
const ScheduleController = require('../controllers/scheduleController');
const authMiddleware = require('../middleware/authMiddleware');
const {
    uuidParamValidation,
    dateParamValidation,
    scheduleValidation,
    scheduleSlotsValidation,
    scheduleTaskStatusValidation,
    scheduleTaskUpdateValidation,
    scheduleRangeQueryValidation
} = require('../middleware/validator');

router.use(authMiddleware);

router.get('/today', ScheduleController.getTodaySchedule);
router.get('/tomorrow', ScheduleController.getTomorrowSchedule);
router.get('/range', scheduleRangeQueryValidation, ScheduleController.getScheduleRange);
router.get('/:date', dateParamValidation, ScheduleController.getScheduleByDate);
router.post('/', scheduleValidation, ScheduleController.createOrReplaceSchedule);
router.put('/:date', dateParamValidation, scheduleSlotsValidation, ScheduleController.replaceScheduleForDate);
router.patch('/tasks/:id/status', uuidParamValidation, scheduleTaskStatusValidation, ScheduleController.updateScheduleTaskStatus);
router.patch('/tasks/:id', uuidParamValidation, scheduleTaskUpdateValidation, ScheduleController.updateScheduleTask);
router.delete('/tasks/:id', uuidParamValidation, ScheduleController.deleteScheduleTask);
router.delete('/:date', dateParamValidation, ScheduleController.deleteScheduleByDate);

module.exports = router;
