/**
 * Recurrence → weekdays, shared by the Routines page and the Week dashboard so
 * "which days does this routine run on" is answered in exactly one place.
 * Weekday numbers match Date#getDay(): 0 = Sunday.
 */

export const WEEKDAYS = [1, 2, 3, 4, 5];
export const WEEKENDS = [0, 6];
export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

export const activeDaysFor = (recurrence) => {
    switch (recurrence?.type) {
        case 'weekdays': return WEEKDAYS;
        case 'weekends': return WEEKENDS;
        case 'custom': return recurrence.days_of_week || [];
        default: return EVERY_DAY;
    }
};
