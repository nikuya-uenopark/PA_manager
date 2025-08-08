// Vercel Serverless Function: POST /api/evaluation_add
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  try {
    const { staff_id, criteria_id, status } = req.body;
    const insertResult = await pool.query(
      'INSERT INTO evaluations (staff_id, criteria_id, status) VALUES ($1, $2, $3) RETURNING id',
      [staff_id, criteria_id, status || 'learning']
    );
    res.status(200).json({ id: insertResult.rows[0].id, message: '評価データが追加されました' });
  } catch (error) {
    res.status(500).json({ error: '評価データの追加に失敗しました', detail: error.message });
  }
}
