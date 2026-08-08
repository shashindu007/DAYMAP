import React, { useMemo } from 'react';
import useCurrency from '../../hooks/useCurrency';
import { compactMoney } from '../../utils/money';
import { daysInMonth, firstWeekdayOf, ymdOf, dayLabel, fullDayLabel } from '../../utils/monthDates';
import './WalletCalendar.css';

/**
 * A month of spending, one cell per day.
 *
 * Reads the month's expenses the page already has - GET /wallet/expenses
 * returns the whole period, and getSummary aggregates the SAME query with the
 * same 500-row cap, so this grid and the KPI tiles cannot disagree even when a
 * month is truncated. Nothing here fetches.
 *
 * Every class is prefixed .wallet-cal-, per the rule at the top of Wallet.css:
 * CRA concatenates every stylesheet, so an unprefixed .day or .grid would
 * silently restyle half the app.
 */

// Two Ts and two Ss, so these are keyed by index rather than by value.
const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const WalletCalendar = ({
    period,
    expenses,
    budgetCents = 0,
    selectedDay = null,
    onSelectDay,
    todayYmd = null
}) => {
    const { format, currency } = useCurrency();

    /**
     * One memo feeds the grid, the pace markers and the footer. Three separate
     * memos would walk the same list three times and could drift apart on the
     * definition of "a spending day".
     */
    const month = useMemo(() => {
        const dayCount = daysInMonth(period);
        const leadingBlanks = firstWeekdayOf(period);

        // Pass 1: expenses -> per-day totals.
        //
        // The period guard is not paranoia: createExpense prepends whatever the
        // API returned to the list, so logging an expense dated outside the
        // month being viewed leaves a foreign row here until the next fetch.
        const byDay = new Map();
        expenses.forEach((row) => {
            if (!row?.date || !row.date.startsWith(`${period}-`)) return;
            const entry = byDay.get(row.date) || { cents: 0, count: 0 };
            entry.cents += row.amount_cents;
            entry.count += 1;
            byDay.set(row.date, entry);
        });

        // A budget spread evenly across the month. Zero when no budget is set,
        // which is what switches the pace markers off entirely.
        const paceCents = budgetCents > 0 ? Math.floor(budgetCents / dayCount) : 0;

        // Pass 2: build the cells and every statistic in the same walk.
        let maxSpentCents = 0;
        let totalCents = 0;
        let spendingDayCount = 0;
        let busiestDay = null;

        const days = [];
        for (let day = 1; day <= dayCount; day += 1) {
            const ymd = ymdOf(period, day);
            const entry = byDay.get(ymd);
            const spentCents = entry ? entry.cents : 0;
            const cell = {
                ymd,
                day,
                spentCents,
                count: entry ? entry.count : 0,
                overPace: paceCents > 0 && spentCents > paceCents,
                heat: 0
            };

            if (spentCents > 0) {
                totalCents += spentCents;
                spendingDayCount += 1;
                if (spentCents > maxSpentCents) maxSpentCents = spentCents;
                // Strict >, so a tie goes to the earlier day.
                if (!busiestDay || spentCents > busiestDay.spentCents) busiestDay = cell;
            }

            days.push(cell);
        }

        // Heat needs the month's maximum, so it lands after the walk - still
        // inside this memo, still one object out.
        //
        // sqrt rather than linear: one blow-out day would otherwise flatten
        // every other day to invisible. The 0.10 floor keeps a small but real
        // day readable as tinted rather than blank.
        days.forEach((cell) => {
            cell.heat = cell.spentCents > 0 && maxSpentCents > 0
                ? 0.10 + 0.45 * Math.sqrt(cell.spentCents / maxSpentCents)
                : 0;
        });

        return {
            days,
            leadingBlanks,
            maxSpentCents,
            paceCents,
            busiestDay,
            zeroDayCount: dayCount - spendingDayCount,
            spendingDayCount,
            // Math.round keeps this an integer minor unit - a float here would
            // be the one place money stops being exact.
            avgPerSpendingDayCents: spendingDayCount
                ? Math.round(totalCents / spendingDayCount)
                : 0
        };
    }, [period, expenses, budgetCents]);

    return (
        <div className="wallet-cal">
            <div className="wallet-cal-head" aria-hidden="true">
                {WEEKDAY_INITIALS.map((initial, index) => (
                    <span key={index}>{initial}</span>
                ))}
            </div>

            <div className="wallet-cal-grid">
                {/* Leading blanks only. A CSS grid row simply ends, so trailing
                    cells would be markup that renders nothing. */}
                {Array.from({ length: month.leadingBlanks }, (_, index) => (
                    <div className="wallet-cal-blank" key={`blank-${index}`} aria-hidden="true" />
                ))}

                {month.days.map((cell) => {
                    const selected = cell.ymd === selectedDay;
                    const isToday = cell.ymd === todayYmd;

                    // compactMoney hides the exact figure to fit the cell, so
                    // the full amount has to live here - this string is both
                    // the accessible name and the hover title.
                    const label = cell.spentCents > 0
                        ? `${fullDayLabel(cell.ymd)} — ${format(cell.spentCents)}, ${cell.count} expense${cell.count === 1 ? '' : 's'}${cell.overPace ? ', over daily pace' : ''}`
                        : `${fullDayLabel(cell.ymd)} — nothing spent`;

                    return (
                        <button
                            type="button"
                            key={cell.ymd}
                            className={
                                'wallet-cal-day'
                                + (selected ? ' is-selected' : '')
                                + (isToday ? ' is-today' : '')
                                + (cell.overPace ? ' is-over-pace' : '')
                            }
                            style={{ '--wallet-heat': cell.heat.toFixed(3) }}
                            onClick={() => onSelectDay(selected ? null : cell.ymd)}
                            // aria-pressed, not aria-selected: outside a grid or
                            // listbox that role is invalid, and this genuinely is
                            // a toggle - clicking the same day clears the filter.
                            aria-pressed={selected}
                            aria-current={isToday ? 'date' : undefined}
                            aria-label={label}
                            title={label}
                        >
                            <span className="wallet-cal-num">{cell.day}</span>
                            <span className={`wallet-cal-amount${cell.spentCents > 0 ? '' : ' is-empty'}`}>
                                {cell.spentCents > 0 ? compactMoney(cell.spentCents, currency) : '–'}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="wallet-cal-foot">
                {month.busiestDay ? (
                    <>
                        <span className="wallet-cal-stat">
                            Busiest day{' '}
                            <strong>
                                {dayLabel(month.busiestDay.ymd)} · {format(month.busiestDay.spentCents)}
                            </strong>
                        </span>
                        <span className="wallet-cal-stat">
                            <strong>{month.zeroDayCount}</strong> day{month.zeroDayCount === 1 ? '' : 's'} with no spending
                        </span>
                        {/* "spending day" in words, because the denominator is
                            days that had spend - not calendar days - and this
                            label is the only place a user can learn that. */}
                        <span className="wallet-cal-stat">
                            <strong>{format(month.avgPerSpendingDayCents)}</strong> average per spending day
                        </span>
                    </>
                ) : (
                    <span className="wallet-cal-stat muted">Nothing spent this month yet.</span>
                )}
            </div>
        </div>
    );
};

export default WalletCalendar;
