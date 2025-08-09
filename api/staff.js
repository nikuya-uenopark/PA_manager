// Vercel Serverless Function: GET /api/staff
const { Client } = require('pg');

const client = new Client({
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
      await client.connect();
      const result = await client.query('SELECT * FROM staff ORDER BY created_at DESC');
      res.status(200).json(result.rows);
    } catch (error) {
      console.error('Staff GET error:', error);
      res.status(500).json({ error: 'スタッフデータの取得に失敗しました', detail: error.message });
    } finally {
      await client.end();
    }
  } else if (req.method === 'POST') {
    // スタッフ追加
    try {
      const { name, position, email, phone } = req.body;
      await client.connect();
      const result = await client.query(
        'INSERT INTO staff (name, position, email, phone) VALUES ($1, $2, $3, $4) RETURNING id',
        [name, position, email, phone]
      );
      res.status(200).json({ id: result.rows[0].id, message: 'スタッフが追加されました' });
    } catch (error) {
      console.error('Staff POST error:', error);
      res.status(500).json({ error: 'スタッフの追加に失敗しました', detail: error.message });
    } finally {
      await client.end();
    }
  } else if (req.method === 'DELETE') {
    // スタッフ削除
    try {
      const { id } = req.query;
      await client.connect();
      await client.query('DELETE FROM staff WHERE id = $1', [id]);
      res.status(200).json({ message: 'スタッフが削除されました' });
    } catch (error) {
      console.error('Staff DELETE error:', error);
      res.status(500).json({ error: 'スタッフの削除に失敗しました', detail: error.message });
    } finally {
      await client.end();
    }
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });
  }
};
