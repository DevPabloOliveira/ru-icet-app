const express = require('express');
const router = express.Router();
const controller = require('../controllers/publicController');
const rateLimit = require('express-rate-limit');

// Configuração do Rate Limit para a Rota de Votos (AUD-02)
// Evita que um atacante faça requisições automatizadas para inflar os votos
const voteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Janela de 15 minutos
    max: 10, // Limite de 10 requisições de voto por IP nesta janela
    message: { 
        message: 'Muitas tentativas de voto a partir desta rede. Por favor, tente novamente em 15 minutos.' 
    },
    standardHeaders: true, 
    legacyHeaders: false, 
});

// Rotas públicas da aplicação
router.get('/cardapio/semana', controller.getDadosSemana);
router.get('/cardapio/:data', controller.getCardapioDoDia);
router.get('/ranking', controller.getRanking);
router.post('/comentarios', controller.postComentario);

// >>> APLICA O LIMITADOR APENAS NA ROTA DE VOTAR <<<
router.post('/votar', voteLimiter, controller.postVoto);

module.exports = router;