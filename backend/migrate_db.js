const { pool } = require('./src/config/database');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Looking for all constraints on alerts...');
    const allConstraints = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint 
      WHERE conrelid = 'alerts'::regclass 
      AND contype = 'c';
    `);
    console.log(allConstraints.rows);
    
    const constraint = allConstraints.rows.find(r => r.def.includes('alert_type'));
    if (constraint) {
      console.log('Found constraint:', constraint.conname);
      await client.query(`ALTER TABLE alerts DROP CONSTRAINT ${constraint.conname}`);
      await client.query(`ALTER TABLE alerts ADD CONSTRAINT alerts_alert_type_check CHECK ((alert_type)::text = ANY ((ARRAY['PRICE_DROP'::character varying, 'BACK_IN_STOCK'::character varying, 'STRUCTURE_CHANGE'::character varying, 'OUT_OF_STOCK'::character varying])::text[]))`);
      console.log('Migration completed successfully.');
    } else {
      console.log('Constraint not found!');
    }
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
