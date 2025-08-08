// Vercel Serverless Function: GET/POST/DELETE /api/criteria
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// データベース初期化（テーブル拡張）
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // スタッフテーブル拡張
    await client.query(`
      ALTER TABLE staff 
      ADD COLUMN IF NOT EXISTS avatar_url TEXT,
      ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
      ADD COLUMN IF NOT EXISTS email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS hire_date DATE,
      ADD COLUMN IF NOT EXISTS birth_date DATE
    `);
    
    // 評価ログテーブル作成
    await client.query(`
      CREATE TABLE IF NOT EXISTS evaluation_logs (
        id SERIAL PRIMARY KEY,
        staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
        criteria_id INTEGER REFERENCES criteria(id) ON DELETE CASCADE,
        old_score INTEGER,
        new_score INTEGER,
        old_status VARCHAR(50),
        new_status VARCHAR(50),
        comment TEXT,
        changed_by VARCHAR(255),
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // カテゴリーテーブル拡張
    await client.query(`
      ALTER TABLE criteria 
      ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT '共通',
      ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0
    `);
  } finally {
    client.release();
  }
}

module.exports = async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  try {
    // 初回アクセス時にデータベース初期化
    await initializeDatabase();
    
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
