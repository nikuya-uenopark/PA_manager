// Vercel Serverless Function: GET /api/staff
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const result = await pool.query('SELECT * FROM staff ORDER BY created_at DESC');
      res.status(200).json(result.rows);
    } catch (error) {
      res.status(500).json({ error: 'スタッフデータの取得に失敗しました', detail: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });
  }
}
