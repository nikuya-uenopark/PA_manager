// Vercel Serverless Function: GET /api/staff

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method === 'GET') {
    // スタッフ一覧取得
    try {
      const result = await pool.query('SELECT * FROM staff ORDER BY created_at DESC');
      res.status(200).json(result.rows);
    } catch (error) {
      res.status(500).json({ error: 'スタッフデータの取得に失敗しました', detail: error.message });
    }
  } else if (req.method === 'POST') {
    // スタッフ追加
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
  } else if (req.method === 'DELETE') {
    // スタッフ削除
    try {
      const { id } = req.query;
      await pool.query('DELETE FROM staff WHERE id = $1', [id]);
      res.status(200).json({ message: 'スタッフが削除されました' });
    } catch (error) {
      res.status(500).json({ error: 'スタッフの削除に失敗しました', detail: error.message });
    }
  } else if (req.method === 'PATCH') {
    // スタッフ進捗取得
    try {
      const result = await pool.query(`
        SELECT 
          s.id,
          s.name,
          s.position,
          COUNT(e.id) as total_criteria,
          SUM(CASE WHEN e.status = 'can-do' THEN 1 ELSE 0 END) as completed_criteria,
          ROUND((SUM(CASE WHEN e.status = 'can-do' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(e.id),0)) * 100) as progress_percentage
        FROM staff s
        LEFT JOIN evaluations e ON s.id = e.staff_id
        GROUP BY s.id, s.name, s.position
        ORDER BY s.id DESC
      `);
      res.status(200).json(result.rows);
    } catch (error) {
      res.status(500).json({ error: 'スタッフ進捗情報の取得に失敗しました', detail: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });
  }
}
