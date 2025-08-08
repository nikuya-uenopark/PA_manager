// Vercel Serverless Function: GET /api/export
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
    const [staff] = await connection.execute('SELECT * FROM staff');
    const [criteria] = await connection.execute('SELECT * FROM criteria');
    const [evaluations] = await connection.execute('SELECT * FROM evaluations');
    const exportData = {
      staff,
      criteria,
      evaluations,
      exportDate: new Date().toISOString(),
      version: "2.0"
    };
    res.status(200).json(exportData);
  } catch (error) {
    res.status(500).json({ error: 'データのエクスポートに失敗しました', detail: error.message });
  } finally {
    if (connection) await connection.end();
  }
}
