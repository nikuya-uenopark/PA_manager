// Vercel Serverless Function: POST /api/criteria_add
import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };
  let connection;
  try {
    const { name, category, description } = req.body;
    connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute(
      'INSERT INTO criteria (name, category, description) VALUES (?, ?, ?)',
      [name, category, description || '']
    );
    res.status(200).json({ id: result.insertId, message: '評価項目が追加されました' });
  } catch (error) {
    res.status(500).json({ error: '評価項目の追加に失敗しました', detail: error.message });
  } finally {
    if (connection) await connection.end();
  }
}
