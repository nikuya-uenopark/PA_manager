// Vercel Serverless Function: GET /api/staff
import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  // DB接続情報はVercelの環境変数で管理
  const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };

  if (req.method === 'GET') {
    let connection;
    try {
      connection = await mysql.createConnection(dbConfig);
      const [rows] = await connection.execute('SELECT * FROM staff ORDER BY created_at DESC');
      res.status(200).json(rows);
    } catch (error) {
      res.status(500).json({ error: 'スタッフデータの取得に失敗しました', detail: error.message });
    } finally {
      if (connection) await connection.end();
    }
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });
  }
}
