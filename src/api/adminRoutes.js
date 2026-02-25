const express = require('express');
const router = express.Router();
const controller = require('../controllers/adminController');
const verifyToken = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const multer = require('multer'); 

// Configuração do Multer para armazenar o arquivo em memória (Buffer)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // Limite de 5MB 
});

// Configuração do Rate Limit para o Login (AUD-03)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { message: 'Muitas tentativas de login falhas. Tente novamente em 15 minutos.' },
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

// >>> NOVA ROTA: RF008 - Importar Planilha <<<
// O upload.single('planilha') intercepta o arquivo enviado pelo frontend com o nome "planilha"
router.post('/importar', verifyToken, upload.single('planilha'), controller.importarPlanilha);

module.exports = router;