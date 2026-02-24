const express = require('express');
const router = express.Router();
const controller = require('../controllers/adminController');
const verifyToken = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Configuração do Rate Limit para o Login (AUD-03)
// Previne ataques de Força Bruta (Brute Force) e Credential Stuffing
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Janela de 15 minutos
    max: 5, // Limite de 5 tentativas de login por IP
    message: { 
        message: 'Muitas tentativas de login falhas. Por segurança, sua conta/IP foi bloqueada temporariamente. Tente novamente em 15 minutos.' 
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rota de login 
router.post('/login', loginLimiter, controller.loginAdmin);

// Rotas protegidas (requerem token JWT)
router.post('/cardapio', verifyToken, controller.postCardapio);
router.get('/comentarios/:data', verifyToken, controller.getComentariosAdmin);
router.put('/comentarios/moderar/:id', verifyToken, controller.moderarComentario);
router.delete('/comentarios/:id', verifyToken, controller.deleteComentario);

module.exports = router;