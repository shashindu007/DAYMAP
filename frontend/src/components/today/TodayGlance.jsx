import React, { useMemo } from 'react';
import { summarizeDay } from '../../utils/dayItems';
import './TodayGlance.css';

/**
 * The whole day in one line, always visible.
 *
 * The morning digest notification is transient - if you miss it, it is gone.
 * This is the durable half of the same answer, and it reads from the same
 * summarizeDay() so the two can never disagree.
 */
const TodayGlance = ({ items, nowMinutes }) => {
    const summary = useMemo(() => summarizeDay(items, nowMinutes), [items, nowMinutes]);

    if (summary.total === 0) return null;

    const facts = [
        `${summary.total} today`,
        summary.scheduledMinutes > 0 ? `${summary.scheduledLabel} scheduled` : null,
        summary.firstUp?.startLabel ? `first at ${summary.firstUp.startLabel}` : null,
        summary.anytime > 0 ? `${summary.anytime} anytime` : null,
        summary.needsReview > 0 ? `${summary.needsReview} needs review` : null
    ].filter(Boolean);

    return (
        <p className="today-glance">
            {facts.map((fact, index) => (
                <React.Fragment key={fact}>
                    {index > 0 && <span className="today-glance-sep" aria-hidden> · </span>}
                    <span className="today-glance-fact">{fact}</span>
                </React.Fragment>
            ))}
        </p>
    );
};

export default TodayGlance;
