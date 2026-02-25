const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const xlsx = require('xlsx');

// Carrega o segredo das variáveis de ambiente
const JWT_SECRET = process.env.JWT_SECRET;

// VERIFICAÇÃO DE SEGURANÇA:
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
        const { visivel } = req.body; 

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

/**
 * RF008: Importar Cardápio em Lote via Planilha (XLSX/CSV)
 */
exports.importarPlanilha = async (req, res) => {
    try {
        // 1. Verifica se o arquivo foi enviado
        if (!req.file) {
            return res.status(400).json({ message: 'Nenhum arquivo enviado. Anexe uma planilha.' });
        }

        // 2. Lê a planilha a partir do buffer em memória
        const workbook = xlsx.read(req.file.buffer, { 
            type: 'buffer',
            codepage: 65001 
        });
        
        // Pega a primeira aba da planilha
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Converte a aba em um Array de Objetos JSON. raw: false garante que datas venham como string
        const dadosPlanilha = xlsx.utils.sheet_to_json(sheet, { defval: "" });

        if (dadosPlanilha.length === 0) {
            return res.status(400).json({ message: 'A planilha está vazia.' });
        }

        let connection;
        let diasImportados = 0;

        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            // 3. Itera sobre cada linha da planilha
            for (const linha of dadosPlanilha) {
                if (!linha.Data) continue; 

                // Converte a data (ex: 25/10/2025 ou 2025-10-25) para o padrão YYYY-MM-DD do MySQL
                let dataFormatada = linha.Data;
                if (dataFormatada.includes('/')) {
                    const partes = dataFormatada.split('/');
                    if (partes.length === 3) {
                        dataFormatada = `${partes[2]}-${partes[1]}-${partes[0]}`; 
                    }
                }

                // Monta os objetos JSON exatamente como o banco espera
                const desjejum = {
                    bebida: linha.Desjejum_Bebida || "",
                    acompanhamento: linha.Desjejum_Acompanhamento || "",
                    guarnicao: linha.Desjejum_Guarnicao || ""
                };

                const almoco = {
                    salada: linha.Almoco_Salada || "",
                    proteina_1: linha.Almoco_Proteina_1 || "",
                    proteina_2: linha.Almoco_Proteina_2 || "",
                    vegetariana: linha.Almoco_Vegetariana || "",
                    acompanhamento: linha.Almoco_Acompanhamento || "",
                    guarnicao: linha.Almoco_Guarnicao || "",
                    sobremesa: linha.Almoco_Sobremesa || ""
                };

                const janta = {
                    salada: linha.Janta_Salada || "",
                    proteina_1: linha.Janta_Proteina_1 || "",
                    proteina_2: linha.Janta_Proteina_2 || "",
                    vegetariana: linha.Janta_Vegetariana || "",
                    acompanhamento: linha.Janta_Acompanhamento || "",
                    guarnicao: linha.Janta_Guarnicao || "",
                    sopa: linha.Janta_Sopa || "",
                    sobremesa: linha.Janta_Sobremesa || ""
                };

                // Executa o UPSERT (Insere ou Atualiza se a data já existir)
                await connection.query(
                    `INSERT INTO cardapios (data, desjejum, almoco, janta) 
                     VALUES (?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE 
                     desjejum = VALUES(desjejum), almoco = VALUES(almoco), janta = VALUES(janta)`,
                    [dataFormatada, JSON.stringify(desjejum), JSON.stringify(almoco), JSON.stringify(janta)]
                );

                diasImportados++;
            }

            // Confirma a transação inteira
            await connection.commit();
            res.status(200).json({ message: `Sucesso! ${diasImportados} dias foram importados/atualizados no cardápio.` });

        } catch (dbError) {
            if (connection) await connection.rollback();
            throw dbError; 
        } finally {
            if (connection) connection.release();
        }

    } catch (error) {
        console.error('[ERRO] Falha ao importar planilha:', error);
        res.status(500).json({ message: 'Erro ao processar a planilha. Verifique o formato do arquivo.', error: error.message });
    }
};