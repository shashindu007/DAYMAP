const scheduleService = require('../services/scheduleService');
const routineService = require('../services/routineService');

class RoutineController {
    /**
     * Get all routine templates
     * @route GET /api/routines
     */
    static async getAllRoutines(req, res) {
        try {
            const { active_only } = req.query;
            const routines = await routineService.RoutineTemplate.findByUser(req.user.id, active_only === 'true');

            res.json({
                success: true,
                data: {
                    routines,
                    count: routines.length
                }
            });
        } catch (error) {
            console.error('Get all routines error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching routines',
                error: error.message
            });
        }
    }
    
    /**
     * Get single routine
     * @route GET /api/routines/:id
     */
    static async getRoutine(req, res) {
        try {
            const routine = await routineService.RoutineTemplate.findById(req.params.id);

            if (!routine) {
                return res.status(404).json({
                    success: false,
                    message: 'Routine not found'
                });
            }

            if (routine.user_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized access to routine'
                });
            }

            res.json({
                success: true,
                data: routine
            });
        } catch (error) {
            console.error('Get routine error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching routine',
                error: error.message
            });
        }
    }
    
    /**
     * Create new routine
     * @route POST /api/routines
     */
    static async createRoutine(req, res) {
        try {
            const {
                name,
                description,
                color,
                icon,
                is_active,
                recurrence,
                items
            } = req.body;

            const normalizedItems = (items || []).map((item, index) => ({
                ...item,
                order: Number.isFinite(item.order) ? item.order : index
            }));

            const routine = await routineService.RoutineTemplate.create({
                user_id: req.user.id,
                name,
                description,
                color: color || '#6366F1',
                icon: icon || null,
                is_active: is_active !== false,
                created_by: req.user.id,
                recurrence: routineService.normalizeRecurrence(recurrence),
                items: normalizedItems
            });

            res.status(201).json({
                success: true,
                message: 'Routine created successfully',
                data: routine
            });
        } catch (error) {
            console.error('Create routine error:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating routine',
                error: error.message
            });
        }
    }
    
    /**
     * Update routine
     * @route PUT /api/routines/:id
     */
    static async updateRoutine(req, res) {
        try {
            const routine = await routineService.RoutineTemplate.findById(req.params.id);

            if (!routine) {
                return res.status(404).json({
                    success: false,
                    message: 'Routine not found'
                });
            }

            if (routine.user_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized access to routine'
                });
            }

            const updates = {
                name: req.body.name,
                description: req.body.description,
                color: req.body.color,
                icon: req.body.icon,
                is_active: req.body.is_active,
                recurrence: req.body.recurrence ? routineService.normalizeRecurrence(req.body.recurrence) : routine.recurrence,
                items: Array.isArray(req.body.items)
                    ? req.body.items.map((item, index) => ({
                        ...item,
                        order: Number.isFinite(item.order) ? item.order : index
                    }))
                    : routine.items
            };

            const updatedRoutine = await routineService.RoutineTemplate.update(req.params.id, updates);

            res.json({
                success: true,
                message: 'Routine updated successfully',
                data: updatedRoutine
            });
        } catch (error) {
            console.error('Update routine error:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating routine',
                error: error.message
            });
        }
    }
    
    /**
     * Delete routine
     * @route DELETE /api/routines/:id
     */
    static async deleteRoutine(req, res) {
        try {
            const routine = await routineService.RoutineTemplate.findById(req.params.id);

            if (!routine) {
                return res.status(404).json({
                    success: false,
                    message: 'Routine not found'
                });
            }

            if (routine.user_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized access to routine'
                });
            }

            await routineService.RoutineTemplate.delete(req.params.id);
            await routineService.RoutineInstance.deleteByTemplate(req.params.id);

            res.json({
                success: true,
                message: 'Routine deleted successfully'
            });
        } catch (error) {
            console.error('Delete routine error:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting routine',
                error: error.message
            });
        }
    }
    
    /**
     * Toggle routine active status
     * @route PATCH /api/routines/:id/activate
     */
    static async toggleActive(req, res) {
        try {
            const routine = await routineService.RoutineTemplate.findById(req.params.id);

            if (!routine) {
                return res.status(404).json({
                    success: false,
                    message: 'Routine not found'
                });
            }

            if (routine.user_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized access to routine'
                });
            }

            const updatedRoutine = await routineService.RoutineTemplate.update(req.params.id, {
                is_active: !routine.is_active
            });

            res.json({
                success: true,
                message: `Routine ${updatedRoutine.is_active ? 'activated' : 'deactivated'} successfully`,
                data: updatedRoutine
            });
        } catch (error) {
            console.error('Toggle active error:', error);
            res.status(500).json({
                success: false,
                message: 'Error toggling routine status',
                error: error.message
            });
        }
    }
    
    /**
     * Apply routine to create actual tasks
     * @route POST /api/routines/:id/apply
     */
    static async applyRoutine(req, res) {
        try {
            const routine = await routineService.RoutineTemplate.findById(req.params.id);

            if (!routine) {
                return res.status(404).json({
                    success: false,
                    message: 'Routine not found'
                });
            }

            if (routine.user_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized access to routine'
                });
            }

            const { date } = req.body;
            if (!date) {
                return res.status(400).json({
                    success: false,
                    message: 'Apply date is required'
                });
            }

            await routineService.ensureDailyInstances(req.user.id, date);
            const schedule = await scheduleService.getScheduleByDate(req.user.id, date);

            res.json({
                success: true,
                message: 'Routine applied successfully',
                data: {
                    date,
                    schedule: schedule.tasks
                }
            });
        } catch (error) {
            console.error('Apply routine error:', error);
            res.status(500).json({
                success: false,
                message: 'Error applying routine',
                error: error.message
            });
        }
    }

    /**
     * Get daily routine instances for a date
     * @route GET /api/routines/daily/:date
     */
    static async getDailyRoutine(req, res) {
        try {
            const { date } = req.params;
            const { instances } = await routineService.ensureDailyInstances(req.user.id, date);
            const schedule = await scheduleService.getScheduleByDate(req.user.id, date);
            await routineService.updateRoutineAnalytics(req.user.id, date);

            res.json({
                success: true,
                data: {
                    date,
                    routines: instances,
                    schedule: schedule.tasks
                }
            });
        } catch (error) {
            console.error('Get daily routine error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching daily routine',
                error: error.message
            });
        }
    }

    /**
     * Update routine instance item
     * @route PATCH /api/routines/instances/:id/items/:itemId
     */
    static async updateRoutineInstanceItem(req, res) {
        try {
            const instance = await routineService.RoutineInstance.findById(req.params.id);
            if (!instance) {
                return res.status(404).json({
                    success: false,
                    message: 'Routine instance not found'
                });
            }

            if (instance.user_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized access to routine instance'
                });
            }

            const updated = await routineService.updateInstanceItem(req.user.id, req.params.id, req.params.itemId, req.body);

            if (req.body.start_time || req.body.end_time || req.body.duration_minutes) {
                const item = updated.items.find((entry) => entry.id === req.params.itemId);
                if (item?.scheduled_task_id) {
                    await scheduleService.updateScheduleTask(req.user.id, item.scheduled_task_id, {
                        slot_start_time: item.start_time,
                        slot_end_time: item.end_time,
                        duration_minutes: item.duration_minutes
                    });
                } else if (item?.start_time && item?.end_time) {
                    await scheduleService.addSlotsToSchedule(req.user.id, updated.date, [
                        {
                            title: item.title,
                            description: item.notes || null,
                            priority: 'medium',
                            status: item.status || 'pending',
                            start_time: item.start_time,
                            end_time: item.end_time,
                            duration_minutes: item.duration_minutes,
                            routine_template_id: updated.template_id,
                            routine_instance_id: updated.id,
                            routine_item_id: item.id,
                            source: 'routine'
                        }
                    ]);
                }
            }

            res.json({
                success: true,
                message: 'Routine item updated',
                data: updated
            });
        } catch (error) {
            console.error('Update routine instance item error:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating routine item',
                error: error.message
            });
        }
    }

    /**
     * Update routine instance item status
     * @route PATCH /api/routines/instances/:id/items/:itemId/complete
     */
    static async completeRoutineInstanceItem(req, res) {
        try {
            const instance = await routineService.RoutineInstance.findById(req.params.id);
            if (!instance) {
                return res.status(404).json({
                    success: false,
                    message: 'Routine instance not found'
                });
            }

            if (instance.user_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized access to routine instance'
                });
            }

            const status = req.body.status || 'completed';
            const updated = await routineService.updateInstanceItemStatus(req.user.id, req.params.id, req.params.itemId, status);

            const item = updated.items.find((entry) => entry.id === req.params.itemId);
            if (item?.scheduled_task_id) {
                await scheduleService.updateScheduleTaskStatus(req.user.id, item.scheduled_task_id, status === 'completed' ? 'completed' : 'pending');
            }

            res.json({
                success: true,
                message: 'Routine item status updated',
                data: updated
            });
        } catch (error) {
            console.error('Complete routine instance item error:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating routine item status',
                error: error.message
            });
        }
    }

    /**
     * Get routine analytics for date
     * @route GET /api/routines/analytics/:date
     */
    static async getRoutineAnalytics(req, res) {
        try {
            const { date } = req.params;
            const analytics = await routineService.RoutineAnalytics.findByDate(req.user.id, date);

            res.json({
                success: true,
                data: analytics || {
                    date,
                    total_items: 0,
                    completed_items: 0,
                    skipped_items: 0
                }
            });
        } catch (error) {
            console.error('Get routine analytics error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching routine analytics',
                error: error.message
            });
        }
    }
}

module.exports = RoutineController;
