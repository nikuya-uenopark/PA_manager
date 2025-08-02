const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupDatabase() {
    const connectionConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
    };

    let connection;

    try {
        // MySQLに接続
        connection = await mysql.createConnection(connectionConfig);
        console.log('MySQLに接続しました');

        // データベースを作成
        const dbName = process.env.DB_NAME || 'pa_manager_db';
        await connection.execute(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
        console.log(`データベース '${dbName}' を作成しました`);

        // データベースを選択
        await connection.execute(`USE ${dbName}`);

        // ユーザーを作成（必要に応じて）
        const dbUser = process.env.DB_USER || 'pa_manager';
        const dbPassword = process.env.DB_PASSWORD || 'password';
        
        if (dbUser !== 'root') {
            await connection.execute(`CREATE USER IF NOT EXISTS '${dbUser}'@'localhost' IDENTIFIED BY '${dbPassword}'`);
            await connection.execute(`GRANT ALL PRIVILEGES ON ${dbName}.* TO '${dbUser}'@'localhost'`);
            await connection.execute('FLUSH PRIVILEGES');
            console.log(`ユーザー '${dbUser}' を作成しました`);
        }

        console.log('データベースのセットアップが完了しました！');
        console.log('');
        console.log('次の手順を実行してください:');
        console.log('1. .env.example を .env にコピーして設定を確認');
        console.log('2. npm install でパッケージをインストール');
        console.log('3. npm start でサーバーを起動');

    } catch (error) {
        console.error('データベースセットアップでエラーが発生しました:', error);
        
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.log('');
            console.log('MySQLのrootパスワードが正しく設定されていない可能性があります。');
            console.log('.envファイルでDB_PASSWORDを正しく設定してください。');
        }
        
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// 直接実行された場合のみ実行
if (require.main === module) {
    setupDatabase();
}

module.exports = setupDatabase;
