// Vercel Serverless Function: GET /api/stats
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
    const [staffCount] = await connection.execute('SELECT COUNT(*) as count FROM staff');
    const [criteriaCount] = await connection.execute('SELECT COUNT(*) as count FROM criteria');
    const [progressData] = await connection.execute(`
      SELECT AVG(CASE WHEN status = 'can-do' THEN 100 ELSE 0 END) as overall_progress FROM evaluations
    `);
    res.status(200).json({
      staffCount: staffCount[0].count,
      criteriaCount: criteriaCount[0].count,
      overallProgress: Math.round(progressData[0].overall_progress || 0)
    });
  } catch (error) {
    res.status(500).json({ error: '統計情報の取得に失敗しました', detail: error.message });
  } finally {
    if (connection) await connection.end();
  }
}
