
const pool = require('../config/db');

// --- Funções Helper ---
// Formata data para exibição (Ex: 27/10/2025) - Adiciona T00:00:00Z para tratar como UTC
const formatDate = (date) => new Date(date + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' });
// Formata data simples (Ex: 27/10) - Adiciona T00:00:00Z para tratar como UTC
const formatDateSimple = (date) => new Date(date + 'T00:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });

// Obtém data atual no formato YYYY-MM-DD (data local do servidor)
const getDbTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Função Auxiliar para buscar e calcular votos de proteína para um dia específico
async function getProteinVotesForDay(data) {
    console.log(`[LOG][getProteinVotes] Buscando votos de proteína para ${data}...`);
    const [votes] = await pool.query(
        `SELECT meal_type, protein_key, tipo_voto, COUNT(*) as count
         FROM protein_votos
         WHERE data_cardapio = ?
         GROUP BY meal_type, protein_key, tipo_voto`,
        [data]
    );
    console.log(`[LOG][getProteinVotes] Encontrados ${votes.length} registros de votos agregados.`);

    const voteCounts = {
        almoco: {},
        janta: {}
    };
    const proteinKeys = ['proteina_1', 'proteina_2', 'vegetariana'];

    // Inicializa contagens
    proteinKeys.forEach(key => {
        voteCounts.almoco[key] = { likes: 0, dislikes: 0 };
        voteCounts.janta[key] = { likes: 0, dislikes: 0 };
    });

    // Preenche com votos reais
    votes.forEach(vote => {
        if (voteCounts[vote.meal_type] && voteCounts[vote.meal_type][vote.protein_key]) {
            voteCounts[vote.meal_type][vote.protein_key][vote.tipo_voto === 'like' ? 'likes' : 'dislikes'] = vote.count;
        }
    });
     console.log(`[LOG][getProteinVotes] Contagens calculadas para ${data}:`, voteCounts);

    // Calcular Ranking do Dia (proteínas com mais likes)
    let dailyRanking = [];
    let maxLikes = 0; // Começa em 0 para incluir proteínas com 1 like

    ['almoco', 'janta'].forEach(mealType => {
        proteinKeys.forEach(key => {
            const proteinData = voteCounts[mealType][key];
            if (proteinData.likes > 0) {
                 if (proteinData.likes > maxLikes) {
                      maxLikes = proteinData.likes;
                      dailyRanking = [{ meal: mealType, key: key, likes: proteinData.likes }]; // Nova lista de melhores
                 } else if (proteinData.likes === maxLikes) {
                      dailyRanking.push({ meal: mealType, key: key, likes: proteinData.likes }); // Adiciona ao empate
                 }
            }
        });
    });
    console.log(`[LOG][getProteinVotes] Ranking diário calculado para ${data} (maxLikes=${maxLikes}):`, dailyRanking);

    return { voteCounts, dailyRanking };
}


// --- Rotas Exportadas ---

/**
 * Busca os dados dos 5 dias úteis da semana atual, incluindo votos de proteína e ranking diário
 */
exports.getDadosSemana = async (req, res) => {
    console.log('[LOG] Entrando em getDadosSemana...'); // LOG 1
    try {
        const query = `
SELECT *, DATE_FORMAT(data, '%Y-%m-%d') as data FROM cardapios
WHERE YEARWEEK(data, 1) = YEARWEEK(CURDATE(), 1)
AND DAYOFWEEK(data) BETWEEN 2 AND 6
ORDER BY data ASC`;

        console.log('[LOG] Executando query principal para cardapios...'); // LOG 2
        const [cardapios] = await pool.query(query.trim());
        console.log(`[LOG] Query principal retornou ${cardapios.length} cardápios.`); // LOG 3

        const dataFinal = [];
        for (const cardapio of cardapios) {
            console.log(`[LOG] Processando cardápio para data: ${cardapio.data}`); // LOG 4
            try {
                console.log(`[LOG] Buscando comentários para ${cardapio.data}...`); // LOG 5
                const [comentarios] = await pool.query(
                    'SELECT autor, texto FROM comentarios WHERE data_cardapio = ? AND esta_visivel = TRUE',
                    [cardapio.data]
                );
                console.log(`[LOG] Encontrados ${comentarios.length} comentários para ${cardapio.data}.`); // LOG 6

                // Busca votos e ranking diário para ESTE dia
                const { voteCounts, dailyRanking } = await getProteinVotesForDay(cardapio.data);

                let parsedCardapio = {};
                try {
                    console.log(`[LOG] Tentando JSON.parse para cardápio de ${cardapio.data}`); // LOG 7
                    parsedCardapio.desjejum = cardapio.desjejum ? JSON.parse(cardapio.desjejum) : {};
                    parsedCardapio.almoco = cardapio.almoco ? JSON.parse(cardapio.almoco) : {};
                    parsedCardapio.janta = cardapio.janta ? JSON.parse(cardapio.janta) : {};
                    console.log(`[LOG] JSON.parse concluído com sucesso para ${cardapio.data}`); // LOG 8
                } catch (parseError) {
                    console.error(`[ERRO] Falha no JSON.parse para a data ${cardapio.data}:`, parseError);
                    parsedCardapio = { desjejum: {}, almoco: {}, janta: {} }; // Usa objeto vazio como fallback
                }

                 // Adiciona nomes das proteínas ranqueadas (se houver)
                 const rankedProteinsDetails = dailyRanking.map(rank => {
                    const mealData = parsedCardapio[rank.meal];
                    // Busca o nome da proteína dentro do JSON parseado
                    const proteinName = mealData ? (mealData[rank.key] || `(${rank.key})`) : `(${rank.key})`; // Nome ou (chave)
                    return { ...rank, name: proteinName };
                 });
                 console.log(`[LOG] Ranking diário detalhado para ${cardapio.data}:`, rankedProteinsDetails);

                dataFinal.push({
                    data: cardapio.data,
                    data_formatada: formatDate(cardapio.data),
                    data_formatada_simples: formatDateSimple(cardapio.data),
                    cardapio: parsedCardapio,
                    likes: cardapio.likes, // Mantido para Ranking Semanal (mesmo que 0)
                    dislikes: cardapio.dislikes, // Mantido para Ranking Semanal (mesmo que 0)
                    comments: comentarios,
                    proteinVotes: voteCounts, // Adiciona contagens de votos por proteína
                    dailyProteinRanking: rankedProteinsDetails // Adiciona o ranking diário detalhado
                });

            } catch (loopError) {
                 console.error(`[ERRO] Erro dentro do loop de getDadosSemana para a data ${cardapio.data}:`, loopError);
                 continue; // Pula para o próximo dia em caso de erro
            }
        }
        console.log('[LOG] Enviando resposta JSON de getDadosSemana...'); // LOG 9
        res.json(dataFinal);

    } catch (error) {
        console.error('[ERRO] Erro GERAL em getDadosSemana:', error); // LOG de Erro Geral
        res.status(500).json({ message: 'Erro ao buscar dados da semana.', error: error.message });
    }
};

/**
 * Busca dados completos de UM dia, incluindo votos de proteína e ranking diário
 */
exports.getCardapioDoDia = async (req, res) => {
     console.log(`[LOG] Entrando em getCardapioDoDia para data: ${req.params.data}`); // LOG Dia 1
     try {
         const { data } = req.params;
         // Seleciona explicitamente as colunas necessárias
         const [cardapios] = await pool.query('SELECT data, desjejum, almoco, janta, likes, dislikes FROM cardapios WHERE data = ?', [data]);

         if (cardapios.length === 0) {
             console.log(`[LOG] Nenhum cardápio encontrado para ${data}`); // LOG Dia 2
             return res.status(404).json({ message: 'Nenhum cardápio encontrado para este dia.' });
         }

         const cardapio = cardapios[0];
         console.log(`[LOG] Cardápio encontrado para ${data}. Buscando comentários e votos...`); // LOG Dia 3
         const [comentarios] = await pool.query(
             'SELECT autor, texto FROM comentarios WHERE data_cardapio = ? AND esta_visivel = TRUE',
             [data]
         );
         const { voteCounts, dailyRanking } = await getProteinVotesForDay(data); // Busca votos e ranking
         console.log(`[LOG] Encontrados ${comentarios.length} comentários para ${data}.`); // LOG Dia 4

         let parsedCardapio = {};
         try {
              console.log(`[LOG] Tentando JSON.parse para cardápio de ${data}`); // LOG Dia 5
              parsedCardapio = {
                 desjejum: cardapio.desjejum ? JSON.parse(cardapio.desjejum) : {},
                 almoco: cardapio.almoco ? JSON.parse(cardapio.almoco) : {},
                 janta: cardapio.janta ? JSON.parse(cardapio.janta) : {}
              };
              console.log(`[LOG] JSON.parse concluído para ${data}`); // LOG Dia 6
         } catch (parseError) {
              console.error(`[ERRO] Falha no JSON.parse para getCardapioDoDia ${data}:`, parseError); // LOG Erro Parse Dia
              return res.status(500).json({ message: 'Erro ao processar dados do cardápio.', error: parseError.message });
         }

         // Adiciona nomes das proteínas ranqueadas
         const rankedProteinsDetails = dailyRanking.map(rank => {
            const mealData = parsedCardapio[rank.meal];
            const proteinName = mealData ? (mealData[rank.key] || `(${rank.key})`) : `(${rank.key})`;
            return { ...rank, name: proteinName };
         });
          console.log(`[LOG] Ranking diário detalhado para ${data}:`, rankedProteinsDetails);


         console.log(`[LOG] Enviando resposta JSON de getCardapioDoDia para ${data}`); // LOG Dia 7
         res.json({
             data: cardapio.data, // Garante que a data formatada não foi perdida
             cardapio: parsedCardapio,
             likes: cardapio.likes, // Geral
             dislikes: cardapio.dislikes, // Geral
             comments: comentarios,
             proteinVotes: voteCounts, // Votos por proteína
             dailyProteinRanking: rankedProteinsDetails // Ranking diário
         });

     } catch (error) {
         console.error(`[ERRO] Erro GERAL em getCardapioDoDia para ${req.params.data}:`, error); // LOG Erro Geral Dia
         res.status(500).json({ message: 'Erro ao buscar dados do dia.', error: error.message });
     }
};


/**
 * Busca o ranking semanal (Gráfico) - Baseado nos likes GERAIS (podem estar zerados)
 */
/**
 * MODIFICADO: Busca o ranking das 5 PROTEÍNAS mais curtidas da semana atual
 */
exports.getRanking = async (req, res) => {
    console.log('[LOG] Entrando em getRanking (Proteínas da Semana)...');
    try {
        // 1. Busca todos os votos 'like' de proteínas da semana atual
        const proteinVotesQuery = `
            SELECT data_cardapio, meal_type, protein_key
            FROM protein_votos
            WHERE tipo_voto = 'like' AND YEARWEEK(data_cardapio, 1) = YEARWEEK(CURDATE(), 1)
        `;
        console.log('[LOG] Executando query para buscar votos de proteína da semana...');
        const [proteinVotes] = await pool.query(proteinVotesQuery);
        console.log(`[LOG] Encontrados ${proteinVotes.length} votos 'like' de proteínas na semana.`);

        // 2. Busca os dados dos cardápios da semana atual para pegar os nomes
        const cardapiosQuery = `
            SELECT data, almoco, janta FROM cardapios
            WHERE YEARWEEK(data, 1) = YEARWEEK(CURDATE(), 1)
        `;
         console.log('[LOG] Executando query para buscar cardápios da semana...');
        const [cardapiosData] = await pool.query(cardapiosQuery);
        console.log(`[LOG] Encontrados ${cardapiosData.length} cardápios na semana.`);

        // 3. Processa os dados no Node.js para agregar votos por nome de proteína
        const cardapiosMap = new Map(); // Mapa para acesso rápido: 'YYYY-MM-DD' -> { almoco: {...}, janta: {...} }
        cardapiosData.forEach(cd => {
            try {
                cardapiosMap.set(cd.data.toISOString().split('T')[0], { // Usa formato YYYY-MM-DD como chave
                    almoco: cd.almoco ? JSON.parse(cd.almoco) : {},
                    janta: cd.janta ? JSON.parse(cd.janta) : {}
                });
            } catch (e) {
                console.error(`[WARN] Erro ao parsear JSON do cardápio ${cd.data} no getRanking:`, e);
            }
        });

        const proteinLikes = new Map(); // Mapa para agregar: 'Nome da Proteína' -> count

        proteinVotes.forEach(vote => {
            const dateStr = vote.data_cardapio.toISOString().split('T')[0];
            const cardapioDoDia = cardapiosMap.get(dateStr);

            if (cardapioDoDia) {
                const mealData = cardapioDoDia[vote.meal_type];
                if (mealData) {
                    const proteinName = mealData[vote.protein_key];
                    if (proteinName) { // Apenas conta se encontrar o nome da proteína
                        proteinLikes.set(proteinName, (proteinLikes.get(proteinName) || 0) + 1);
                    } else {
                         console.warn(`[WARN] Nome da proteína não encontrado para ${dateStr} - ${vote.meal_type}.${vote.protein_key}`);
                    }
                }
            } else {
                 console.warn(`[WARN] Cardápio não encontrado para a data ${dateStr} de um voto.`);
            }
        });
         console.log('[LOG] Votos agregados por nome de proteína:', proteinLikes);

        // 4. Converte o mapa para array, ordena e pega o top 5
        const rankingArray = Array.from(proteinLikes.entries())
            .map(([name, total_likes]) => ({ name, total_likes }))
            .sort((a, b) => b.total_likes - a.total_likes) // Ordena por mais likes
            .slice(0, 5); // Pega os 5 primeiros

        console.log('[LOG] Enviando resposta JSON do Ranking de Proteínas Semanal:', rankingArray);
        res.json(rankingArray); // Retorna [{ name: "...", total_likes: X }, ...]

    } catch (error) {
        console.error('[ERRO] Erro GERAL em getRanking (Proteínas da Semana):', error);
        res.status(500).json({ message: 'Erro ao buscar ranking de proteínas da semana.', error: error.message });
    }
};

/**
 * Adiciona um novo comentário
 */
exports.postComentario = async (req, res) => {
    console.log(`[LOG] Recebida requisição para postComentario para data: ${req.body.data}`); // Log Comentário 1
    try {
        const { data, autor, texto } = req.body;
        if (!data || !autor || !texto) {
             console.warn('[AVISO] Tentativa de postar comentário com dados incompletos:', req.body); // Log Comentário 2
            return res.status(400).json({ message: 'Dados incompletos.' });
        }

        console.log(`[LOG] Inserindo comentário de ${autor} para ${data}`); // Log Comentário 3
        const [result] = await pool.query(
            'INSERT INTO comentarios (data_cardapio, autor, texto) VALUES (?, ?, ?)',
            [data, autor, texto]
        );

        const newComment = { id: result.insertId, autor, texto };
        console.log('[LOG] Comentário inserido com sucesso:', newComment); // Log Comentário 4
        res.status(201).json(newComment);

    } catch (error) {
        console.error('[ERRO] Erro em postComentario:', error); // Log Comentário 5
        res.status(500).json({ message: 'Erro ao salvar comentário.', error: error.message });
    }
};

/**
 * Registra um voto para uma PROTEÍNA específica (like/dislike)
 */
exports.postVoto = async (req, res) => {
    const { data, meal_type, protein_key, tipo, identificador } = req.body;
    console.log(`[LOG] Voto de proteína: ${tipo} para ${meal_type}.${protein_key} em ${data} por ${identificador}`); // Log Voto 1

    // 1. Validações
    const todayDbDate = getDbTodayDate();
    if (data !== todayDbDate) {
        console.warn(`[AVISO] Tentativa de voto em data inválida (${data}) por ${identificador}. Data atual: ${todayDbDate}`); // Log Voto 2
        return res.status(403).json({ message: 'Só é permitido votar no cardápio do dia atual.' });
    }
    if (!data || !meal_type || !protein_key || !tipo || !identificador ||
        !['almoco', 'janta'].includes(meal_type) ||
        !['proteina_1', 'proteina_2', 'vegetariana'].includes(protein_key) ||
        !['like', 'dislike'].includes(tipo))
    {
         console.warn('[AVISO] Requisição de voto de proteína inválida:', req.body); // Log Voto 3
        return res.status(400).json({ message: 'Requisição de voto de proteína inválida.' });
    }

    const votoNovo = tipo;
    let connection;

    try {
        console.log('[LOG] Iniciando transação de voto de proteína...'); // Log Voto 4
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 2. Verifica voto existente PARA ESTA REFEIÇÃO (meal_type) neste dia
        console.log(`[LOG] Verificando voto existente para ${data}/${meal_type}/${identificador}`); // Log Voto 5
        const [votosAtuais] = await connection.query(
            'SELECT id, tipo_voto, protein_key FROM protein_votos WHERE data_cardapio = ? AND meal_type = ? AND identificador = ? FOR UPDATE',
            [data, meal_type, identificador]
        );

        const votoExistente = votosAtuais.length > 0 ? votosAtuais[0] : null;
        let action = 'none'; // 'insert', 'update', 'delete'
        let finalVoteType = null; // Para retornar o estado final

        if (!votoExistente) {
            console.log('[LOG][Voto Proteina] Caso 1: Novo voto.'); // Log Voto 6a
            await connection.query(
                'INSERT INTO protein_votos (data_cardapio, meal_type, protein_key, identificador, tipo_voto) VALUES (?, ?, ?, ?, ?)',
                [data, meal_type, protein_key, identificador, votoNovo]
            );
            action = 'insert';
            finalVoteType = votoNovo;
        } else if (votoExistente.protein_key === protein_key && votoExistente.tipo_voto === votoNovo) {
            console.log('[LOG][Voto Proteina] Caso 2: Remover voto.'); // Log Voto 6b
            await connection.query('DELETE FROM protein_votos WHERE id = ?', [votoExistente.id]);
            action = 'delete';
            finalVoteType = null; // Voto removido
        } else {
             console.log('[LOG][Voto Proteina] Caso 3: Mudar voto.'); // Log Voto 6c
            await connection.query(
                'UPDATE protein_votos SET tipo_voto = ?, protein_key = ? WHERE id = ?',
                [votoNovo, protein_key, votoExistente.id]
            );
            action = 'update';
            finalVoteType = votoNovo; // O voto agora é o novo tipo/proteína
        }

        await connection.commit();
        console.log('[LOG][Voto Proteina] Transação commitada.'); // Log Voto 9

        // 3. Busca a nova contagem E o novo ranking do dia (AGORA FORA DA TRANSAÇÃO)
        console.log('[LOG] Buscando contagem final e ranking diário PÓS-commit...'); // Log Voto 10
        const { voteCounts, dailyRanking } = await getProteinVotesForDay(data);

        // Adiciona nomes ao ranking diário para enviar de volta
        let rankedProteinsDetails = [];
        try {
             const [cardapioDoDia] = await pool.query('SELECT almoco, janta FROM cardapios WHERE data = ?', [data]);
             if (cardapioDoDia.length > 0) {
                 const almocoData = cardapioDoDia[0].almoco ? JSON.parse(cardapioDoDia[0].almoco) : {};
                 const jantaData = cardapioDoDia[0].janta ? JSON.parse(cardapioDoDia[0].janta) : {};
                 rankedProteinsDetails = dailyRanking.map(rank => {
                     const mealData = rank.meal === 'almoco' ? almocoData : jantaData;
                     const proteinName = mealData[rank.key] || `(${rank.key})`;
                     return { ...rank, name: proteinName };
                 });
             }
         } catch(e){
              console.error("[ERRO] Falha ao buscar nomes para ranking diário pós-voto:", e);
              // Se falhar, envia o ranking só com as chaves
              rankedProteinsDetails = dailyRanking.map(rank => ({ ...rank, name: `(${rank.key})` }));
         }


         const responsePayload = {
             message: `Voto ${action} com sucesso!`,
             newCounts: voteCounts, // Retorna TODAS as contagens do dia
             dailyProteinRanking: rankedProteinsDetails, // Retorna o novo ranking diário detalhado
             // Retorna o estado final do voto para a refeição específica
             votedMeal: meal_type,
             votedProteinKey: action === 'delete' ? null : protein_key, // Qual proteína ficou votada
             votedProteinType: finalVoteType // Qual tipo de voto ficou (like/dislike/null)
         };
        console.log('[LOG] Enviando resposta JSON de postVoto:', responsePayload); // Log Voto 11
        res.status(200).json(responsePayload);

    } catch (error) {
        if (connection) {
             console.log('[LOG] Rollback da transação de voto de proteína devido a erro.'); // Log Voto Erro 1
             await connection.rollback();
        }
        console.error("[ERRO] Erro na transação de voto de proteína:", error); // Log Voto Erro 2
        if (error.code === 'ER_DUP_ENTRY') {
             return res.status(409).json({ message: 'Erro de concorrência ao votar. Tente novamente.' });
        }
        res.status(500).json({ message: 'Erro ao registrar voto de proteína.', error: error.message });
    } finally {
        if (connection) {
             console.log('[LOG] Liberando conexão do pool de voto.'); // Log Voto Finally
             connection.release();
        }
    }
};