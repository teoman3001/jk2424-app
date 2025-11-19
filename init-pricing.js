require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pricing_settings (
        id               SERIAL PRIMARY KEY,
        base_fare        NUMERIC(10,2) NOT NULL,
        base_miles       NUMERIC(10,2) NOT NULL,
        extra_mile_rate  NUMERIC(10,2) NOT NULL,
        night_multiplier NUMERIC(10,2) NOT NULL,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await pool.query(`
      INSERT INTO pricing_settings (base_fare, base_miles, extra_mile_rate, night_multiplier)
      SELECT 65, 15, 2, 1.5
      WHERE NOT EXISTS (SELECT 1 FROM pricing_settings);
    `);

    console.log('✅ pricing_settings tablosu ve varsayılan ayarlar hazır.');
  } catch (err) {
    console.error('❌ Hata:', err);
  } finally {
    await pool.end();
  }
})();
