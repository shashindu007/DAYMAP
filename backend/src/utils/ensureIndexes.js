/**
 * One-time index reconciliation, run at boot after the Mongo connection opens.
 *
 * Mongoose's autoIndex calls createIndexes, which ADDS indexes declared in a
 * schema. It never drops one that is no longer declared. So when
 * models/Category.js widened its unique index from { user_id, name } to
 * { user_id, kind, name }, the old index stayed live in any database that had
 * already built it - and kept enforcing "one 'Food' per user" across both
 * kinds. The app-level duplicate check is kind-scoped and would pass, so the
 * failure surfaced as a bare E11000 turning into a 500.
 *
 * This is idempotent (a fresh database simply has nothing to drop) and never
 * fatal: a boot must not fail because an index tidy-up did not apply.
 */
const { mongoose } = require('../config/database');

const STALE_INDEXES = [
    {
        collection: 'categories',
        index: 'user_id_1_name_1',
        supersededBy: 'user_id_1_kind_1_name_1'
    }
];

const ensureIndexes = async () => {
    for (const { collection, index, supersededBy } of STALE_INDEXES) {
        try {
            const handle = mongoose.connection.collection(collection);
            if (await handle.indexExists(index)) {
                await handle.dropIndex(index);
                console.log(`Dropped stale index ${collection}.${index} (superseded by ${supersededBy})`);
            }
        } catch (error) {
            console.warn(`ensureIndexes: could not reconcile ${collection}.${index}:`, error.message);
        }
    }
};

module.exports = { ensureIndexes };
