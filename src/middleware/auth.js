const jwt = require('jsonwebtoken');

// Carrega o segredo das variáveis de ambiente
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('FATAL_ERROR: JWT_SECRET não está definido nas variáveis de ambiente.');
}

/**
 * Middleware para verificar o token JWT
 * Este middleware é usado em rotas protegidas para garantir que 
 * apenas usuários autenticados (com um token válido) possam acessá-las.
 */
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Formato: "Bearer <token>"

    if (!token) {
        return res.status(401).json({ message: 'Acesso negado. Nenhum token fornecido.' });
    }

    try {
        // Verifica se o token é válido e se foi assinado com o nosso segredo
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Adiciona os dados do usuário (payload do token) ao objeto 'req'
        // para que as próximas rotas possam usá-lo (ex: req.user.id)
        req.user = decoded;
        
        // Passa para a próxima função (o controller da rota)
        next();
        
    } catch (error) {
        // Se o token for inválido, expirado ou houver outro erro
        res.status(401).json({ message: 'Token inválido ou expirado.' });
    }
}

module.exports = verifyToken;