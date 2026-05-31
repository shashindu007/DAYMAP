const Routine = require('../models/Routine');
const RoutineTask = require('../models/RoutineTask');
const Task = require('../models/Task');
const scheduleService = require('../services/scheduleService');

const normalizeTimeToSeconds = (value) => {
    if (!value || typeof value !== 'string') return null;
    if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
        return `${value}:00`;
    }
    if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(value)) {
        return value;
    }
    return null;
};

const timeToMinutes = (value) => {
    if (!value) return null;
    const [hours, minutes] = value.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return (hours * 60) + minutes;
};

const minutesToTime = (minutes) => {
    if (!Number.isFinite(minutes)) return null;
    if (minutes >= 1440) return '00:00';
    if (minutes < 0) return '00:00';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

class RoutineController {
    /**
     * Get all routines for user
     * @route GET /api/routines
     */
    static async getAllRoutines(req, res) {
        try {
            const { active_only } = req.query;
            const routines = await Routine.findByUser(req.user.id, active_only === 'true');
            
            // Get tasks for each routine
            const routinesWithTasks = await Promise.all(
                routines.map(async (routine) => {
                    const tasks = await RoutineTask.findByRoutine(routine.id);
                    return { ...routine, tasks };
                })
            );
            
            res.json({
                success: true,
                data: {
                    routines: routinesWithTasks,
                    count: routinesWithTasks.length
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
            const routine = await Routine.findById(req.params.id);
            
            if (!routine) {
                return res.status(404).json({
                    success: false,
                    message: 'Routine not found'
                });
            }
            
            // Verify ownership
            if (routine.user_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized access to routine'
                });
            }
            
            // Get tasks for routine
            const tasks = await RoutineTask.findByRoutine(routine.id);
            
            res.json({
                success: true,
                data: { ...routine, tasks }
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
            const { name, description, routine_type, is_active, tasks } = req.body;
            
            // Create routine
            const routine = await Routine.create({
                user_id: req.user.id,
                name,
                description,
                routine_type,
                is_active
            });
            
            // Create routine tasks if provided
            if (tasks && Array.isArray(tasks)) {
                for (let i = 0; i < tasks.length; i++) {
                    await RoutineTask.create({
                        routine_id: routine.id,
                        task_template: tasks[i],
                        task_order: i + 1
                    });
                }
            }
            
            // Get complete routine with tasks
            const completedRoutine = await Routine.findById(routine.id);
            const routineTasks = await RoutineTask.findByRoutine(routine.id);
            
            res.status(201).json({
                success: true,
                message: 'Routine created successfully',
                data: { ...completedRoutine, tasks: routineTasks }
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
            const routine = await Routine.findById(req.params.id);
            
            if (!routine) {
                return res.status(404).json({
                    success: false,
                    message: 'Routine not found'
                });
            }
            
            // Verify ownership
            if (routine.user_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized access to routine'
                });
            }
            
            const { name, description, routine_type, is_active, tasks } = req.body;
            
            // Update routine
            const updatedRoutine = await Routine.update(req.params.id, {
                name,
                description,
                routine_type,
                is_active
            });
            
            // Update tasks if provided
            if (tasks && Array.isArray(tasks)) {
                // Delete existing tasks
                await RoutineTask.deleteByRoutine(req.params.id);
                
                // Create new tasks
                for (let i = 0; i < tasks.length; i++) {
                    await RoutineTask.create({
                        routine_id: req.params.id,
                        task_template: tasks[i],
                        task_order: i + 1
                    });
                }
            }
            
            // Get updated routine with tasks
            const routineTasks = await RoutineTask.findByRoutine(req.params.id);
            
            res.json({
                success: true,
                message: 'Routine updated successfully',
                data: { ...updatedRoutine, tasks: routineTasks }
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
            const routine = await Routine.findById(req.params.id);
            
            if (!routine) {
                return res.status(404).json({
                    success: false,
                    message: 'Routine not found'
                });
            }
            
            // Verify ownership
            if (routine.user_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized access to routine'
                });
            }
            
            // Delete routine (cascade will delete routine_tasks)
            await Routine.delete(req.params.id);
            
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
            const routine = await Routine.findById(req.params.id);
            
            if (!routine) {
                return res.status(404).json({
                    success: false,
                    message: 'Routine not found'
                });
            }
            
            // Verify ownership
            if (routine.user_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized access to routine'
                });
            }
            
            const updatedRoutine = await Routine.toggleActive(req.params.id);
            
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
            const { date, time_offset } = req.body; // date: YYYY-MM-DD, time_offset: minutes
            const parsedOffset = Number.isFinite(Number(time_offset)) ? Number(time_offset) : 0;
            let rollingStartMinutes = Number.isFinite(parsedOffset) ? Math.max(0, parsedOffset) : null;
            
            const routine = await Routine.findById(req.params.id);
            
            if (!routine) {
                return res.status(404).json({
                    success: false,
                    message: 'Routine not found'
                });
            }
            
            // Verify ownership
            if (routine.user_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized access to routine'
                });
            }
            
            // Get routine tasks
            const routineTasks = await RoutineTask.findByRoutine(req.params.id);

            const createdTasks = [];
            const scheduleSlots = [];

            // Create tasks from templates
            for (const routineTask of routineTasks) {
                const template = routineTask.task_template || {};

                const explicitStart = normalizeTimeToSeconds(template.scheduled_time);
                let derivedStart = explicitStart;

                if (!derivedStart && Number.isFinite(rollingStartMinutes)) {
                    derivedStart = minutesToTime(rollingStartMinutes);
                }

                const normalizedStart = normalizeTimeToSeconds(derivedStart);

                const task = await Task.create({
                    user_id: req.user.id,
                    title: template.title,
                    description: template.description,
                    category: template.category,
                    priority: template.priority || 'medium',
                    scheduled_date: date,
                    scheduled_time: normalizedStart,
                    duration_minutes: template.duration_minutes
                });

                createdTasks.push(task);

                const duration = Number.isFinite(template.duration_minutes)
                    ? template.duration_minutes
                    : parseInt(template.duration_minutes, 10);
                const slotDuration = Number.isFinite(duration) ? duration : 30;
                const startMinutes = timeToMinutes(normalizedStart);

                if (normalizedStart && Number.isFinite(startMinutes)) {
                    const endMinutes = startMinutes + slotDuration;
                    const endTime = minutesToTime(endMinutes);

                    if (endTime) {
                        scheduleSlots.push({
                            title: template.title,
                            description: template.description || null,
                            category: template.category || null,
                            priority: template.priority || 'medium',
                            status: template.status || 'pending',
                            start_time: normalizedStart,
                            end_time: endTime
                        });
                    }

                    if (Number.isFinite(rollingStartMinutes)) {
                        rollingStartMinutes = Math.max(rollingStartMinutes, endMinutes);
                    } else {
                        rollingStartMinutes = endMinutes;
                    }
                }
            }

            let scheduleResult = { tasks: [], skipped: 0 };
            if (scheduleSlots.length) {
                scheduleResult = await scheduleService.addSlotsToSchedule(req.user.id, date, scheduleSlots);
            }

            res.json({
                success: true,
                message: `Routine applied successfully. ${createdTasks.length} tasks created. ${scheduleResult.tasks.length} scheduled slots created.`,
                data: {
                    tasks: createdTasks,
                    tasks_count: createdTasks.length,
                    schedule_slots: scheduleResult.tasks,
                    schedule_count: scheduleResult.tasks.length,
                    schedule_skipped: scheduleResult.skipped
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
}

module.exports = RoutineController;
