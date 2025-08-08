// Vercel Serverless Function: POST /api/staff_add
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
    const { name, position } = req.body;
    const insertResult = await pool.query(
      'INSERT INTO staff (name, position) VALUES ($1, $2) RETURNING id',
      [name, position || '未設定']
    );
    const staffId = insertResult.rows[0].id;
    const criteria = await pool.query('SELECT id FROM criteria');
    for (const criterion of criteria.rows) {
      await pool.query(
        'INSERT INTO evaluations (staff_id, criteria_id, status) VALUES ($1, $2, $3)',
        [staffId, criterion.id, 'learning']
      );
    }
    res.status(200).json({ id: staffId, message: 'スタッフが追加されました' });
  } catch (error) {
    res.status(500).json({ error: 'スタッフの追加に失敗しました', detail: error.message });
  }
}
