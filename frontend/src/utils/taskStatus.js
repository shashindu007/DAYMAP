/**
 * Frontend mirror of backend/src/utils/statusMapping.js.
 *
 * A schedule task spells "the user did not do this" as `missed`; a routine
 * instance item spells it `skipped`. Both caches are patched locally after a
 * mutation, so the translation has to exist on this side too.
 */

export const SCHEDULE_TASK_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled', 'missed'];
export const ROUTINE_ITEM_STATUSES = ['pending', 'in_progress', 'completed', 'skipped'];

export const toRoutineItemStatus = (status) => {
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

export const toScheduleTaskStatus = (status) => {
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

/** A task the user has explicitly resolved, either way. */
export const isResolvedStatus = (status) => (
    status === 'completed' || status === 'missed' || status === 'cancelled'
);

export const STATUS_LABELS = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    missed: 'Missed'
};

export const STATUS_BADGE_CLASSES = {
    pending: 'status-upcoming',
    in_progress: 'status-current',
    completed: 'status-completed',
    cancelled: 'status-incomplete',
    missed: 'status-missed'
};
