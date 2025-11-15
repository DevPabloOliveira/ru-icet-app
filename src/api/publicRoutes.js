const express = require('express');
const router = express.Router();
const controller = require('../controllers/publicController');

// Rotas públicas da aplicação
router.get('/cardapio/semana', controller.getDadosSemana);
router.get('/cardapio/:data', controller.getCardapioDoDia);
router.get('/ranking', controller.getRanking);
router.post('/comentarios', controller.postComentario);
router.post('/votar', controller.postVoto);

module.exports = router;
