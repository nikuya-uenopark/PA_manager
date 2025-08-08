// Vercel Serverless Function: DELETE /api/criteria_delete
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  try {
    const { id } = req.query;
    await pool.query('DELETE FROM criteria WHERE id = $1', [id]);
    res.status(200).json({ message: '評価項目が削除されました' });
  } catch (error) {
    res.status(500).json({ error: '評価項目の削除に失敗しました', detail: error.message });
  }
}
