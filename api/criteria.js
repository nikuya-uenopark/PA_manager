// Vercel Serverless Function: GET/POST/DELETE /api/criteria
import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    if (req.method === 'GET') {
      const [rows] = await connection.execute('SELECT * FROM criteria ORDER BY category, name');
      res.status(200).json(rows);
    } else if (req.method === 'POST') {
      const { name, category, description } = req.body;
      const [result] = await connection.execute(
        'INSERT INTO criteria (name, category, description) VALUES (?, ?, ?)',
        [name, category, description || '']
      );
      // 既存スタッフに評価項目追加は省略（必要なら追加）
      res.status(200).json({ id: result.insertId, message: '評価項目が追加されました' });
    } else if (req.method === 'DELETE') {
      const { id } = req.query;
      await connection.execute('DELETE FROM criteria WHERE id = ?', [id]);
      res.status(200).json({ message: '評価項目が削除されました' });
    } else {
      res.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (error) {
    res.status(500).json({ error: 'criteria API error', detail: error.message });
  } finally {
    if (connection) await connection.end();
  }
}
