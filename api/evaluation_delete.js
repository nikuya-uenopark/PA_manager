// Vercel Serverless Function: DELETE /api/evaluation_delete
import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
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
    const { id } = req.query;
    connection = await mysql.createConnection(dbConfig);
    await connection.execute('DELETE FROM evaluations WHERE id = ?', [id]);
    res.status(200).json({ message: '評価データが削除されました' });
  } catch (error) {
    res.status(500).json({ error: '評価データの削除に失敗しました', detail: error.message });
  } finally {
    if (connection) await connection.end();
  }
}
