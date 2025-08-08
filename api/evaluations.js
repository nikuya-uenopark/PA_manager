// Vercel Serverless Function: GET/POST /api/evaluations
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  try {
    if (req.method === 'GET') {
      const { staffId } = req.query;
      if (staffId) {
        const result = await pool.query(
          `SELECT e.*, c.name, c.category, c.description 
           FROM evaluations e 
           JOIN criteria c ON e.criteria_id = c.id 
           WHERE e.staff_id = $1 
           ORDER BY c.category, c.name`,
          [staffId]
        );
        res.status(200).json(result.rows);
      } else {
        const result = await pool.query('SELECT * FROM evaluations ORDER BY created_at DESC');
        res.status(200).json(result.rows);
      }
    } else if (req.method === 'POST') {
      const { staff_id, criteria_id, status } = req.body;
      const insertResult = await pool.query(
        'INSERT INTO evaluations (staff_id, criteria_id, status) VALUES ($1, $2, $3) RETURNING id',
        [staff_id, criteria_id, status || 'learning']
      );
      res.status(200).json({ id: insertResult.rows[0].id, message: '評価データが追加されました' });
    } else if (req.method === 'PUT') {
      const { staffId, criteriaId, status } = req.body;
      await pool.query(
        'UPDATE evaluations SET status = $1 WHERE staff_id = $2 AND criteria_id = $3',
        [status, staffId, criteriaId]
      );
      res.status(200).json({ message: '評価が更新されました' });
    } else if (req.method === 'DELETE') {
      const { id } = req.query;
      await pool.query('DELETE FROM evaluations WHERE id = $1', [id]);
      res.status(200).json({ message: '評価データが削除されました' });
    } else {
      res.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (error) {
    res.status(500).json({ error: 'evaluations API error', detail: error.message });
  }
}
