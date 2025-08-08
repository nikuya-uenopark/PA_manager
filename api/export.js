// Vercel Serverless Function: GET /api/export
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  try {
    const staff = await pool.query('SELECT * FROM staff');
    const criteria = await pool.query('SELECT * FROM criteria');
    const evaluations = await pool.query('SELECT * FROM evaluations');
    const exportData = {
      staff: staff.rows,
      criteria: criteria.rows,
      evaluations: evaluations.rows,
      exportDate: new Date().toISOString(),
      version: "2.0"
    };
    res.status(200).json(exportData);
  } catch (error) {
    res.status(500).json({ error: 'データのエクスポートに失敗しました', detail: error.message });
  }
}
