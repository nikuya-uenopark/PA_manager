// Vercel Serverless Function: GET /api/staff-progress
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
    const [rows] = await connection.execute(`
      SELECT 
        s.id,
        s.name,
        s.position,
        COUNT(e.id) as total_criteria,
        SUM(CASE WHEN e.status = 'can-do' THEN 1 ELSE 0 END) as completed_criteria,
        ROUND((SUM(CASE WHEN e.status = 'can-do' THEN 1 ELSE 0 END) / COUNT(e.id)) * 100) as progress_percentage
      FROM staff s
      LEFT JOIN evaluations e ON s.id = e.staff_id
      GROUP BY s.id, s.name, s.position
      ORDER BY s.created_at DESC
    `);
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ error: 'スタッフ進捗情報の取得に失敗しました', detail: error.message });
  } finally {
    if (connection) await connection.end();
  }
}
