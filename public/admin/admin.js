document.addEventListener('DOMContentLoaded', () => {
    // URL da API
    const API_URL = '/api/admin';
    let authToken = localStorage.getItem('ru_admin_token');

    // --- SELETORES DO DOM ---
    const loginContainer = document.getElementById('login-container');
    const dashboardContainer = document.getElementById('dashboard-container');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('logout-btn');

    // Abas
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanels = document.querySelectorAll('.tab-panel');

    // Gerenciador de Cardápio
    const menuForm = document.getElementById('menu-form');
    const menuDateInput = document.getElementById('menu-date');
    const loadMenuBtn = document.getElementById('load-menu-btn');
    const menuFormMessage = document.getElementById('menu-form-message');
    const formTextareas = menuForm.querySelectorAll('textarea');

    // Moderador de Comentários
    const commentDateInput = document.getElementById('comment-date');
    const loadCommentsBtn = document.getElementById('load-comments-btn');
    const commentsListAdmin = document.getElementById('comments-list-admin');

    // --- FUNÇÕES DE API ---

    /**
     * Função genérica para fetch com autenticação
     */
    async function fetchAdminAPI(endpoint, method = 'GET', body = null) {
        const headers = {
            'Authorization': `Bearer ${authToken}`
        };
        if (body) {
            headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(`${API_URL}${endpoint}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : null
        });

        if (response.status === 401) {
            // Token inválido ou expirado
            handleLogout();
            throw new Error('Sessão expirada. Faça login novamente.');
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Erro na requisição');
        }

        return data;
    }

    // --- 1. LÓGICA DE AUTENTICAÇÃO ---

    function checkLoginStatus() {
        if (authToken) {
            loginContainer.style.display = 'none';
            dashboardContainer.style.display = 'block';
            const today = new Date().toISOString().split('T')[0];
            menuDateInput.value = today;
            commentDateInput.value = today;
        } else {
            loginContainer.style.display = 'block';
            dashboardContainer.style.display = 'none';
        }
    }

    async function handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        loginError.textContent = 'Autenticando...';
        loginError.style.color = 'var(--info-blue)';
        
        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usuario: username, senha: password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message);
            }

            authToken = data.token;
            localStorage.setItem('ru_admin_token', authToken);
            checkLoginStatus();

        } catch (error) {
            loginError.textContent = error.message || 'Usuário ou senha inválidos.';
            loginError.style.color = 'var(--error-red)';
        }
    }

    function handleLogout() {
        authToken = null;
        localStorage.removeItem('ru_admin_token');
        checkLoginStatus();
    }

    // --- 2. LÓGICA DO PAINEL ---

    // Navegação por Abas
    function handleTabClick(e) {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabPanels.forEach(panel => panel.classList.remove('active'));

        const tabId = e.target.dataset.tab;
        e.target.classList.add('active');
        document.getElementById(tabId).classList.add('active');
    }

    // --- 3. LÓGICA DO GERENCIADOR DE CARDÁPIO ---

    function showFormMessage(message, type = 'success') {
        menuFormMessage.textContent = message;
        menuFormMessage.className = `form-message ${type}`;
        setTimeout(() => menuFormMessage.textContent = '', 4000);
    }

    function clearMenuForm() {
        formTextareas.forEach(textarea => textarea.value = '');
    }

    async function loadMenuData() {
        const date = menuDateInput.value;
        if (!date) return;

        clearMenuForm();
        showFormMessage('Carregando dados...', 'loading');

        try {
            const response = await fetch(`/api/cardapio/${date}`);
            const data = await response.json();
            
            if (!response.ok || !data.cardapio) {
                throw new Error(data.message || 'Nenhum cardápio encontrado para este dia. Pronto para criar um novo.');
            }

            const { cardapio } = data;
            for (const meal of ['desjejum', 'almoco', 'janta']) {
                if (cardapio[meal]) {
                    for (const [field, value] of Object.entries(cardapio[meal])) {
                        const textarea = document.getElementById(`${meal}-${field}`);
                        if (textarea) {
                            textarea.value = value || '';
                        }
                    }
                }
            }
            showFormMessage('Dados carregados. Você pode editar e salvar.', 'success');

        } catch (error) {
            showFormMessage(error.message, 'error');
        }
    }

    async function handleMenuFormSubmit(e) {
        e.preventDefault();
        const data = menuDateInput.value;
        if (!data) {
            showFormMessage('Por favor, selecione uma data.', 'error');
            return;
        }

        showFormMessage('Salvando...', 'loading');

        const cardapioPayload = {
            data: data,
            desjejum: {},
            almoco: {},
            janta: {}
        };

        formTextareas.forEach(textarea => {
            const meal = textarea.dataset.meal;
            const field = textarea.dataset.field;
            if (meal && field) {
                cardapioPayload[meal][field] = textarea.value;
            }
        });

        try {
            const result = await fetchAdminAPI('/cardapio', 'POST', cardapioPayload);
            showFormMessage(result.message, 'success');
        } catch (error) {
            showFormMessage(error.message, 'error');
        }
    }


    // --- 4. LÓGICA DO MODERADOR DE COMENTÁRIOS ---

    async function loadCommentsForModeration() {
        const date = commentDateInput.value;
        if (!date) return;

        commentsListAdmin.innerHTML = '<p class="loading-text">Carregando comentários...</p>';
        try {
            const data = await fetchAdminAPI(`/comentarios/${date}`);
            
            if (data.length === 0) {
                commentsListAdmin.innerHTML = '<p class="loading-text">Nenhum comentário encontrado para este dia.</p>';
                return;
            }

            commentsListAdmin.innerHTML = ''; 
            data.forEach(comment => {
                const item = document.createElement('div');
                item.className = 'comment-item-admin';
                if (!comment.esta_visivel) {
                    item.classList.add('hidden-comment');
                }
                
                item.innerHTML = `
                    <div class="comment-header">
                        <strong>${comment.autor}</strong>
                        <span>${new Date(comment.criado_em).toLocaleString('pt-BR')}</span>
                    </div>
                    <p class="comment-body">${comment.texto}</p>
                    <div class="comment-actions">
                        <button class="toggle-visibility-btn" data-id="${comment.id}" data-visible="${comment.esta_visivel}">
                            ${comment.esta_visivel ? 'Ocultar' : 'Re-exibir'}
                        </button>
                        <button class="delete-btn" data-id="${comment.id}">Deletar</button>
                    </div>
                `;
                commentsListAdmin.appendChild(item);
            });

        } catch (error) {
            commentsListAdmin.innerHTML = `<p class="loading-text" style="color: red;">${error.message}</p>`;
        }
    }

    async function handleCommentAction(e) {
        const button = e.target;
        const id = button.dataset.id;
        if (!id) return;

        try {
            if (button.classList.contains('toggle-visibility-btn')) {
                const estaVisivel = button.dataset.visible === '1';
                const novoStatus = !estaVisivel;
                
                await fetchAdminAPI(`/comentarios/moderar/${id}`, 'PUT', { visivel: novoStatus });
                
                button.dataset.visible = novoStatus ? '1' : '0';
                button.textContent = novoStatus ? 'Ocultar' : 'Re-exibir';
                button.closest('.comment-item-admin').classList.toggle('hidden-comment', !novoStatus);

            } else if (button.classList.contains('delete-btn')) {
                if (confirm('Tem certeza que deseja deletar este comentário PERMANENTEMENTE?')) {
                    await fetchAdminAPI(`/comentarios/${id}`, 'DELETE');
                    button.closest('.comment-item-admin').remove();
                }
            }
        } catch (error) {
            alert(`Erro: ${error.message}`);
        }
    }

    // --- 5. LÓGICA DE IMPORTAÇÃO DE PLANILHA (RF008) ---

    // Gera um template CSV vazio com os cabeçalhos corretos para download
    function gerarTemplateCSV() {
        const headers = [
            "Data",
            "Desjejum_Bebida", "Desjejum_Acompanhamento", "Desjejum_Guarnicao",
            "Almoco_Salada", "Almoco_Proteina_1", "Almoco_Proteina_2", "Almoco_Vegetariana", "Almoco_Acompanhamento", "Almoco_Guarnicao", "Almoco_Sobremesa",
            "Janta_Salada", "Janta_Proteina_1", "Janta_Proteina_2", "Janta_Vegetariana", "Janta_Acompanhamento", "Janta_Guarnicao", "Janta_Sopa", "Janta_Sobremesa"
        ];

        // Cria a primeira linha (cabeçalhos) e uma segunda linha vazia de exemplo
        const csvContent = "\uFEFF" + headers.join(",") + "\n" + "DD/MM/YYYY,,,,,,,,,,,,,,,,,,";

        // Cria um Blob com o conteúdo e o tipo MIME para CSV em UTF-8
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        // Cria um link temporário para forçar o download
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "Template_Cardapio_RU.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async function handleImportarPlanilha() {
        const fileInput = document.getElementById('filePlanilha');
        const feedback = document.getElementById('importarFeedback');
        const btnImportar = document.getElementById('btnImportar');
        const file = fileInput.files[0];

        if (!file) {
            feedback.textContent = '❌ Por favor, selecione um arquivo (.xlsx ou .csv).';
            feedback.className = 'form-message error';
            return;
        }

        const formData = new FormData();
        formData.append('planilha', file);

        try {
            btnImportar.disabled = true;
            btnImportar.textContent = 'Importando...';
            feedback.textContent = 'Processando planilha...';
            feedback.className = 'form-message loading';

            const response = await fetch('/api/admin/importar', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                },
                body: formData
            });

            if (response.status === 401) {
                handleLogout();
                throw new Error('Sessão expirada.');
            }

            const data = await response.json();

            if (response.ok) {
                feedback.textContent = `✅ ${data.message}`;
                feedback.className = 'form-message success';
                fileInput.value = ''; // Limpa o input
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Erro na importação:', error);
            feedback.textContent = `❌ ${error.message || 'Erro de conexão com o servidor.'}`;
            feedback.className = 'form-message error';
        } finally {
            btnImportar.disabled = false;
            btnImportar.textContent = 'Importar Dados';
        }
    }

    // --- EVENT LISTENERS ---
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);

    tabButtons.forEach(btn => btn.addEventListener('click', handleTabClick));

    // Cardápio
    menuForm.addEventListener('submit', handleMenuFormSubmit);
    loadMenuBtn.addEventListener('click', loadMenuData);

    // Comentários
    loadCommentsBtn.addEventListener('click', loadCommentsForModeration);
    commentsListAdmin.addEventListener('click', handleCommentAction);

    // Importar Planilha
    const btnImportarObj = document.getElementById('btnImportar');
    if(btnImportarObj) {
        btnImportarObj.addEventListener('click', handleImportarPlanilha);
    }
    
    // Botão de Baixar Template
    const btnBaixarTemplate = document.getElementById('btnBaixarTemplate');
    if(btnBaixarTemplate) {
        btnBaixarTemplate.addEventListener('click', gerarTemplateCSV);
    }

    // --- INICIALIZAÇÃO ---
    checkLoginStatus();

});