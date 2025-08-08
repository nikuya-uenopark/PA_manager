// Vercel Serverless Function: GET/POST/DELETE /api/criteria
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const result = await pool.query('SELECT * FROM criteria ORDER BY category, name');
      res.status(200).json(result.rows);
    } else if (req.method === 'POST') {
      const { name, category, description } = req.body;
      const insertResult = await pool.query(
        'INSERT INTO criteria (name, category, description) VALUES ($1, $2, $3) RETURNING id',
        [name, category, description || '']
      );
      res.status(200).json({ id: insertResult.rows[0].id, message: '評価項目が追加されました' });
    } else if (req.method === 'DELETE') {
      const { id } = req.query;
      await pool.query('DELETE FROM criteria WHERE id = $1', [id]);
      res.status(200).json({ message: '評価項目が削除されました' });
    } else {
      res.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (error) {
    res.status(500).json({ error: 'criteria API error', detail: error.message });
  }
}
