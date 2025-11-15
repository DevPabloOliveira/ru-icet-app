const express = require('express');
const router = express.Router();
const controller = require('../controllers/adminController');
const verifyToken = require('../middleware/auth');

// Rota de login (pública)
router.post('/login', controller.loginAdmin);

// Rotas protegidas (requerem token JWT)
router.post('/cardapio', verifyToken, controller.postCardapio);
router.get('/comentarios/:data', verifyToken, controller.getComentariosAdmin);
router.put('/comentarios/moderar/:id', verifyToken, controller.moderarComentario);
router.delete('/comentarios/:id', verifyToken, controller.deleteComentario);

module.exports = router;
