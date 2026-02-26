const swaggerUi = require('swagger-ui-express');
const swaggerDocs = require('./config/swagger');
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./config/db'); 

const publicRoutes = require('./api/publicRoutes');
const adminRoutes = require('./api/adminRoutes');

const app = express();

//RATE LIMIT
app.set('trust proxy', 1);

// Configurações básicas do Express
app.use(cors());
app.use(express.json());

// Configuração do Swagger UI (Documentação da API)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs, {
    customCss: '.swagger-ui .topbar { display: none }', 
    customSiteTitle: "API Docs - Sabores da SI"
}));

// Servir frontend público
app.use(express.static(path.join(__dirname, '..', 'public')));

// Rotas da API
app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

// Rotas de fallback (SPA)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin', 'index.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Frontend: http://localhost:${PORT}`);
  console.log(`Painel Admin: http://localhost:${PORT}/admin`);
});
