/**
 * Status vocabulary shared by schedule tasks and routine instance items.
 *
 * The two collections spell the "user did not do this" state differently:
 * a ScheduleTask is `missed`, a routine item is `skipped`. Every sync point
 * between them must translate, otherwise an out-of-enum value is written
 * (RoutineInstance.updateItem uses updateOne, which does not run validators,
 * so a bad value persists silently).
 */

const SCHEDULE_TASK_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled', 'missed'];
const ROUTINE_ITEM_STATUSES = ['pending', 'in_progress', 'completed', 'skipped'];

/**
 * Translate any status into a valid routine item status.
 * Total function: unknown input falls back to 'pending'.
 */
const toRoutineItemStatus = (status) => {
    switch (status) {
        case 'completed':
            return 'completed';
        case 'in_progress':
            return 'in_progress';
        case 'skipped':
        case 'missed':
        case 'cancelled':
            return 'skipped';
        default:
            return 'pending';
    }
};

/**
 * Translate any status into a valid schedule task status.
 * Total function: unknown input falls back to 'pending'.
 */
const toScheduleTaskStatus = (status) => {
    switch (status) {
        case 'completed':
            return 'completed';
        case 'in_progress':
            return 'in_progress';
        case 'cancelled':
            return 'cancelled';
        case 'skipped':
        case 'missed':
            return 'missed';
        default:
            return 'pending';
    }
};

module.exports = {
    SCHEDULE_TASK_STATUSES,
    ROUTINE_ITEM_STATUSES,
    toRoutineItemStatus,
    toScheduleTaskStatus
};
