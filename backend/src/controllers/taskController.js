const Task = require('../models/Task');
const ScheduleTask = require('../models/ScheduleTask');
const Analytics = require('../models/Analytics');
const routineService = require('../services/routineService');
const { getUserToday, addDaysToYmd } = require('../utils/date');
const { normalizeTimeToSeconds } = require('../utils/time');

const minutesBetweenTimes = (start, end) => {
    if (!start || !end) return null;

    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);

    const startMinutes = (sH * 60) + sM;
    const endMinutes = (eH * 60) + eM;
    const diff = endMinutes - startMinutes;

    return diff > 0 ? diff : null;
};

class TaskController {
    /**
     * Get all tasks for user
     * @route GET /api/tasks
     */
    static async getAllTasks(req, res) {
        try {
            // Only accept plain string query values. Express parses `?status[$ne]=x`
            // into an object, so coercing to string (and whitelisting) prevents
            // Mongo operator injection into the filter.
            const asString = (value) => (typeof value === 'string' ? value : undefined);
            const isYmd = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
            const VALID_STATUS = ['pending', 'in_progress', 'completed', 'cancelled'];
            const VALID_PRIORITY = ['low', 'medium', 'high', 'urgent'];

            const status = asString(req.query.status);
            const priority = asString(req.query.priority);
            const category = asString(req.query.category);
            const scheduled_date = asString(req.query.scheduled_date);
            const date_from = asString(req.query.date_from);
            const date_to = asString(req.query.date_to);

            const filters = {};
            if (status && VALID_STATUS.includes(status)) filters.status = status;
            if (priority && VALID_PRIORITY.includes(priority)) filters.priority = priority;
            if (category) filters.category = category;
            if (isYmd(scheduled_date)) filters.scheduled_date = scheduled_date;
            if (isYmd(date_from) && isYmd(date_to)) {
                filters.date_from = date_from;
                filters.date_to = date_to;
            }

            const tasks = await Task.findByUser(req.user.id, filters);

            let scheduleTasks = [];
            if (filters.date_from && filters.date_to) {
                const scheduleResults = await ScheduleTask.findByDateRange(req.user.id, filters.date_from, filters.date_to);
                scheduleTasks = scheduleResults.map((task) => ({
                    ...task,
                    scheduled_time: task.slot_start_time || null
                }));
            }

            const merged = [...tasks, ...scheduleTasks].sort((a, b) => {
                const dateCompare = (a.scheduled_date || '').localeCompare(b.scheduled_date || '');
                if (dateCompare !== 0) return dateCompare;
                return (a.scheduled_time || '').localeCompare(b.scheduled_time || '');
            });
            
            res.json({
                success: true,
                data: {
                    tasks: merged,
                    count: merged.length
                }
            });
        } catch (error) {
            console.error('Get all tasks error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching tasks'
            });
        }
    }
    
    /**
     * Get single task
     * @route GET /api/tasks/:id
     */
    static async getTask(req, res) {
        try {
            const task = await Task.findById(req.params.id);
            
            if (!task) {
                return res.status(404).json({
                    success: false,
                    message: 'Task not found'
                });
            }
            
            // Verify ownership
            if (task.user_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized access to task'
                });
            }
            
            res.json({
                success: true,
                data: task
            });
        } catch (error) {
            console.error('Get task error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching task'
            });
        }
    }
    
    /**
     * Create new task
     * @route POST /api/tasks
     */
    static async createTask(req, res) {
        try {
            const taskData = {
                ...req.body,
                user_id: req.user.id
            };
            
            const task = await Task.create(taskData);

            // Update analytics if task is scheduled for today (non-blocking)
            const today = getUserToday(req.user.timezone);
            if (task?.scheduled_date === today) {
                try {
                    await TaskController.updateAnalytics(req.user.id, today);
                } catch (analyticsError) {
                    console.warn('Create task analytics update failed:', analyticsError?.message || analyticsError);
                }
            }
            
            res.status(201).json({
                success: true,
                message: 'Task created successfully',
                data: task
            });
        } catch (error) {
            console.error('Create task error:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating task'
            });
        }
    }
    
    /**
     * Update task
     * @route PUT /api/tasks/:id
     */
    static async updateTask(req, res) {
        try {
            const task = await Task.findById(req.params.id);
            
            if (!task) {
                const scheduleTask = await ScheduleTask.findById(req.params.id);
                if (!scheduleTask) {
                    return res.status(404).json({
                        success: false,
                        message: 'Task not found'
                    });
                }

                if (scheduleTask.user_id !== req.user.id) {
                    return res.status(403).json({
                        success: false,
                        message: 'Unauthorized access to task'
                    });
                }

                const updatedScheduleTask = await ScheduleTask.update(req.params.id, req.body);
                if (updatedScheduleTask) {
                    await routineService.updateInstanceItemFromScheduleTask(updatedScheduleTask);
                }
                if (updatedScheduleTask?.scheduled_date) {
                    await TaskController.updateAnalytics(req.user.id, updatedScheduleTask.scheduled_date);
                }

                return res.json({
                    success: true,
                    message: 'Task updated successfully',
                    data: updatedScheduleTask
                });
            }

            // Verify ownership
            if (task.user_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized access to task'
                });
            }

            const updatedTask = await Task.update(req.params.id, req.body);

            // Update analytics
            if (updatedTask.scheduled_date) {
                await TaskController.updateAnalytics(req.user.id, updatedTask.scheduled_date);
            }
            
            res.json({
                success: true,
                message: 'Task updated successfully',
                data: updatedTask
            });
        } catch (error) {
            console.error('Update task error:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating task'
            });
        }
    }
    
    /**
     * Delete task
     * @route DELETE /api/tasks/:id
     */
    static async deleteTask(req, res) {
        try {
            const task = await Task.findById(req.params.id);
            
            if (!task) {
                const scheduleTask = await ScheduleTask.findById(req.params.id);
                if (!scheduleTask) {
                    return res.status(404).json({
                        success: false,
                        message: 'Task not found'
                    });
                }

                if (scheduleTask.user_id !== req.user.id) {
                    return res.status(403).json({
                        success: false,
                        message: 'Unauthorized access to task'
                    });
                }

                const scheduledDate = scheduleTask.scheduled_date;
                await ScheduleTask.deleteById(req.params.id);
                if (scheduledDate) {
                    await TaskController.updateAnalytics(req.user.id, scheduledDate);
                }

                return res.json({
                    success: true,
                    message: 'Task deleted successfully'
                });
            }

            // Verify ownership
            if (task.user_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized access to task'
                });
            }

            const scheduledDate = task.scheduled_date;
            await Task.delete(req.params.id);

            // Update analytics
            if (scheduledDate) {
                await TaskController.updateAnalytics(req.user.id, scheduledDate);
            }
            
            res.json({
                success: true,
                message: 'Task deleted successfully'
            });
        } catch (error) {
            console.error('Delete task error:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting task'
            });
        }
    }
    
    /**
     * Mark task as complete
     * @route PATCH /api/tasks/:id/complete
     */
    static async completeTask(req, res) {
        try {
            const task = await Task.findById(req.params.id);
            
            if (!task) {
                const scheduleTask = await ScheduleTask.findById(req.params.id);
                if (!scheduleTask) {
                    return res.status(404).json({
                        success: false,
                        message: 'Task not found'
                    });
                }

                if (scheduleTask.user_id !== req.user.id) {
                    return res.status(403).json({
                        success: false,
                        message: 'Unauthorized access to task'
                    });
                }

                const updatedScheduleTask = await ScheduleTask.updateStatus(req.params.id, 'completed');
                if (updatedScheduleTask?.routine_instance_id && updatedScheduleTask?.routine_item_id) {
                    await routineService.updateInstanceItemStatus(req.user.id, updatedScheduleTask.routine_instance_id, updatedScheduleTask.routine_item_id, 'completed');
                }
                if (updatedScheduleTask?.scheduled_date) {
                    await TaskController.updateAnalytics(req.user.id, updatedScheduleTask.scheduled_date);
                }

                return res.json({
                    success: true,
                    message: 'Task marked as complete',
                    data: updatedScheduleTask
                });
            }

            // Verify ownership
            if (task.user_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized access to task'
                });
            }

            const updatedTask = await Task.updateStatus(req.params.id, 'completed');

            // Update analytics
            if (updatedTask.scheduled_date) {
                await TaskController.updateAnalytics(req.user.id, updatedTask.scheduled_date);
            }
            
            res.json({
                success: true,
                message: 'Task marked as complete',
                data: updatedTask
            });
        } catch (error) {
            console.error('Complete task error:', error);
            res.status(500).json({
                success: false,
                message: 'Error completing task'
            });
        }
    }
    
    /**
     * Update task status
     * @route PATCH /api/tasks/:id/status
     */
    static async updateStatus(req, res) {
        try {
            const { status } = req.body;
            const task = await Task.findById(req.params.id);
            
            if (!task) {
                const scheduleTask = await ScheduleTask.findById(req.params.id);
                if (!scheduleTask) {
                    return res.status(404).json({
                        success: false,
                        message: 'Task not found'
                    });
                }

                if (scheduleTask.user_id !== req.user.id) {
                    return res.status(403).json({
                        success: false,
                        message: 'Unauthorized access to task'
                    });
                }

                const updatedScheduleTask = await ScheduleTask.updateStatus(req.params.id, status);
                if (updatedScheduleTask?.routine_instance_id && updatedScheduleTask?.routine_item_id) {
                    await routineService.updateInstanceItemStatus(req.user.id, updatedScheduleTask.routine_instance_id, updatedScheduleTask.routine_item_id, status);
                }
                if (updatedScheduleTask?.scheduled_date) {
                    await TaskController.updateAnalytics(req.user.id, updatedScheduleTask.scheduled_date);
                }

                return res.json({
                    success: true,
                    message: 'Task status updated',
                    data: updatedScheduleTask
                });
            }

            // Verify ownership
            if (task.user_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized access to task'
                });
            }

            const updatedTask = await Task.updateStatus(req.params.id, status);

            // Update analytics
            if (updatedTask.scheduled_date) {
                await TaskController.updateAnalytics(req.user.id, updatedTask.scheduled_date);
            }
            
            res.json({
                success: true,
                message: 'Task status updated',
                data: updatedTask
            });
        } catch (error) {
            console.error('Update status error:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating task status'
            });
        }
    }
    
    /**
     * Get today's tasks
     * @route GET /api/tasks/today
     */
    static async getTodayTasks(req, res) {
        try {
            const today = getUserToday(req.user.timezone);
            const tasks = await Task.findByDate(req.user.id, today);
            const stats = await Task.getStatsByDate(req.user.id, today);
            
            const completionPercentage = stats.total_tasks > 0
                ? (stats.completed_tasks / stats.total_tasks) * 100
                : 0;
            
            res.json({
                success: true,
                data: {
                    tasks,
                    total_tasks: parseInt(stats.total_tasks),
                    completed_tasks: parseInt(stats.completed_tasks),
                    total_scheduled_minutes: parseInt(stats.total_scheduled_minutes) || 0,
                    completion_percentage: parseFloat(completionPercentage.toFixed(2))
                }
            });
        } catch (error) {
            console.error('Get today tasks error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching today\'s tasks'
            });
        }
    }
    
    /**
     * Get week's tasks
     * @route GET /api/tasks/week
     */
    static async getWeekTasks(req, res) {
        try {
            const today = getUserToday(req.user.timezone);
            const [y, m, d] = today.split('-').map(Number);
            const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
            const startDate = addDaysToYmd(today, -dayOfWeek);
            const endDate = addDaysToYmd(startDate, 6);

            const tasks = await Task.findByWeek(req.user.id, startDate, endDate);
            
            res.json({
                success: true,
                data: {
                    tasks,
                    start_date: startDate,
                    end_date: endDate,
                    count: tasks.length
                }
            });
        } catch (error) {
            console.error('Get week tasks error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching week\'s tasks'
            });
        }
    }
    
    /**
     * Get upcoming tasks
     * @route GET /api/tasks/upcoming
     */
    static async getUpcomingTasks(req, res) {
        try {
            const today = getUserToday(req.user.timezone);
            const endDate = addDaysToYmd(today, 7);

            const tasks = await Task.findByWeek(req.user.id, today, endDate);
            
            res.json({
                success: true,
                data: {
                    tasks,
                    count: tasks.length
                }
            });
        } catch (error) {
            console.error('Get upcoming tasks error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching upcoming tasks'
            });
        }
    }

    /**
     * Get full-day schedule (tasks) for a selected date
     * @route GET /api/tasks/day-schedule/:date
     */
    static async getDaySchedule(req, res) {
        try {
            const { date } = req.params;
            const tasks = await Task.findByDate(req.user.id, date);
            const totalMinutes = tasks.reduce((acc, task) => acc + (parseInt(task.duration_minutes, 10) || 0), 0);

            res.json({
                success: true,
                data: {
                    date,
                    tasks,
                    count: tasks.length,
                    total_scheduled_minutes: totalMinutes
                }
            });
        } catch (error) {
            console.error('Get day schedule error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching day schedule'
            });
        }
    }

    /**
     * Create a full-day schedule with multiple tasks for one date
     * @route POST /api/tasks/day-schedule
     */
    static async createDaySchedule(req, res) {
        try {
            const { date, slots = [], replaceExisting = false } = req.body;

            if (replaceExisting) {
                await Task.deleteByUserAndDate(req.user.id, date);
            }

            const createdTasks = [];
            for (const slot of slots) {
                const normalizedStart = normalizeTimeToSeconds(slot.start_time);
                const normalizedEnd = normalizeTimeToSeconds(slot.end_time);

                const durationMinutes = slot.duration_minutes
                    ? parseInt(slot.duration_minutes, 10)
                    : minutesBetweenTimes(slot.start_time || '', slot.end_time || '');

                const created = await Task.create({
                    user_id: req.user.id,
                    title: slot.title,
                    description: slot.description || null,
                    category: slot.category || null,
                    priority: slot.priority || 'medium',
                    status: slot.status || 'pending',
                    scheduled_date: date,
                    scheduled_time: normalizedStart,
                    duration_minutes: Number.isFinite(durationMinutes) ? durationMinutes : null,
                    recurrence_pattern: normalizedEnd ? { end_time: normalizedEnd } : null
                });

                createdTasks.push(created);
            }

            await TaskController.updateAnalytics(req.user.id, date);

            res.status(201).json({
                success: true,
                message: 'Day schedule created successfully',
                data: {
                    date,
                    tasks: createdTasks,
                    count: createdTasks.length
                }
            });
        } catch (error) {
            console.error('Create day schedule error:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating day schedule'
            });
        }
    }
    
    /**
     * Bulk delete tasks
     * @route POST /api/tasks/bulk-delete
     */
    static async bulkDelete(req, res) {
        try {
            const { ids } = req.body;

            if (!Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide an array of task IDs'
                });
            }

            // Every id must be a plain string — reject objects/arrays that could
            // carry Mongo operators into the delete filter.
            if (!ids.every((id) => typeof id === 'string' && id.length > 0)) {
                return res.status(400).json({
                    success: false,
                    message: 'Task IDs must be non-empty strings'
                });
            }

            // Verify ownership of all tasks
            for (const id of ids) {
                const task = await Task.findById(id);
                if (task && task.user_id !== req.user.id) {
                    return res.status(403).json({
                        success: false,
                        message: 'Unauthorized access to one or more tasks'
                    });
                }
            }
            
            await Task.bulkDelete(ids);
            
            res.json({
                success: true,
                message: `${ids.length} tasks deleted successfully`
            });
        } catch (error) {
            console.error('Bulk delete error:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting tasks'
            });
        }
    }
    
    /**
     * Helper method to update analytics
     */
    static async updateAnalytics(userId, date) {
        try {
            const [taskStats, scheduleStats] = await Promise.all([
                Task.getStatsByDate(userId, date),
                ScheduleTask.getStatsByDate(userId, date)
            ]);

            await Analytics.upsert(userId, date, {
                total_tasks_scheduled: (parseInt(taskStats.total_tasks) || 0) + (parseInt(scheduleStats.total_tasks) || 0),
                total_tasks_completed: (parseInt(taskStats.completed_tasks) || 0) + (parseInt(scheduleStats.completed_tasks) || 0),
                total_time_scheduled_minutes: (parseInt(taskStats.total_scheduled_minutes) || 0) + (parseInt(scheduleStats.total_scheduled_minutes) || 0),
                total_time_spent_minutes: (parseInt(taskStats.total_actual_minutes) || 0) + (parseInt(scheduleStats.total_actual_minutes) || 0)
            });
        } catch (error) {
            console.error('Update analytics error:', error);
        }
    }
}

module.exports = TaskController;
