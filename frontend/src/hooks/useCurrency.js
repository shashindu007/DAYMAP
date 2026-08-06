import { useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_CURRENCY, formatMoney, parseMoneyInput } from '../utils/money';

/**
 * Binds the pure money helpers to the signed-in user's currency, so callers
 * never have to remember to thread it through - and can never render one
 * amount in LKR beside another in USD.
 *
 * The backend normalizes `currency` on read, so it is a supported code even for
 * accounts created before the wallet existed; the fallback here only covers the
 * moment before /auth/me resolves.
 */
const useCurrency = () => {
    const { user } = useAuth();
    const currency = user?.currency || DEFAULT_CURRENCY;

    const format = useCallback(
        (cents, options) => formatMoney(cents, currency, options),
        [currency]
    );

    const parse = useCallback(
        (raw) => parseMoneyInput(raw, currency),
        [currency]
    );

    return useMemo(() => ({ currency, format, parse }), [currency, format, parse]);
};

export default useCurrency;
