const scheduleService = require('../services/scheduleService');

class ScheduleController {
    static async getScheduleByDate(req, res) {
        try {
            const { date } = req.params;
            const result = await scheduleService.getScheduleByDate(req.user.id, date);

            res.json({
                success: true,
                data: {
                    date,
                    schedule: result.schedule,
                    tasks: result.tasks,
                    count: result.tasks.length
                }
            });
        } catch (error) {
            console.error('Get schedule by date error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching schedule',
                error: error.message
            });
        }
    }

    static async getTodaySchedule(req, res) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const result = await scheduleService.getScheduleByDate(req.user.id, today);

            res.json({
                success: true,
                data: {
                    date: today,
                    schedule: result.schedule,
                    tasks: result.tasks,
                    count: result.tasks.length
                }
            });
        } catch (error) {
            console.error('Get today schedule error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching today schedule',
                error: error.message
            });
        }
    }

    static async getTomorrowSchedule(req, res) {
        try {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowDate = tomorrow.toISOString().split('T')[0];
            const result = await scheduleService.getScheduleByDate(req.user.id, tomorrowDate);

            res.json({
                success: true,
                data: {
                    date: tomorrowDate,
                    schedule: result.schedule,
                    tasks: result.tasks,
                    count: result.tasks.length
                }
            });
        } catch (error) {
            console.error('Get tomorrow schedule error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching tomorrow schedule',
                error: error.message
            });
        }
    }

    static async getScheduleRange(req, res) {
        try {
            const { start_date, end_date } = req.query;
            const tasks = await scheduleService.getScheduleRange(req.user.id, start_date, end_date);

            res.json({
                success: true,
                data: {
                    start_date,
                    end_date,
                    tasks,
                    count: tasks.length
                }
            });
        } catch (error) {
            console.error('Get schedule range error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching schedules',
                error: error.message
            });
        }
    }

    static async createOrReplaceSchedule(req, res) {
        try {
            const { date, slots = [], replaceExisting = false } = req.body;
            const result = await scheduleService.createOrReplaceSchedule(req.user.id, date, slots, replaceExisting);

            res.status(201).json({
                success: true,
                message: 'Schedule saved successfully',
                data: {
                    date,
                    schedule: result.schedule,
                    tasks: result.tasks,
                    count: result.tasks.length
                }
            });
        } catch (error) {
            console.error('Create schedule error:', error);
            res.status(400).json({
                success: false,
                message: error.message || 'Error creating schedule',
                error: error.message
            });
        }
    }

    static async replaceScheduleForDate(req, res) {
        try {
            const { date } = req.params;
            const { slots = [] } = req.body;
            const result = await scheduleService.replaceScheduleForDate(req.user.id, date, slots);

            res.json({
                success: true,
                message: 'Schedule updated successfully',
                data: {
                    date,
                    schedule: result.schedule,
                    tasks: result.tasks,
                    count: result.tasks.length
                }
            });
        } catch (error) {
            console.error('Replace schedule error:', error);
            res.status(400).json({
                success: false,
                message: error.message || 'Error updating schedule',
                error: error.message
            });
        }
    }

    static async updateScheduleTask(req, res) {
        try {
            const updated = await scheduleService.updateScheduleTask(req.user.id, req.params.id, req.body);

            if (!updated) {
                return res.status(404).json({
                    success: false,
                    message: 'Schedule task not found'
                });
            }

            res.json({
                success: true,
                message: 'Schedule task updated',
                data: updated
            });
        } catch (error) {
            console.error('Update schedule task error:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating schedule task',
                error: error.message
            });
        }
    }

    static async updateScheduleTaskStatus(req, res) {
        try {
            const { status } = req.body;
            const updated = await scheduleService.updateScheduleTaskStatus(req.user.id, req.params.id, status);

            if (!updated) {
                return res.status(404).json({
                    success: false,
                    message: 'Schedule task not found'
                });
            }

            res.json({
                success: true,
                message: 'Schedule task status updated',
                data: updated
            });
        } catch (error) {
            console.error('Update schedule task status error:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating schedule task status',
                error: error.message
            });
        }
    }

    static async deleteScheduleTask(req, res) {
        try {
            const deleted = await scheduleService.deleteScheduleTask(req.user.id, req.params.id);

            if (!deleted) {
                return res.status(404).json({
                    success: false,
                    message: 'Schedule task not found'
                });
            }

            res.json({
                success: true,
                message: 'Schedule task deleted'
            });
        } catch (error) {
            console.error('Delete schedule task error:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting schedule task',
                error: error.message
            });
        }
    }

    static async deleteScheduleByDate(req, res) {
        try {
            const { date } = req.params;
            await scheduleService.deleteScheduleByDate(req.user.id, date);

            res.json({
                success: true,
                message: 'Schedule deleted'
            });
        } catch (error) {
            console.error('Delete schedule error:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting schedule',
                error: error.message
            });
        }
    }
}

module.exports = ScheduleController;
