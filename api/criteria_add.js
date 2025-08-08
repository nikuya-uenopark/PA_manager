// Vercel Serverless Function: POST /api/criteria_add
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
    const { name, category, description } = req.body;
    const insertResult = await pool.query(
      'INSERT INTO criteria (name, category, description) VALUES ($1, $2, $3) RETURNING id',
      [name, category, description || '']
    );
    res.status(200).json({ id: insertResult.rows[0].id, message: '評価項目が追加されました' });
  } catch (error) {
    res.status(500).json({ error: '評価項目の追加に失敗しました', detail: error.message });
  }
}
