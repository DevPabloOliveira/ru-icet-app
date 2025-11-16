const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Carrega o segredo das variáveis de ambiente
const JWT_SECRET = process.env.JWT_SECRET;

// VERIFICAÇÃO DE SEGURANÇA:
// Se o segredo não estiver definido, o app não deve rodar.
if (!JWT_SECRET) {
    throw new Error('FATAL_ERROR: JWT_SECRET não está definido nas variáveis de ambiente.');
}

/**
 * Faz login do admin
 */
exports.loginAdmin = async (req, res) => {
    try {
        const { usuario, senha } = req.body;
        if (!usuario || !senha) {
            return res.status(400).json({ message: 'Usuário e senha são obrigatórios.' });
        }

        // 1. Encontra o usuário
        const [admins] = await pool.query('SELECT * FROM admins WHERE usuario = ?', [usuario]);
        if (admins.length === 0) {
            return res.status(401).json({ message: 'Usuário ou senha inválidos.' });
        }

        const admin = admins[0];

        // 2. Compara a senha
        const senhaCorreta = await bcrypt.compare(senha, admin.senha_hash);
        if (!senhaCorreta) {
            return res.status(401).json({ message: 'Usuário ou senha inválidos.' });
        }

        // 3. Gera o token JWT
        const tokenPayload = { id: admin.id, usuario: admin.usuario };
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' });

        res.json({
            message: 'Login bem-sucedido!',
            token: token
        });

    } catch (error) {
        res.status(500).json({ message: 'Erro no servidor durante o login.', error: error.message });
    }
};

/**
 * Cria ou Atualiza (UPSERT) um cardápio
 */
exports.postCardapio = async (req, res) => {
    try {
        const { data, desjejum, almoco, janta } = req.body;
        if (!data) {
            return res.status(400).json({ message: 'A data é obrigatória.' });
        }

        // Converte os objetos JSON em strings para salvar no BD
        const desjejumJSON = JSON.stringify(desjejum);
        const almocoJSON = JSON.stringify(almoco);
        const jantaJSON = JSON.stringify(janta);

        // Query de "UPSERT": Insere; se a chave (data) já existir, atualiza os campos.
        const [result] = await pool.query(
            `INSERT INTO cardapios (data, desjejum, almoco, janta) 
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                desjejum = VALUES(desjejum),
                almoco = VALUES(almoco),
                janta = VALUES(janta)`,
            [data, desjejumJSON, almocoJSON, jantaJSON]
        );

        if (result.affectedRows > 0) {
            if (result.insertId > 0) {
                return res.status(201).json({ message: `Cardápio de ${data} criado com sucesso!` });
            } else {
                return res.status(200).json({ message: `Cardápio de ${data} atualizado com sucesso!` });
            }
        }
        
    } catch (error) {
        res.status(500).json({ message: 'Erro ao salvar o cardápio.', error: error.message });
    }
};

/**
 * Busca TODOS os comentários de um dia (visíveis e ocultos)
 */
exports.getComentariosAdmin = async (req, res) => {
    try {
        const { data } = req.params;
        const [comentarios] = await pool.query(
            'SELECT * FROM comentarios WHERE data_cardapio = ? ORDER BY criado_em DESC',
            [data]
        );
        res.json(comentarios);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar comentários.', error: error.message });
    }
};

/**
 * Modera um comentário (Oculta ou Re-exibe)
 */
exports.moderarComentario = async (req, res) => {
    try {
        const { id } = req.params;
        const { visivel } = req.body; // Deve ser true ou false

        if (visivel === undefined) {
            return res.status(400).json({ message: 'Status de visibilidade não fornecido.' });
        }

        await pool.query(
            'UPDATE comentarios SET esta_visivel = ? WHERE id = ?',
            [visivel, id]
        );
        
        res.json({ message: `Comentário ${id} atualizado.` });

    } catch (error) {
        res.status(500).json({ message: 'Erro ao moderar comentário.', error: error.message });
    }
};

/**
 * Deleta um comentário permanentemente
 */
exports.deleteComentario = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM comentarios WHERE id = ?', [id]);
        res.json({ message: `Comentário ${id} deletado.` });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao deletar comentário.', error: error.message });
    }
};