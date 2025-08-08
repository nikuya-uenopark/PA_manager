// Vercel Serverless Function: PUT /api/evaluation_update
import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
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
    const { staffId, criteriaId, status } = req.body;
    connection = await mysql.createConnection(dbConfig);
    await connection.execute(
      'UPDATE evaluations SET status = ? WHERE staff_id = ? AND criteria_id = ?',
      [status, staffId, criteriaId]
    );
    res.status(200).json({ message: '評価が更新されました' });
  } catch (error) {
    res.status(500).json({ error: '評価の更新に失敗しました', detail: error.message });
  } finally {
    if (connection) await connection.end();
  }
}
