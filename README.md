# 🍽️ Cardápio RU ICET (Sabores da SI)

![Status](https://img.shields.io/badge/Status-Em%20Desenvolvimento-yellow)
![License](https://img.shields.io/badge/License-MIT-green)

Aplicação web para visualização, votação e comentários sobre o cardápio do Restaurante Universitário (RU) do Instituto de Ciências Exatas e Tecnologia (ICET) da UFAM em Itacoatiara.

## ✨ Funcionalidades

### 👤 Frontend Público
* **Visualização Semanal:** Navegação fácil entre os cardápios dos dias da semana.
* **Detalhes da Refeição:** Lista completa para desjejum, almoço e janta.
* **Sistema de Votos:** Votação (like/dislike) para as proteínas do almoço e janta, restrita a um voto por refeição por dia.
* **Ranking de Proteínas:**
    * **Diário:** Exibe a(s) proteína(s) mais votada(s) do dia.
    * **Semanal:** Gráfico (Chart.js) com as 5 proteínas mais curtidas da semana.
* **Comentários Públicos:** Seção para os usuários deixarem feedback sobre o cardápio do dia.

### 🔒 Painel Administrativo
* **Autenticação Segura:** Painel protegido com login (usuário/senha com bcrypt) e autenticação baseada em token (JWT).
* **Gerenciamento de Cardápio:** Interface para Criar ou Atualizar (UPSERT) o cardápio de qualquer dia.
* **Moderação de Comentários:** Interface para carregar comentários de um dia específico, permitindo Ocultar, Re-exibir ou Deletar permanentemente.

## 🛠️ Stack Tecnológica

* **Backend:** Node.js, Express.js
* **Banco de Dados:** MySQL (utilizando `mysql2/promise` com Pool de Conexões)
* **Autenticação:** JSON Web Token (JWT), bcrypt
* **Frontend (Público):** HTML5, CSS3, JavaScript (Vanilla JS)
* **Frontend (Admin):** HTML5, CSS3, JavaScript (Vanilla JS)
* **Visualização de Dados:** Chart.js (para o ranking semanal)

## 🚀 Como Rodar Localmente

Siga estas instruções para configurar e rodar o projeto em sua máquina local.

### Pré-requisitos
* [Node.js](https://nodejs.org/) (v16 ou superior)
* Um servidor MySQL (local, Docker, etc.)

### Passos

1.  **Clone o repositório:**
    ```bash
    git clone [https://github.com/DevPabloOliveira/ru-icet-app.git](https://github.com/DevPabloOliveira/ru-icet-app.git)
    cd ru-icet-app
    ```

2.  **Instale as dependências do Node.js:**
    ```bash
    npm install
    ```

3.  **Configure o Banco de Dados:**
    * Abra seu gerenciador de banco de dados (DBeaver, MySQL Workbench, etc.) e conecte-se ao seu servidor MySQL.
    * Execute o script `./setup.sql` para criar o banco de dados (`ru_icet_db`), todas as tabelas e inserir os dados de exemplo.

4.  **Configure as Variáveis de Ambiente:**
    * Crie um arquivo chamado `.env` na raiz do projeto.
    * Copie o conteúdo abaixo e preencha com suas credenciais:

    ```.env
    # Configuração do Banco de Dados
    MYSQLHOST=localhost
    MYSQLUSER=root
    MYSQLPASSWORD=seu_password_aqui
    MYSQLDATABASE=ru_icet_db
    MYSQLPORT=3306

    # Chave Secreta para JWT (MUITO IMPORTANTE)
    # Use um gerador de string aleatória e forte para produção
    JWT_SECRET=meu-segredo-local-para-testes-123456
    ```

5.  **Gere um Hash de Senha (Opcional):**
    * O `setup.sql` já insere um admin (`admin`/`admin123`).
    * Se quiser criar seu próprio hash, use o script auxiliar:
    ```bash
    node gerar_hash_bcrypt.py
    ```
    * (Nota: O script é `.py`, mas seu conteúdo é Python. Se você tiver Python instalado, rode com `python3 gerar_hash_bcrypt.py`. Se não, ignore este passo e use a senha padrão `admin123` por enquanto).

6.  **Inicie o Servidor:**
    ```bash
    npm start 
    ```
    *ou, em modo de desenvolvimento:*
    ```bash
    node src/server.js
    ```

7.  **Acesse a aplicação:**
    * **Frontend:** `http://localhost:3000`
    * **Painel Admin:** `http://localhost:3000/admin`

---
## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.