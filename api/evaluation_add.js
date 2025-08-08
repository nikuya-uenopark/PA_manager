// Vercel Serverless Function: POST /api/evaluation_add
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
    const { staff_id, criteria_id, status } = req.body;
    connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute(
      'INSERT INTO evaluations (staff_id, criteria_id, status) VALUES (?, ?, ?)',
      [staff_id, criteria_id, status || 'learning']
    );
    res.status(200).json({ id: result.insertId, message: '評価データが追加されました' });
  } catch (error) {
    res.status(500).json({ error: '評価データの追加に失敗しました', detail: error.message });
  } finally {
    if (connection) await connection.end();
  }
}
