// Vercel Serverless Function: PUT /api/evaluation_update
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  try {
    const { staffId, criteriaId, status } = req.body;
    await pool.query(
      'UPDATE evaluations SET status = $1 WHERE staff_id = $2 AND criteria_id = $3',
      [status, staffId, criteriaId]
    );
    res.status(200).json({ message: '評価が更新されました' });
  } catch (error) {
    res.status(500).json({ error: '評価の更新に失敗しました', detail: error.message });
  }
}
