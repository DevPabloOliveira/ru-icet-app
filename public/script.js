document.addEventListener('DOMContentLoaded', () => {

    // --- 1. ESTADO GLOBAL ---
    const API_URL = '/api';
    let weeklyData = {}; // Cache para guardar os dados da semana
    let currentDayKey = ''; // Ex: '2025-10-27'

    // --- 2. SELETORES DO DOM ---
    const tabsContainer = document.getElementById('day-tabs');
    const menuContentEl = document.getElementById('menu-content');
    const commentsListEl = document.getElementById('comments-list');
    const commentFormEl = document.getElementById('comment-form');
    // Ranking Semanal (Gráfico)
    const rankingChartContainer = document.getElementById('ranking-chart-container');
    const rankingChartCanvas = document.getElementById('ranking-chart');
    const rankingLoadingText = document.getElementById('ranking-loading');
    // Ranking Diário (Melhor Proteína)
    const dailyRankingContainer = document.getElementById('daily-protein-ranking');
    const dailyRankingList = document.getElementById('daily-protein-ranking-list');
    // Comentários
    const commentMessageEl = document.getElementById('comment-message');

    // --- VARIÁVEL GLOBAL PARA O GRÁFICO ---
    let rankingChartInstance = null;

    // --- CONFIGURAÇÃO GLOBAL CHART.JS ---
    // Tenta definir a fonte padrão para Inter, se disponível
    try {
        if (typeof Chart !== 'undefined') { // Verifica se Chart.js carregou
            Chart.defaults.font.family = "'Inter', sans-serif";
            Chart.defaults.font.size = 12;
            Chart.defaults.color = '#666';
        } else {
             console.warn("Chart.js não está definido. O gráfico de ranking não funcionará.");
        }
    } catch (e) {
        console.error("Erro ao configurar Chart.js:", e);
    }


    // --- FUNÇÕES HELPER ---
    /**
     * Retorna a data de hoje no formato YYYY-MM-DD
     */
    function getTodayDateString() {
        const today = new Date();
        // Considera o fuso horário local para garantir que a data seja a correta
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Gera um ID "único" simples para o usuário anônimo
     */
    function getUserId() {
        let userId = localStorage.getItem('ru_user_id');
        if (!userId) {
            userId = 'anon_' + Date.now().toString(36) + Math.random().toString(36).substring(2); // ID um pouco mais único
            localStorage.setItem('ru_user_id', userId);
        }
        return userId;
    }

    /**
     * Retorna o voto armazenado para uma refeição específica ('almoco' ou 'janta') no dia
     * Retorna { key: 'proteina_1', type: 'like' } ou null
     */
    function getMealVoteStatus(dayKey, mealType) {
        const voteString = localStorage.getItem(`voto_${mealType}_${dayKey}`);
        if (!voteString) return null;
        const parts = voteString.split(':');
        if (parts.length === 2 && parts[0] && ['like', 'dislike'].includes(parts[1])) {
            return { key: parts[0], type: parts[1] };
        }
        localStorage.removeItem(`voto_${mealType}_${dayKey}`); 
        return null;
    }

    /**
     * Armazena o voto para a refeição no localStorage
     */
    function setMealVoteStatus(dayKey, mealType, proteinKey, voteType) {
         const storageKey = `voto_${mealType}_${dayKey}`;
         if (!proteinKey || !voteType) {
              localStorage.removeItem(storageKey);
         } else {
              localStorage.setItem(storageKey, `${proteinKey}:${voteType}`);
         }
    }


    // --- 3. FUNÇÕES DE RENDERIZAÇÃO ---

    /**
     * Cria tabela de cardápio e adiciona botões/contagens para proteínas
     */
    function createMenuTable(mealData, mealType, voteCounts, dayKey) {
        if (!mealData || Object.keys(mealData).length === 0) {
            return '<p class="loading-text">Cardápio não cadastrado.</p>';
        }

        const isToday = dayKey === getTodayDateString();
        const currentVote = isToday ? getMealVoteStatus(dayKey, mealType) : null;

        let rows = '';
        const proteinKeys = ['proteina_1', 'proteina_2', 'vegetariana'];

        for (const [key, value] of Object.entries(mealData)) {
            if (!value) continue; // Pula campos vazios

            let formattedKey = key.replace(/_/g, ' ').replace(/\b(1|2)\b/g, match => ` ${match}`);
            formattedKey = formattedKey.charAt(0).toUpperCase() + formattedKey.slice(1);

            let voteControlsHTML = '';
            if (['almoco', 'janta'].includes(mealType) && proteinKeys.includes(key)) {
                const counts = voteCounts[key] || { likes: 0, dislikes: 0 };
                const isLiked = currentVote?.key === key && currentVote?.type === 'like';
                const isDisliked = currentVote?.key === key && currentVote?.type === 'dislike';
                const isDisabled = !isToday; 

                voteControlsHTML = `
                    <div class="protein-vote-cell">
                        <button
                            class="protein-vote-btn like ${isLiked ? 'voted' : ''}"
                            data-day="${dayKey}" data-meal="${mealType}" data-key="${key}" data-type="like"
                            title="Gostei (${counts.likes})" ${isDisabled ? 'disabled' : ''}
                        >👍</button>
                        <button
                            class="protein-vote-btn dislike ${isDisliked ? 'voted' : ''}"
                            data-day="${dayKey}" data-meal="${mealType}" data-key="${key}" data-type="dislike"
                            title="Não gostei (${counts.dislikes})" ${isDisabled ? 'disabled' : ''}
                        >👎</button>
                        <div class="protein-vote-counts">
                            <span class="likes-count" title="${counts.likes} votos positivos">👍 ${counts.likes}</span>
                            <span class="dislikes-count" title="${counts.dislikes} votos negativos">👎 ${counts.dislikes}</span>
                        </div>
                    </div>`;
            }

            rows += `
                <tr>
                    <th>${formattedKey}</th>
                    <td>${value}${voteControlsHTML}</td>
                </tr>`;
        }
        return `<table class="menu-table">${rows}</table>`;
    }

    /**
     * Renderiza o conteúdo principal (cardápio com votos) e o ranking diário
     */
    function renderDay(dayKey) {
        const data = weeklyData[dayKey];
        currentDayKey = dayKey; 

        // Garante que os elementos existem antes de tentar usá-los
        if (!menuContentEl || !dailyRankingContainer || !commentsListEl || !commentFormEl) {
             console.error("Erro: Elementos essenciais do DOM não encontrados.");
             return;
        }


        if (!data || !data.cardapio) {
            menuContentEl.innerHTML = '<p class="loading-text">Cardápio não cadastrado para este dia.</p>';
            dailyRankingContainer.style.display = 'none';
            commentsListEl.innerHTML = '<p class="subtitle">Sem comentários para este dia.</p>';
            commentFormEl.style.display = 'none';
            return;
        }

        const { cardapio, comments, proteinVotes, dailyProteinRanking } = data;

        // Gera HTML das tabelas
        const desjejumHTML = `<div class="menu-section"><h4>☕ Desjejum</h4>${createMenuTable(cardapio.desjejum || {}, 'desjejum', {}, dayKey)}</div>`;
        const almocoHTML = `<div class="menu-section"><h4>🍛 Almoço</h4>${createMenuTable(cardapio.almoco || {}, 'almoco', proteinVotes?.almoco || {}, dayKey)}</div>`;
        const jantaHTML = `<div class="menu-section"><h4>🌙 Janta</h4>${createMenuTable(cardapio.janta || {}, 'janta', proteinVotes?.janta || {}, dayKey)}</div>`; 
        menuContentEl.innerHTML = desjejumHTML + almocoHTML + jantaHTML;

        // Renderiza comentários e mostra formulário
        renderComments(comments);
        commentFormEl.style.display = 'flex';

        // Renderiza o Ranking Diário de Proteínas
        renderDailyProteinRanking(dailyProteinRanking);
    }

    /**
      * Renderiza o ranking da(s) melhor(es) proteína(s) do dia na lista
      */
     function renderDailyProteinRanking(rankingData) {
         // Garante que os elementos existem
         if (!dailyRankingList || !dailyRankingContainer) return;

         dailyRankingList.innerHTML = ''; 

         if (!rankingData || rankingData.length === 0) {
             dailyRankingList.innerHTML = '<p class="loading-text" style="font-size: 0.85rem;">Ainda sem votos suficientes.</p>';
             dailyRankingContainer.style.display = 'block';
             return;
         }

         rankingData.forEach(rank => {
             const listItem = document.createElement('li');
             const proteinName = rank.name || `(${rank.key})`;
             const mealName = rank.meal === 'almoco' ? 'Almoço' : 'Janta';
             listItem.innerHTML = `
                 <div class="ranking-item-info">
                     <span class="ranking-item-name">${proteinName} <span class="meal-indicator">(${mealName})</span></span>
                     <span class="rank-votes">${rank.likes} ${rank.likes === 1 ? 'voto' : 'votos'}</span>
                 </div>
             `;
             dailyRankingList.appendChild(listItem);
         });

         dailyRankingContainer.style.display = 'block';
     }


    /**
     * Renderiza a lista de comentários
     */
    function renderComments(comments) {
        if (!commentsListEl) return; 

        commentsListEl.innerHTML = '';
        if (!comments || comments.length === 0) {
            commentsListEl.innerHTML = '<p class="subtitle">Seja o primeiro a comentar!</p>';
            return;
        }
        comments.forEach(comment => {
            const commentEl = document.createElement('div');
            commentEl.className = 'comment-item';
            // Sanitiza minimamente para evitar XSS simples (idealmente usar biblioteca)
            const safeAutor = comment.autor ? comment.autor.replace(/</g, "&lt;").replace(/>/g, "&gt;") : 'Anônimo';
            const safeTexto = comment.texto ? comment.texto.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
            commentEl.innerHTML = `<strong>${safeAutor}</strong><p>${safeTexto}</p>`;
            commentsListEl.appendChild(commentEl);
        });
    }

 /**
     * MODIFICADO: Renderiza o Ranking Semanal de PROTEÍNAS como gráfico de barras
     */
    function renderRanking(rankingProteinData) { 
        // Seletores
        const chartContainer = rankingChartContainer;
        const chartCanvas = rankingChartCanvas;
        const loadingText = rankingLoadingText;

        // Garante que elementos existem
        if (!chartContainer || !chartCanvas || !loadingText) {
             console.error("Elementos do gráfico de ranking semanal não encontrados.");
             return;
        }


        if (rankingChartInstance) {
            rankingChartInstance.destroy();
            rankingChartInstance = null;
        }

        // Verifica se rankingProteinData existe e tem itens
        if (!rankingProteinData || rankingProteinData.length === 0) {
            console.log('[LOG] Nenhum dado para o ranking semanal de proteínas (gráfico).');
            loadingText.textContent = 'Nenhuma proteína votada nesta semana ainda.'; 
            loadingText.style.display = 'block';
            chartCanvas.style.display = 'none';
            return;
        }

        // Os dados já vêm ordenados da API, mas podemos garantir
        rankingProteinData.sort((a, b) => b.total_likes - a.total_likes);

        // Prepara dados para o Chart.js
        const labels = rankingProteinData.map(item =>
            // Encurta nomes longos
            item.name.substring(0, 25) + (item.name.length > 25 ? '...' : '')
        );
        const dataValues = rankingProteinData.map(item => item.total_likes);

        console.log('[LOG] Dados para o gráfico de ranking semanal de PROTEÍNAS:', { labels, dataValues });

        loadingText.style.display = 'none';
        chartCanvas.style.display = 'block';

        const ctx = chartCanvas.getContext('2d');
        try {
            if (typeof Chart === 'undefined') throw new Error("Chart.js não carregado.");

            rankingChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Total de Votos 👍 na Semana', 
                        data: dataValues,
                        // Reutiliza cores (pode precisar de mais se o ranking for > 5)
                        backgroundColor: [
                             'rgba(212, 175, 55, 0.7)', 'rgba(192, 192, 192, 0.7)', 'rgba(205, 127, 50, 0.7)',
                             'rgba(0, 107, 61, 0.7)', 'rgba(0, 77, 43, 0.7)'
                        ].slice(0, dataValues.length), 
                        borderColor: [
                             'rgba(212, 175, 55, 1)', 'rgba(192, 192, 192, 1)', 'rgba(205, 127, 50, 1)',
                             'rgba(0, 107, 61, 1)', 'rgba(0, 77, 43, 1)'
                        ].slice(0, dataValues.length),
                        borderWidth: 0,
                        barThickness: 'flex', maxBarThickness: 15, borderRadius: 3,
                    }]
                },
                options: { // Mesmas opções de estilo de antes
                    responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                    scales: {
                        x: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 } }, grid: { display: false } },
                        y: { ticks: { font: { size: 11 }, color: '#333' }, grid: { display: false } }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                             backgroundColor: 'rgba(0, 0, 0, 0.7)', titleFont: { weight: 'bold' }, bodyFont: {},
                             padding: 10, cornerRadius: 4,
                             callbacks: {
                                  // Tooltip mostra o nome completo (não encurtado) e os votos totais
                                  title: function(tooltipItems) {
                                       const index = tooltipItems[0].dataIndex;
                                       return rankingProteinData[index].name; 
                                  },
                                  label: function(context) {
                                       let label = context.dataset.label || '';
                                       if (label) { label += ': '; }
                                       // Usa context.parsed.x que é o valor numérico da barra horizontal
                                       label += `${context.parsed.x} ${context.parsed.x === 1 ? 'voto' : 'votos'}`;
                                       return label;
                                  }
                             }
                        }
                    }
                }
            });
            console.log('[LOG] Gráfico de ranking semanal de PROTEÍNAS criado/atualizado.');
        } catch (e) {
             console.error("[ERRO] Falha ao criar Chart.js para ranking semanal:", e);
             loadingText.textContent = 'Erro ao renderizar gráfico semanal.';
             loadingText.style.display = 'block';
             chartCanvas.style.display = 'none';
        }
    }

    /**
     * Cria as abas dos dias da semana e ordena visualmente
     */
    function createTabs() {
        if (!tabsContainer) return; 
        tabsContainer.innerHTML = '';
        const dayNames = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
        const dayKeys = Object.keys(weeklyData);

        const daysWithIndex = dayKeys.map(key => {
            const dateObj = new Date(key + 'T00:00:00'); 
            const dayOfWeekIndex = (dateObj.getDay() + 6) % 7; 
            return { key, index: dayOfWeekIndex };
        })
        .filter(day => day.index >= 0 && day.index < dayNames.length && weeklyData[day.key]) // Garante que o dado existe
        .sort((a, b) => a.index - b.index);

        daysWithIndex.forEach(dayInfo => {
            const dayName = dayNames[dayInfo.index];
            const button = document.createElement('button');
            button.className = 'tab-button';
            button.dataset.day = dayInfo.key;
            // Acessa weeklyData[dayInfo.key] com segurança
            button.textContent = `${dayName} (${weeklyData[dayInfo.key]?.data_formatada_simples || '??/??'})`;
            tabsContainer.appendChild(button);
        });
    }

    // --- 5. FUNÇÕES DE API (FETCH) ---

    /**
     * Busca os dados da semana inteira e o ranking semanal
     */
    async function fetchWeeklyData() {
         try {
             console.log('[LOG] Buscando dados semanais e ranking...');
             const [menuResponse, rankingResponse] = await Promise.all([
                 fetch(`${API_URL}/cardapio/semana`),
                 fetch(`${API_URL}/ranking`)
             ]);

             // Tratamento de erro robusto
             if (!menuResponse.ok) {
                 let errorMsg = `Falha ao carregar cardápios: ${menuResponse.status}`;
                 try { const errorData = await menuResponse.json(); errorMsg += ` - ${errorData.message || 'Erro desconhecido'}`; } catch (e) { errorMsg += ` ${menuResponse.statusText}`; }
                 throw new Error(errorMsg);
             }
             if (!rankingResponse.ok) {
                  let errorMsg = `Falha ao carregar ranking semanal: ${rankingResponse.status}`;
                  try { const errorData = await rankingResponse.json(); errorMsg += ` - ${errorData.message || 'Erro desconhecido'}`; } catch (e) { errorMsg += ` ${rankingResponse.statusText}`; }
                  throw new Error(errorMsg);
             }

             const menuData = await menuResponse.json();
             const rankingSemanalData = await rankingResponse.json();
             console.log('[LOG] Dados recebidos:', { menuData, rankingSemanalData });

             weeklyData = {};
             // Valida se menuData é um array antes de iterar
             if (Array.isArray(menuData)) {
                  menuData.forEach(day => {
                      if (day && day.data) { 
                           weeklyData[day.data] = day;
                      } else {
                           console.warn("[WARN] Item inválido recebido em menuData:", day);
                      }
                  });
             } else {
                  console.warn("[WARN] menuData recebido da API não é um array:", menuData);
             }


             if (Object.keys(weeklyData).length > 0) {
                 createTabs(); // Cria abas ordenadas
                 const todayString = getTodayDateString();
                 // Pega a primeira chave ordenada como padrão
                 let activeDayKey = Object.keys(weeklyData).sort()[0];
                 if (weeklyData[todayString]) {
                     activeDayKey = todayString;
                 }
                 console.log(`[LOG] Definindo aba ativa para: ${activeDayKey}`);

                 const activeTabButton = tabsContainer ? tabsContainer.querySelector(`.tab-button[data-day="${activeDayKey}"]`) : null;
                 if (activeTabButton) {
                    activeTabButton.classList.add('active');
                 } else if (tabsContainer && tabsContainer.firstChild) { 
                     tabsContainer.firstChild.classList.add('active');
                     activeDayKey = tabsContainer.firstChild.dataset.day; 
                 } else {
                      console.warn("[WARN] Não foi possível definir a aba ativa.");
                      // Se não há abas, não tenta renderizar o dia
                      if(menuContentEl) menuContentEl.innerHTML = '<p class="loading-text">Nenhum dia disponível.</p>';
                      return; 
                 }

                 renderDay(activeDayKey); 
             } else {
                 console.log('[LOG] Nenhum cardápio retornado ou processado da API para a semana.');
                 if(menuContentEl) menuContentEl.innerHTML = '<p class="loading-text">Nenhum cardápio cadastrado para esta semana.</p>';
                 if(dailyRankingContainer) dailyRankingContainer.style.display = 'none';
                 if(commentsListEl) commentsListEl.innerHTML = '';
                 if(commentFormEl) commentFormEl.style.display = 'none';
                 // Limpa também as abas se não houver dados
                 if(tabsContainer) tabsContainer.innerHTML = '';
             }

             renderRanking(rankingSemanalData); 

         } catch (error) {
             console.error('[ERRO] Erro GERAL ao buscar dados iniciais:', error);
             // Mostra erro no local do cardápio
             if(menuContentEl) menuContentEl.innerHTML = `<p class="loading-text" style="color: red;">${error.message || 'Erro ao carregar o sistema. Tente novamente mais tarde.'}</p>`;
             // Mostra erro no ranking semanal
             if(rankingLoadingText) { rankingLoadingText.textContent = 'Erro ao carregar.'; rankingLoadingText.style.display = 'block'; }
             if(rankingChartCanvas) rankingChartCanvas.style.display = 'none';
             // Esconde outras seções
             if(dailyRankingContainer) dailyRankingContainer.style.display = 'none';
             if(commentsListEl) commentsListEl.innerHTML = '';
             if(commentFormEl) commentFormEl.style.display = 'none';
             if(tabsContainer) tabsContainer.innerHTML = ''; 
         }
    }

    /**
     * Envia um voto de PROTEÍNA para a API
     */
    async function handleProteinVote(day, meal, key, type) {
        const userId = getUserId();
        const buttonSelector = `.protein-vote-btn[data-day="${day}"][data-meal="${meal}"][data-key="${key}"][data-type="${type}"]`;
        const targetButton = menuContentEl ? menuContentEl.querySelector(buttonSelector) : null;

        // Desabilita botões da refeição
        if (menuContentEl) {
             menuContentEl.querySelectorAll(`.protein-vote-btn[data-day="${day}"][data-meal="${meal}"]`)
                 .forEach(btn => btn.disabled = true);
        }
        if(targetButton) targetButton.style.opacity = '0.5';

        try {
            const response = await fetch(`${API_URL}/votar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: day, meal_type: meal, protein_key: key, tipo: type, identificador: userId })
            });
            const result = await response.json();

            if (response.ok) {
                console.log('[LOG] Voto de proteína registrado:', result);
                if(weeklyData[day]) {
                    weeklyData[day].proteinVotes = result.newCounts; 
                    weeklyData[day].dailyProteinRanking = result.dailyProteinRanking; 
                    setMealVoteStatus(day, meal, result.votedProteinKey, result.votedProteinType); 
                    if (day === currentDayKey) { 
                        renderDay(day);
                    } else { console.log("Voto registrado para dia não visível."); }
                } else { console.warn("Dados locais não encontrados para atualizar após voto."); }
            } else {
                console.error('[ERRO] API de voto de proteína retornou erro:', result);
                alert(`Erro ao votar: ${result.message}`);
                // Reabilita se for hoje em caso de erro API
                 if(menuContentEl) menuContentEl.querySelectorAll(`.protein-vote-btn[data-day="${day}"][data-meal="${meal}"]`)
                    .forEach(btn => btn.disabled = (day !== getTodayDateString()) );
            }
        } catch (error) {
            console.error('[ERRO] Falha ao enviar voto de proteína:', error);
            alert(`Erro de rede ao votar: ${error.message}`);
            // Reabilita se for hoje em caso de erro de rede
             if(menuContentEl) menuContentEl.querySelectorAll(`.protein-vote-btn[data-day="${day}"][data-meal="${meal}"]`)
                    .forEach(btn => btn.disabled = (day !== getTodayDateString()) );
        } finally {
             if(targetButton) targetButton.style.opacity = '1';
        }
    }

    /**
     * Envia um novo comentário para a API
     */
    async function handleCommentSubmit(e) {
       e.preventDefault();
       const authorInput = document.getElementById('comment-author');
       const textInput = document.getElementById('comment-text');
       if (!authorInput || !textInput || !commentFormEl || !commentMessageEl) return; 

       const autor = authorInput.value.trim();
       const texto = textInput.value.trim();

       if (!autor || !texto || !currentDayKey) return;

       const submitButton = commentFormEl.querySelector('button[type="submit"]');
       if(submitButton) submitButton.disabled = true;
       commentMessageEl.textContent = 'Enviando...';
       commentMessageEl.style.color = 'var(--ufam-text)';

       try {
           const response = await fetch(`${API_URL}/comentarios`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ data: currentDayKey, autor: autor, texto: texto })
           });
           const newCommentResult = await response.json();

           if (response.ok || response.status === 201) {
               console.log('[LOG] Comentário enviado com sucesso:', newCommentResult);
               const commentToAdd = { autor: autor, texto: texto, id: newCommentResult.id };
               if(weeklyData[currentDayKey] && !weeklyData[currentDayKey].comments) weeklyData[currentDayKey].comments = [];
               if(weeklyData[currentDayKey]) { 
                   weeklyData[currentDayKey].comments.push(commentToAdd);
                   renderComments(weeklyData[currentDayKey].comments); 
               }
               authorInput.value = ''; textInput.value = '';
               commentMessageEl.textContent = "Comentário enviado!"; commentMessageEl.style.color = "green";
               setTimeout(() => { if(commentMessageEl) commentMessageEl.textContent = ""; }, 3000);
           } else {
               console.error('[ERRO] API de comentário retornou erro:', newCommentResult);
               throw new Error(newCommentResult.message || `Erro ${response.status}`);
           }
       } catch (error) {
           console.error('[ERRO] Falha ao enviar comentário:', error);
           commentMessageEl.textContent = error.message; commentMessageEl.style.color = "red";
       } finally {
           if(submitButton) submitButton.disabled = false;
       }
    }

    // --- 6. EVENT LISTENERS ---

    // Troca de abas (com verificação de existência do container)
    if (tabsContainer) {
        tabsContainer.addEventListener('click', (e) => {
            if (e.target.matches('.tab-button') && !e.target.classList.contains('active')) {
                const dayKey = e.target.dataset.day;
                tabsContainer.querySelectorAll('.tab-button').forEach(tab => tab.classList.remove('active'));
                e.target.classList.add('active');
                renderDay(dayKey);
            }
        });
    } else {
         console.error("Elemento #day-tabs não encontrado.");
    }


    // Votos de proteína (delegação de evento, com verificação)
    if (menuContentEl) {
        menuContentEl.addEventListener('click', (e) => {
            if (e.target.matches('.protein-vote-btn') && !e.target.disabled) {
                const button = e.target;
                handleProteinVote(
                    button.dataset.day, button.dataset.meal, button.dataset.key, button.dataset.type
                );
            }
        });
    } else {
         console.error("Elemento #menu-content não encontrado.");
    }


    // Formulário de Comentário
    if(commentFormEl) {
       commentFormEl.addEventListener('submit', handleCommentSubmit);
    } else {
         console.error("Elemento #comment-form não encontrado.");
    }

    // --- 7. INICIALIZAÇÃO ---
    function init() {
        console.log('[LOG] Inicializando aplicação...');
        fetchWeeklyData(); 
    }

    init(); 
});