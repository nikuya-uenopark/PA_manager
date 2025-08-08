// Vercel Serverless Function: GET/POST/DELETE /api/criteria
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const result = await pool.query('SELECT * FROM criteria ORDER BY sort_order ASC NULLS LAST, id ASC');
      res.status(200).json(result.rows);
    } else if (req.method === 'POST') {
      const { name, category, description } = req.body;
      // 新規追加時は最大sort_order+1
      const maxOrderRes = await pool.query('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM criteria');
      const sort_order = maxOrderRes.rows[0].max_order + 1;
      const insertResult = await pool.query(
        'INSERT INTO criteria (name, category, description, sort_order) VALUES ($1, $2, $3, $4) RETURNING id',
        [name, category, description || '', sort_order]
      );
      res.status(200).json({ id: insertResult.rows[0].id, message: '評価項目が追加されました' });
    } else if (req.method === 'DELETE') {
      const { id } = req.query;
      await pool.query('DELETE FROM criteria WHERE id = $1', [id]);
      res.status(200).json({ message: '評価項目が削除されました' });
    } else if (req.method === 'PUT') {
      // 並び順一括更新
      const { order } = req.body; // [{id, sort_order}, ...]
      if (!Array.isArray(order)) return res.status(400).json({ error: 'Invalid order' });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const item of order) {
          await client.query('UPDATE criteria SET sort_order = $1 WHERE id = $2', [item.sort_order, item.id]);
        }
        await client.query('COMMIT');
        res.status(200).json({ message: '順序を保存しました' });
      } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: '順序保存エラー', detail: e.message });
      } finally {
        client.release();
      }
    } else {
      res.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (error) {
    res.status(500).json({ error: 'criteria API error', detail: error.message });
  }
}
