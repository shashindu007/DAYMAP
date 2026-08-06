import React, { useEffect } from 'react';
import { useWallet } from '../../context/WalletContext';
import useCurrency from '../../hooks/useCurrency';
import './TodayGlance.css';

/**
 * What you have spent today, as one quiet line beneath the day summary.
 *
 * Reuses TodayGlance's classes rather than inventing its own, so the two lines
 * stay visually identical by construction.
 *
 * It self-nulls on every empty or failed path. A spending feature must never
 * put an error - or an attention-grabbing zero - on Today's Dashboard.
 */
const TodaySpendLine = () => {
    const { todaySpend, ensureTodaySpend } = useWallet();
    const { format } = useCurrency();

    // ensureTodaySpend is deduped by a ref keyed on user+date and its identity
    // depends only on user.id, so this effect cannot loop into repeat requests.
    useEffect(() => {
        ensureTodaySpend();
    }, [ensureTodaySpend]);

    if (!todaySpend || todaySpend.spent_cents <= 0) return null;

    return (
        <p className="today-glance">
            <span className="today-glance-fact">{format(todaySpend.spent_cents)} spent today</span>
            {todaySpend.count > 1 && (
                <>
                    <span className="today-glance-sep" aria-hidden> · </span>
                    <span className="today-glance-fact">{todaySpend.count} expenses</span>
                </>
            )}
        </p>
    );
};

export default TodaySpendLine;
