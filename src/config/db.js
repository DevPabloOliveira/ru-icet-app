const mysql = require('mysql2/promise');
require('dotenv').config(); 

// Configuração do Pool de Conexões
const pool = mysql.createPool({
  host: process.env.MYSQLHOST || 'localhost',
  user: process.env.MYSQLUSER || 'root',
  password: process.env.MYSQLPASSWORD || '12345678',
  database: process.env.MYSQLDATABASE || 'ru_icet_db',
  port: process.env.MYSQLPORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Testa a conexão ao iniciar
pool.getConnection()
  .then(connection => {
    console.log('✅ Conexão com o banco de dados MySQL estabelecida.');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Erro ao conectar com o banco de dados:');
    console.error(err.message);
    if (err.code === 'ER_BAD_DB_ERROR') {
      console.error('O banco de dados especificado não existe. Verifique seu .env ou as tabelas no Railway.');
    }
  });

module.exports = pool;