// Vercel Serverless Function: GET/POST/DELETE /api/criteria
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// データベース初期化（テーブル拡張）
async function initializeDatabase() {
  try {
    // 基本テーブル作成
    await pool.query(`
      CREATE TABLE IF NOT EXISTS staff (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        position VARCHAR(100),
        email VARCHAR(255),
        phone VARCHAR(20),
        joined DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS criteria (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) DEFAULT '共通',
        description TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS evaluations (
        id SERIAL PRIMARY KEY,
        staff_id INTEGER REFERENCES staff(id),
        criteria_id INTEGER REFERENCES criteria(id),
        status VARCHAR(50) DEFAULT 'not-started',
        score INTEGER,
        comments TEXT,
        evaluated_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // テーブル拡張（カラム追加）
    await pool.query(`
      ALTER TABLE criteria 
      ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT '共通',
      ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0
    `);
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
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
      const maxOrderResult = await pool.query('SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM criteria');
      const nextOrder = maxOrderResult.rows[0].next_order;
      
      const result = await pool.query(
        'INSERT INTO criteria (name, category, description, sort_order) VALUES ($1, $2, $3, $4) RETURNING id',
        [name, category || '共通', description, nextOrder]
      );
      res.status(200).json({ id: result.rows[0].id, message: '評価項目が追加されました' });
    } else if (req.method === 'PUT') {
      const { items } = req.body;
      if (items && Array.isArray(items)) {
        // 並び替え更新
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          for (let i = 0; i < items.length; i++) {
            await client.query(
              'UPDATE criteria SET sort_order = $1 WHERE id = $2',
              [i, items[i].id]
            );
          }
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
        res.status(200).json({ message: '並び順が更新されました' });
      } else {
        // 単一項目更新
        const { id } = req.query;
        const { name, category, description } = req.body;
        await pool.query(
          'UPDATE criteria SET name = $1, category = $2, description = $3 WHERE id = $4',
          [name, category || '共通', description, id]
        );
        res.status(200).json({ message: '評価項目が更新されました' });
      }
    } else if (req.method === 'DELETE') {
      const { id } = req.query;
      await pool.query('DELETE FROM criteria WHERE id = $1', [id]);
      res.status(200).json({ message: '評価項目が削除されました' });
    } else {
      res.status(405).json({ error: 'Method Not Allowed' });
    }
    
  } catch (error) {
    console.error('Criteria API error:', error);
    res.status(500).json({ 
      error: '評価項目API エラー', 
      detail: error.message 
    });
  }
};
