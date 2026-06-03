const Datastore = require('nedb-promises');
const path = require('path');

const DB_DIR = path.join(__dirname);

const db = {
  farmers:   Datastore.create({ filename: path.join(DB_DIR, 'farmers.db'),   autoload: true }),
  prices:    Datastore.create({ filename: path.join(DB_DIR, 'prices.db'),    autoload: true }),
  history:   Datastore.create({ filename: path.join(DB_DIR, 'history.db'),   autoload: true }),
  schemes:   Datastore.create({ filename: path.join(DB_DIR, 'schemes.db'),   autoload: true }),
  alerts:    Datastore.create({ filename: path.join(DB_DIR, 'alerts.db'),    autoload: true }),
  ivr_calls: Datastore.create({ filename: path.join(DB_DIR, 'ivr_calls.db'),autoload: true }),
  wa:        Datastore.create({ filename: path.join(DB_DIR, 'wa.db'),        autoload: true }),
};

async function initDb() {
  // Create indexes for fast lookup
  await db.farmers.ensureIndex({ fieldName: 'mobile', unique: true }).catch(() => {});
  await db.prices.ensureIndex({ fieldName: 'date' }).catch(() => {});
  await db.history.ensureIndex({ fieldName: 'date' }).catch(() => {});
  await db.ivr_calls.ensureIndex({ fieldName: 'created_at' }).catch(() => {});
  await db.wa.ensureIndex({ fieldName: 'updated_at' }).catch(() => {});

  // Seed if empty
  const count = await db.farmers.count({});
  if (count === 0) {
    const { seed } = require('./seed');
    await seed(db);
  }
  console.log('✅ Database ready');
}

module.exports = { db, initDb };
