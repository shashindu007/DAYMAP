const Task = require('../models/Task');
const Analytics = require('../models/Analytics');

class TaskController {
    /**
     * Get all tasks for user
     * @route GET /api/tasks
     */
    static async getAllTasks(req, res) {
        try {
            const { status, priority, category, scheduled_date, date_from, date_to } = req.query;
            
            const filters = {};
            if (status) filters.status = status;
            if (priority) filters.priority = priority;
            if (category) filters.category = category;
            if (scheduled_date) filters.scheduled_date = scheduled_date;
            if (date_from && date_to) {
                filters.date_from = date_from;
                filters.date_to = date_to;
            }
            
            const tasks = await Task.findByUser(req.user.id, filters);
            
            res.json({
                success: true,
                data: {
                    tasks,
                    count: tasks.length
                }
            });
        } catch (error) {
            console.error('Get all tasks error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching tasks',
                error: error.message
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
                message: 'Error fetching task',
                error: error.message
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
            
            // Update analytics if task is scheduled for today
            const today = new Date().toISOString().split('T')[0];
            if (task.scheduled_date === today) {
                await this.updateAnalytics(req.user.id, today);
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
                message: 'Error creating task',
                error: error.message
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
            
            const updatedTask = await Task.update(req.params.id, req.body);
            
            // Update analytics
            if (updatedTask.scheduled_date) {
                await this.updateAnalytics(req.user.id, updatedTask.scheduled_date);
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
                message: 'Error updating task',
                error: error.message
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
            
            const scheduledDate = task.scheduled_date;
            await Task.delete(req.params.id);
            
            // Update analytics
            if (scheduledDate) {
                await this.updateAnalytics(req.user.id, scheduledDate);
            }
            
            res.json({
                success: true,
                message: 'Task deleted successfully'
            });
        } catch (error) {
            console.error('Delete task error:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting task',
                error: error.message
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
            
            const updatedTask = await Task.updateStatus(req.params.id, 'completed');
            
            // Update analytics
            if (updatedTask.scheduled_date) {
                await this.updateAnalytics(req.user.id, updatedTask.scheduled_date);
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
                message: 'Error completing task',
                error: error.message
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
            
            const updatedTask = await Task.updateStatus(req.params.id, status);
            
            // Update analytics
            if (updatedTask.scheduled_date) {
                await this.updateAnalytics(req.user.id, updatedTask.scheduled_date);
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
                message: 'Error updating task status',
                error: error.message
            });
        }
    }
    
    /**
     * Get today's tasks
     * @route GET /api/tasks/today
     */
    static async getTodayTasks(req, res) {
        try {
            const today = new Date().toISOString().split('T')[0];
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
                message: 'Error fetching today\'s tasks',
                error: error.message
            });
        }
    }
    
    /**
     * Get week's tasks
     * @route GET /api/tasks/week
     */
    static async getWeekTasks(req, res) {
        try {
            const today = new Date();
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay());
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            
            const startDate = startOfWeek.toISOString().split('T')[0];
            const endDate = endOfWeek.toISOString().split('T')[0];
            
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
                message: 'Error fetching week\'s tasks',
                error: error.message
            });
        }
    }
    
    /**
     * Get upcoming tasks
     * @route GET /api/tasks/upcoming
     */
    static async getUpcomingTasks(req, res) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);
            const endDate = nextWeek.toISOString().split('T')[0];
            
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
                message: 'Error fetching upcoming tasks',
                error: error.message
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
                message: 'Error deleting tasks',
                error: error.message
            });
        }
    }
    
    /**
     * Helper method to update analytics
     */
    static async updateAnalytics(userId, date) {
        try {
            const stats = await Task.getStatsByDate(userId, date);
            
            await Analytics.upsert(userId, date, {
                total_tasks_scheduled: parseInt(stats.total_tasks) || 0,
                total_tasks_completed: parseInt(stats.completed_tasks) || 0,
                total_time_scheduled_minutes: parseInt(stats.total_scheduled_minutes) || 0,
                total_time_spent_minutes: parseInt(stats.total_actual_minutes) || 0
            });
        } catch (error) {
            console.error('Update analytics error:', error);
        }
    }
}

module.exports = TaskController;
