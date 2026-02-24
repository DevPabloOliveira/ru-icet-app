const pool = require('../config/db');

// --- Funções Helper ---

/**
 * Formata data para exibição (Ex: 27/10/2025)
 */
const formatDate = (date) => new Date(date + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' });

/**
 * Formata data simples (Ex: 27/10)
 */
const formatDateSimple = (date) => new Date(date + 'T00:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });

/**
 * AUD-04: Obtém data atual no fuso horário de Manaus/Itacoatiara (UTC-4)
 * Garante que o sistema não "pule de dia" prematuramente em servidores UTC.
 */
const getDbTodayDate = () => {
    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Manaus" }));
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Função Auxiliar para buscar e calcular votos de proteína para um dia específico
 */
async function getProteinVotesForDay(data) {
    const [votes] = await pool.query(
        `SELECT meal_type, protein_key, tipo_voto, COUNT(*) as count
         FROM protein_votos
         WHERE data_cardapio = ?
         GROUP BY meal_type, protein_key, tipo_voto`,
        [data]
    );

    const voteCounts = { almoco: {}, janta: {} };
    const proteinKeys = ['proteina_1', 'proteina_2', 'vegetariana'];

    proteinKeys.forEach(key => {
        voteCounts.almoco[key] = { likes: 0, dislikes: 0 };
        voteCounts.janta[key] = { likes: 0, dislikes: 0 };
    });

    votes.forEach(vote => {
        if (voteCounts[vote.meal_type] && voteCounts[vote.meal_type][vote.protein_key]) {
            voteCounts[vote.meal_type][vote.protein_key][vote.tipo_voto === 'like' ? 'likes' : 'dislikes'] = vote.count;
        }
    });

    let dailyRanking = [];
    let maxLikes = 0;

    ['almoco', 'janta'].forEach(mealType => {
        proteinKeys.forEach(key => {
            const proteinData = voteCounts[mealType][key];
            if (proteinData.likes > 0) {
                 if (proteinData.likes > maxLikes) {
                      maxLikes = proteinData.likes;
                      dailyRanking = [{ meal: mealType, key: key, likes: proteinData.likes }];
                 } else if (proteinData.likes === maxLikes) {
                      dailyRanking.push({ meal: mealType, key: key, likes: proteinData.likes });
                 }
            }
        });
    });

    return { voteCounts, dailyRanking };
}

// --- Rotas Exportadas ---

/**
 * AUD-05: Busca dados da semana de forma OTIMIZADA (Bulk Fetch)
 * Resolve o problema de performance onde eram feitas múltiplas queries dentro de um loop.
 */
exports.getDadosSemana = async (req, res) => {
    try {
        await pool.query("SET time_zone = '-04:00'");

        // 1. Busca os cardápios da semana
        const [cardapios] = await pool.query(`
            SELECT *, DATE_FORMAT(data, '%Y-%m-%d') as data_iso 
            FROM cardapios
            WHERE YEARWEEK(data, 1) = YEARWEEK(CURDATE(), 1)
            AND DAYOFWEEK(data) BETWEEN 2 AND 6
            ORDER BY data ASC
        `);

        if (cardapios.length === 0) return res.json([]);

        const datas = cardapios.map(c => c.data_iso);

        // 2. Busca TODOS os comentários da semana em uma única query (Bulk)
        const [allComments] = await pool.query(
            'SELECT data_cardapio, autor, texto FROM comentarios WHERE data_cardapio IN (?) AND esta_visivel = TRUE',
            [datas]
        );

        // 3. Busca TODOS os votos de proteína da semana em uma única query (Bulk)
        const [allVotes] = await pool.query(
            `SELECT data_cardapio, meal_type, protein_key, tipo_voto, COUNT(*) as count
             FROM protein_votos
             WHERE data_cardapio IN (?)
             GROUP BY data_cardapio, meal_type, protein_key, tipo_voto`,
            [datas]
        );

        // 4. Agrupa os resultados em memória para montar o JSON final
        const dataFinal = cardapios.map(cardapio => {
            const dataIso = cardapio.data_iso;

            // Filtra comentários e votos para este dia específico do loop
            const dayComments = allComments
                .filter(c => new Date(c.data_cardapio).toISOString().split('T')[0] === dataIso)
                .map(c => ({ autor: c.autor, texto: c.texto }));

            // Processa votos do dia
            const voteCounts = { almoco: {}, janta: {} };
            const proteinKeys = ['proteina_1', 'proteina_2', 'vegetariana'];
            proteinKeys.forEach(key => {
                voteCounts.almoco[key] = { likes: 0, dislikes: 0 };
                voteCounts.janta[key] = { likes: 0, dislikes: 0 };
            });

            allVotes.filter(v => new Date(v.data_cardapio).toISOString().split('T')[0] === dataIso)
                .forEach(v => {
                    if (voteCounts[v.meal_type] && voteCounts[v.meal_type][v.protein_key]) {
                        voteCounts[v.meal_type][v.protein_key][v.tipo_voto === 'like' ? 'likes' : 'dislikes'] = v.count;
                    }
                });

            // Parse dos objetos JSON do cardápio
            let parsed = {
                desjejum: cardapio.desjejum ? JSON.parse(cardapio.desjejum) : {},
                almoco: cardapio.almoco ? JSON.parse(cardapio.almoco) : {},
                janta: cardapio.janta ? JSON.parse(cardapio.janta) : {}
            };

            return {
                data: dataIso,
                data_formatada: formatDate(dataIso),
                data_formatada_simples: formatDateSimple(dataIso),
                cardapio: parsed,
                likes: cardapio.likes,
                dislikes: cardapio.dislikes,
                comments: dayComments,
                proteinVotes: voteCounts
            };
        });

        res.json(dataFinal);
    } catch (error) {
        console.error('[ERRO] getDadosSemana:', error);
        res.status(500).json({ message: 'Erro ao buscar dados da semana.', error: error.message });
    }
};

/**
 * Busca dados completos de UM dia
 */
exports.getCardapioDoDia = async (req, res) => {
     try {
         await pool.query("SET time_zone = '-04:00'");
         const { data } = req.params;
         const [cardapios] = await pool.query('SELECT data, desjejum, almoco, janta, likes, dislikes FROM cardapios WHERE data = ?', [data]);

         if (cardapios.length === 0) {
             return res.status(404).json({ message: 'Nenhum cardápio encontrado.' });
         }

         const cardapio = cardapios[0];
         const [comentarios] = await pool.query(
             'SELECT autor, texto FROM comentarios WHERE data_cardapio = ? AND esta_visivel = TRUE',
             [data]
         );
         
         const { voteCounts, dailyRanking } = await getProteinVotesForDay(data);

         let parsedCardapio = {
            desjejum: cardapio.desjejum ? JSON.parse(cardapio.desjejum) : {},
            almoco: cardapio.almoco ? JSON.parse(cardapio.almoco) : {},
            janta: cardapio.janta ? JSON.parse(cardapio.janta) : {}
         };

         const rankedProteinsDetails = dailyRanking.map(rank => {
            const mealData = parsedCardapio[rank.meal];
            return { ...rank, name: mealData ? (mealData[rank.key] || `(${rank.key})`) : `(${rank.key})` };
         });

         res.json({
             data: cardapio.data,
             cardapio: parsedCardapio,
             likes: cardapio.likes,
             dislikes: cardapio.dislikes,
             comments: comentarios,
             proteinVotes: voteCounts,
             dailyProteinRanking: rankedProteinsDetails
         });
     } catch (error) {
         res.status(500).json({ message: 'Erro ao buscar dados do dia.', error: error.message });
     }
};

/**
 * Busca o ranking das 5 PROTEÍNAS mais curtidas da semana atual
 */
exports.getRanking = async (req, res) => {
    try {
        await pool.query("SET time_zone = '-04:00'");
        const [proteinVotes] = await pool.query(`
            SELECT data_cardapio, meal_type, protein_key
            FROM protein_votos
            WHERE tipo_voto = 'like' AND YEARWEEK(data_cardapio, 1) = YEARWEEK(CURDATE(), 1)
        `);

        const [cardapiosData] = await pool.query(`
            SELECT data, almoco, janta FROM cardapios
            WHERE YEARWEEK(data, 1) = YEARWEEK(CURDATE(), 1)
        `);

        const cardapiosMap = new Map();
        cardapiosData.forEach(cd => {
            try {
                const dateKey = cd.data instanceof Date ? cd.data.toISOString().split('T')[0] : cd.data;
                cardapiosMap.set(dateKey, {
                    almoco: cd.almoco ? JSON.parse(cd.almoco) : {},
                    janta: cd.janta ? JSON.parse(cd.janta) : {}
                });
            } catch (e) { console.error(e); }
        });

        const proteinLikes = new Map();
        proteinVotes.forEach(vote => {
            const dateStr = new Date(vote.data_cardapio).toISOString().split('T')[0];
            const cardapioDoDia = cardapiosMap.get(dateStr);

            if (cardapioDoDia) {
                const proteinName = cardapioDoDia[vote.meal_type][vote.protein_key];
                if (proteinName) {
                    proteinLikes.set(proteinName, (proteinLikes.get(proteinName) || 0) + 1);
                }
            }
        });

        const rankingArray = Array.from(proteinLikes.entries())
            .map(([name, total_likes]) => ({ name, total_likes }))
            .sort((a, b) => b.total_likes - a.total_likes)
            .slice(0, 5);

        res.json(rankingArray);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar ranking.', error: error.message });
    }
};

/**
 * Adiciona um novo comentário
 */
exports.postComentario = async (req, res) => {
    try {
        const { data, autor, texto } = req.body;
        if (!data || !autor || !texto) return res.status(400).json({ message: 'Dados incompletos.' });

        const [result] = await pool.query(
            'INSERT INTO comentarios (data_cardapio, autor, texto) VALUES (?, ?, ?)',
            [data, autor, texto]
        );

        res.status(201).json({ id: result.insertId, autor, texto });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao salvar comentário.', error: error.message });
    }
};

/**
 * Registra um voto para uma PROTEÍNA específica com controle de transação
 */
exports.postVoto = async (req, res) => {
    const { data, meal_type, protein_key, tipo, identificador } = req.body;

    const todayDbDate = getDbTodayDate();
    if (data !== todayDbDate) {
        return res.status(403).json({ message: 'Só é permitido votar no cardápio do dia atual.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.query("SET time_zone = '-04:00'");
        await connection.beginTransaction();

        const [votosAtuais] = await connection.query(
            'SELECT id, tipo_voto, protein_key FROM protein_votos WHERE data_cardapio = ? AND meal_type = ? AND identificador = ? FOR UPDATE',
            [data, meal_type, identificador]
        );

        const votoExistente = votosAtuais.length > 0 ? votosAtuais[0] : null;
        let action = 'none';

        if (!votoExistente) {
            await connection.query(
                'INSERT INTO protein_votos (data_cardapio, meal_type, protein_key, identificador, tipo_voto) VALUES (?, ?, ?, ?, ?)',
                [data, meal_type, protein_key, identificador, tipo]
            );
            action = 'insert';
        } else if (votoExistente.protein_key === protein_key && votoExistente.tipo_voto === tipo) {
            await connection.query('DELETE FROM protein_votos WHERE id = ?', [votoExistente.id]);
            action = 'delete';
        } else {
            await connection.query(
                'UPDATE protein_votos SET tipo_voto = ?, protein_key = ? WHERE id = ?',
                [tipo, protein_key, votoExistente.id]
            );
            action = 'update';
        }

        // AUD-06: O Commit deve ser feito antes de buscar os novos totais para garantir consistência
        await connection.commit();

        const { voteCounts, dailyRanking } = await getProteinVotesForDay(data);
        res.status(200).json({
            message: `Voto ${action} com sucesso!`,
            newCounts: voteCounts,
            dailyProteinRanking: dailyRanking,
            votedMeal: meal_type,
            votedProteinKey: action === 'delete' ? null : protein_key,
            votedProteinType: action === 'delete' ? null : tipo
        });

    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ message: 'Erro ao registrar voto.', error: error.message });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    ...exports,
    getDbTodayDate,
    formatDate,
    formatDateSimple
};