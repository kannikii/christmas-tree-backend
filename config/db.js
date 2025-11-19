require('dotenv').config();
const mysql = require('mysql2');

let pool;

function createPool() {
  pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  // Pool 에러 처리
  pool.on('error', (err) => {
    console.error('❌ MySQL Pool Error:', err.code);

    if (
      err.code === 'PROTOCOL_CONNECTION_LOST' ||
      err.code === 'ECONNRESET' ||
      err.code === 'ECONNREFUSED'
    ) {
      console.log('🔄 MySQL connection lost. Recreating pool...');
      createPool();
    } else {
      console.error('⚠️ Unexpected MySQL Error:', err);
    }
  });

  console.log('✅ MySQL Pool Created');
}

createPool();

// (선택) Keep-Alive Ping – Railway Sleep 감소
setInterval(() => {
  pool.query('SELECT 1', (err) => {
    if (err) {
      console.error('⚠️ MySQL Keep-Alive Ping Failed:', err.code);
    }
  });
}, 1000 * 60 * 5); // 5분마다 Ping

module.exports = pool;
