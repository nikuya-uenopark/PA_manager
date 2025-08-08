const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// MySQL接続設定
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'pa_manager',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'pa_manager_db'
};

// データベース接続プール
let pool;
let useJsonStorage = false;
const JSON_DATA_FILE = path.join(__dirname, 'data.json');

// JSON ファイル操作関数
function readJsonData() {
    try {
        const data = fs.readFileSync(JSON_DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('JSON データファイルの読み込みエラー:', error);
        // エラーの場合は初期データを返す
        return {
            staff: [],
            criteria: [],
            evaluations: [],
            nextId: { staff: 1, criteria: 1, evaluations: 1 }
        };
    }
}

function writeJsonData(data) {
    try {
        fs.writeFileSync(JSON_DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('JSON データファイルの書き込みエラー:', error);
        return false;
    }
}

async function initDatabase() {
    try {
        // まずMySQLに接続を試す
        pool = mysql.createPool({
            ...dbConfig,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
        
        // 接続テスト
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        
        console.log('MySQL データベース接続プールが初期化されました');
        
        // データベースの初期化
        await setupTables();
        useJsonStorage = false;
        
    } catch (error) {
        console.log('MySQL接続に失敗しました。JSONファイルストレージを使用します。');
        console.log('MySQL エラー:', error.message);
        
        // MySQLに接続できない場合はJSONストレージを使用
        useJsonStorage = true;
        
        // JSON ファイルが存在しない場合は作成
        if (!fs.existsSync(JSON_DATA_FILE)) {
            const initialData = {
                staff: [],
                criteria: [
                    { id: 1, name: '基本的な挨拶', category: '基本スキル', description: 'お客様への適切な挨拶ができる', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
                    { id: 2, name: 'レジ操作', category: '基本スキル', description: 'レジでの基本的な会計処理ができる', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
                    { id: 3, name: '商品の場所案内', category: '接客', description: 'お客様への商品案内が適切にできる', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
                    { id: 4, name: 'クレーム対応', category: '接客', description: '基本的なクレーム対応ができる', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
                    { id: 5, name: '清掃作業', category: '基本スキル', description: '店舗の清掃作業を適切に行える', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
                ],
                evaluations: [],
                nextId: { staff: 1, criteria: 6, evaluations: 1 }
            };
            writeJsonData(initialData);
        }
        
        console.log('JSON ファイルストレージが初期化されました');
    }
}

async function setupTables() {
    const connection = await pool.getConnection();
    
    try {
        // スタッフテーブル
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS staff (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                position VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        
        // 評価項目テーブル
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS criteria (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                category VARCHAR(100),
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        
        // 評価テーブル
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS evaluations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                staff_id INT,
                criteria_id INT,
                status ENUM('can-do', 'learning', 'cannot-do') DEFAULT 'learning',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
                FOREIGN KEY (criteria_id) REFERENCES criteria(id) ON DELETE CASCADE,
                UNIQUE KEY unique_evaluation (staff_id, criteria_id)
            )
        `);
        
        // デフォルトデータの挿入
        await insertDefaultCriteria(connection);
        
        console.log('データベーステーブルが初期化されました');
        
    } catch (error) {
        console.error('テーブル作成エラー:', error);
    } finally {
        connection.release();
    }
}

async function insertDefaultCriteria(connection) {
    const defaultCriteria = [
        { name: '基本的な挨拶', category: '基本スキル', description: 'お客様への適切な挨拶ができる' },
        { name: 'レジ操作', category: '基本スキル', description: 'レジでの基本的な会計処理ができる' },
        { name: '商品の場所案内', category: '接客', description: 'お客様への商品案内が適切にできる' },
        { name: 'クレーム対応', category: '接客', description: '基本的なクレーム対応ができる' },
        { name: '清掃作業', category: '基本スキル', description: '店舗の清掃作業を適切に行える' }
    ];
    
    for (const criteria of defaultCriteria) {
        await connection.execute(
            'INSERT IGNORE INTO criteria (name, category, description) VALUES (?, ?, ?)',
            [criteria.name, criteria.category, criteria.description]
        );
    }
}

// API エンドポイント

// スタッフ関連（APIプレフィックス付き）
app.get('/api/staff', async (req, res) => {
    try {
        if (useJsonStorage) {
            const data = readJsonData();
            res.json(data.staff.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
        } else {
            const [rows] = await pool.execute('SELECT * FROM staff ORDER BY created_at DESC');
            res.json(rows);
        }
    } catch (error) {
        res.status(500).json({ error: 'スタッフデータの取得に失敗しました' });
    }
});

// スタッフ関連（プレフィックスなし - 要求仕様用）
app.get('/staff', async (req, res) => {
    try {
        if (useJsonStorage) {
            const data = readJsonData();
            res.json(data.staff.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
        } else {
            const [rows] = await pool.execute('SELECT * FROM staff ORDER BY created_at DESC');
            res.json(rows);
        }
    } catch (error) {
        res.status(500).json({ error: 'スタッフデータの取得に失敗しました' });
    }
});

app.post('/staff', async (req, res) => {
    try {
        const { name, position } = req.body;
        
        if (useJsonStorage) {
            const data = readJsonData();
            const newStaff = {
                id: data.nextId.staff,
                name,
                position: position || '未設定',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            data.staff.push(newStaff);
            data.nextId.staff++;
            
            // 新しいスタッフに対して全評価項目を学習中で初期化
            for (const criterion of data.criteria) {
                data.evaluations.push({
                    id: data.nextId.evaluations,
                    staff_id: newStaff.id,
                    criteria_id: criterion.id,
                    status: 'learning',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
                data.nextId.evaluations++;
            }
            
            if (writeJsonData(data)) {
                res.json({ id: newStaff.id, message: 'スタッフが追加されました' });
            } else {
                res.status(500).json({ error: 'スタッフの追加に失敗しました' });
            }
        } else {
            const [result] = await pool.execute(
                'INSERT INTO staff (name, position) VALUES (?, ?)',
                [name, position || '未設定']
            );
            
            // 新しいスタッフに対して全評価項目を学習中で初期化
            const [criteria] = await pool.execute('SELECT id FROM criteria');
            for (const criterion of criteria) {
                await pool.execute(
                    'INSERT INTO evaluations (staff_id, criteria_id, status) VALUES (?, ?, "learning")',
                    [result.insertId, criterion.id]
                );
            }
            
            res.json({ id: result.insertId, message: 'スタッフが追加されました' });
        }
    } catch (error) {
        res.status(500).json({ error: 'スタッフの追加に失敗しました' });
    }
});

app.delete('/staff/:id', async (req, res) => {
    try {
        const staffId = parseInt(req.params.id);
        
        if (useJsonStorage) {
            const data = readJsonData();
            data.staff = data.staff.filter(staff => staff.id !== staffId);
            data.evaluations = data.evaluations.filter(evaluation => evaluation.staff_id !== staffId);
            
            if (writeJsonData(data)) {
                res.json({ message: 'スタッフが削除されました' });
            } else {
                res.status(500).json({ error: 'スタッフの削除に失敗しました' });
            }
        } else {
            await pool.execute('DELETE FROM staff WHERE id = ?', [staffId]);
            res.json({ message: 'スタッフが削除されました' });
        }
    } catch (error) {
        res.status(500).json({ error: 'スタッフの削除に失敗しました' });
    }
});

app.post('/api/staff', async (req, res) => {
    try {
        const { name, position } = req.body;
        
        if (useJsonStorage) {
            const data = readJsonData();
            const newStaff = {
                id: data.nextId.staff,
                name,
                position: position || '未設定',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            data.staff.push(newStaff);
            data.nextId.staff++;
            
            // 新しいスタッフに対して全評価項目を学習中で初期化
            for (const criterion of data.criteria) {
                data.evaluations.push({
                    id: data.nextId.evaluations,
                    staff_id: newStaff.id,
                    criteria_id: criterion.id,
                    status: 'learning',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
                data.nextId.evaluations++;
            }
            
            if (writeJsonData(data)) {
                res.json({ id: newStaff.id, message: 'スタッフが追加されました' });
            } else {
                res.status(500).json({ error: 'スタッフの追加に失敗しました' });
            }
        } else {
            const [result] = await pool.execute(
                'INSERT INTO staff (name, position) VALUES (?, ?)',
                [name, position || '未設定']
            );
            
            // 新しいスタッフに対して全評価項目を学習中で初期化
            const [criteria] = await pool.execute('SELECT id FROM criteria');
            for (const criterion of criteria) {
                await pool.execute(
                    'INSERT INTO evaluations (staff_id, criteria_id, status) VALUES (?, ?, "learning")',
                    [result.insertId, criterion.id]
                );
            }
            
            res.json({ id: result.insertId, message: 'スタッフが追加されました' });
        }
    } catch (error) {
        res.status(500).json({ error: 'スタッフの追加に失敗しました' });
    }
});

app.delete('/api/staff/:id', async (req, res) => {
    try {
        const staffId = parseInt(req.params.id);
        
        if (useJsonStorage) {
            const data = readJsonData();
            data.staff = data.staff.filter(staff => staff.id !== staffId);
            data.evaluations = data.evaluations.filter(evaluation => evaluation.staff_id !== staffId);
            
            if (writeJsonData(data)) {
                res.json({ message: 'スタッフが削除されました' });
            } else {
                res.status(500).json({ error: 'スタッフの削除に失敗しました' });
            }
        } else {
            await pool.execute('DELETE FROM staff WHERE id = ?', [staffId]);
            res.json({ message: 'スタッフが削除されました' });
        }
    } catch (error) {
        res.status(500).json({ error: 'スタッフの削除に失敗しました' });
    }
});

// 評価項目関連
app.get('/api/criteria', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM criteria ORDER BY category, name');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: '評価項目の取得に失敗しました' });
    }
});

app.post('/api/criteria', async (req, res) => {
    try {
        const { name, category, description } = req.body;
        const [result] = await pool.execute(
            'INSERT INTO criteria (name, category, description) VALUES (?, ?, ?)',
            [name, category, description || '']
        );
        
        // 既存の全スタッフに対して新しい評価項目を学習中で追加
        const [staff] = await pool.execute('SELECT id FROM staff');
        for (const member of staff) {
            await pool.execute(
                'INSERT INTO evaluations (staff_id, criteria_id, status) VALUES (?, ?, "learning")',
                [member.id, result.insertId]
            );
        }
        
        res.json({ id: result.insertId, message: '評価項目が追加されました' });
    } catch (error) {
        res.status(500).json({ error: '評価項目の追加に失敗しました' });
    }
});

app.delete('/api/criteria/:id', async (req, res) => {
    try {
        await pool.execute('DELETE FROM criteria WHERE id = ?', [req.params.id]);
        res.json({ message: '評価項目が削除されました' });
    } catch (error) {
        res.status(500).json({ error: '評価項目の削除に失敗しました' });
    }
});

// 評価関連
app.get('/evaluations', async (req, res) => {
    try {
        if (useJsonStorage) {
            const data = readJsonData();
            res.json(data.evaluations);
        } else {
            const [rows] = await pool.execute('SELECT * FROM evaluations ORDER BY created_at DESC');
            res.json(rows);
        }
    } catch (error) {
        res.status(500).json({ error: '評価データの取得に失敗しました' });
    }
});

app.post('/evaluations', async (req, res) => {
    try {
        const { staff_id, criteria_id, status } = req.body;
        
        if (useJsonStorage) {
            const data = readJsonData();
            const newEvaluation = {
                id: data.nextId.evaluations,
                staff_id: parseInt(staff_id),
                criteria_id: parseInt(criteria_id),
                status: status || 'learning',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            data.evaluations.push(newEvaluation);
            data.nextId.evaluations++;
            
            if (writeJsonData(data)) {
                res.json({ id: newEvaluation.id, message: '評価データが追加されました' });
            } else {
                res.status(500).json({ error: '評価データの追加に失敗しました' });
            }
        } else {
            const [result] = await pool.execute(
                'INSERT INTO evaluations (staff_id, criteria_id, status) VALUES (?, ?, ?)',
                [staff_id, criteria_id, status || 'learning']
            );
            res.json({ id: result.insertId, message: '評価データが追加されました' });
        }
    } catch (error) {
        res.status(500).json({ error: '評価データの追加に失敗しました' });
    }
});

app.get('/api/evaluations/:staffId', async (req, res) => {
    try {
        const staffId = parseInt(req.params.staffId);
        
        if (useJsonStorage) {
            const data = readJsonData();
            const staffEvaluations = data.evaluations
                .filter(evaluation => evaluation.staff_id === staffId)
                .map(evaluation => {
                    const criterion = data.criteria.find(c => c.id === evaluation.criteria_id);
                    return {
                        ...evaluation,
                        name: criterion ? criterion.name : 'Unknown',
                        category: criterion ? criterion.category : 'Unknown',
                        description: criterion ? criterion.description : ''
                    };
                })
                .sort((a, b) => a.category.localeCompare(b.category));
            
            res.json(staffEvaluations);
        } else {
            const [rows] = await pool.execute(`
                SELECT e.*, c.name, c.category, c.description 
                FROM evaluations e 
                JOIN criteria c ON e.criteria_id = c.id 
                WHERE e.staff_id = ? 
                ORDER BY c.category, c.name
            `, [staffId]);
            res.json(rows);
        }
    } catch (error) {
        res.status(500).json({ error: '評価データの取得に失敗しました' });
    }
});

app.put('/api/evaluations/:staffId/:criteriaId', async (req, res) => {
    try {
        const { status } = req.body;
        await pool.execute(
            'UPDATE evaluations SET status = ? WHERE staff_id = ? AND criteria_id = ?',
            [status, req.params.staffId, req.params.criteriaId]
        );
        res.json({ message: '評価が更新されました' });
    } catch (error) {
        res.status(500).json({ error: '評価の更新に失敗しました' });
    }
});

// 統計情報
app.get('/api/stats', async (req, res) => {
    try {
        const [staffCount] = await pool.execute('SELECT COUNT(*) as count FROM staff');
        const [criteriaCount] = await pool.execute('SELECT COUNT(*) as count FROM criteria');
        const [progressData] = await pool.execute(`
            SELECT 
                AVG(CASE WHEN status = 'can-do' THEN 100 ELSE 0 END) as overall_progress
            FROM evaluations
        `);
        
        res.json({
            staffCount: staffCount[0].count,
            criteriaCount: criteriaCount[0].count,
            overallProgress: Math.round(progressData[0].overall_progress || 0)
        });
    } catch (error) {
        res.status(500).json({ error: '統計情報の取得に失敗しました' });
    }
});

// スタッフ進捗情報
app.get('/api/staff-progress', async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT 
                s.id,
                s.name,
                s.position,
                COUNT(e.id) as total_criteria,
                SUM(CASE WHEN e.status = 'can-do' THEN 1 ELSE 0 END) as completed_criteria,
                ROUND(
                    (SUM(CASE WHEN e.status = 'can-do' THEN 1 ELSE 0 END) / COUNT(e.id)) * 100
                ) as progress_percentage
            FROM staff s
            LEFT JOIN evaluations e ON s.id = e.staff_id
            GROUP BY s.id, s.name, s.position
            ORDER BY s.created_at DESC
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'スタッフ進捗情報の取得に失敗しました' });
    }
});

// データエクスポート
app.get('/api/export', async (req, res) => {
    try {
        const [staff] = await pool.execute('SELECT * FROM staff');
        const [criteria] = await pool.execute('SELECT * FROM criteria');
        const [evaluations] = await pool.execute('SELECT * FROM evaluations');
        
        const exportData = {
            staff,
            criteria,
            evaluations,
            exportDate: new Date().toISOString(),
            version: "2.0"
        };
        
        res.json(exportData);
    } catch (error) {
        res.status(500).json({ error: 'データのエクスポートに失敗しました' });
    }
});

// 静的ファイルの提供
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// サーバー起動
async function startServer() {
    await initDatabase();
    
    app.listen(PORT, () => {
        console.log(`サーバーがポート ${PORT} で起動しました`);
        console.log(`http://localhost:${PORT} でアクセスできます`);
    });
}

startServer().catch(console.error);
