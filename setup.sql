-- -----------------------------------------------------------------------------
-- Descrição: Script para criar o banco de dados, tabelas e dados iniciais para a aplicação RU ICET.

-- -----------------------------------------------------------------------------
-- CRIAÇÃO DO BANCO DE DADOS (se não existir)
-- -----------------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS ru_icet_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ru_icet_db;

-- -----------------------------------------------------------------------------
-- DROPAR TABELAS ANTIGAS (para permitir re-execução do script)
-- Ordem reversa de dependência (comentários dependem de cardapios, etc.)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS protein_votos;
DROP TABLE IF EXISTS comentarios;
DROP TABLE IF EXISTS admins;
DROP TABLE IF EXISTS cardapios;
-- Se você ainda tiver a tabela 'votos' antiga, pode adicionar: DROP TABLE IF EXISTS votos;

-- -----------------------------------------------------------------------------
-- CRIAÇÃO DA TABELA 'cardapios'
-- Armazena os detalhes do cardápio para cada dia.
-- -----------------------------------------------------------------------------
CREATE TABLE cardapios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    data DATE NOT NULL UNIQUE COMMENT 'Data do cardápio (chave única)',
    desjejum JSON COMMENT 'Detalhes do desjejum em formato JSON',
    almoco JSON COMMENT 'Detalhes do almoço em formato JSON',
    janta JSON COMMENT 'Detalhes da janta em formato JSON',
    likes INT DEFAULT 0 COMMENT 'Contagem GERAL de likes (para ranking semanal)',
    dislikes INT DEFAULT 0 COMMENT 'Contagem GERAL de dislikes (para ranking semanal)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tabela principal de cardápios diários';

-- -----------------------------------------------------------------------------
-- CRIAÇÃO DA TABELA 'comentarios'
-- Armazena os comentários dos usuários sobre os cardápios.
-- -----------------------------------------------------------------------------
CREATE TABLE comentarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    data_cardapio DATE NOT NULL COMMENT 'Data do cardápio comentado',
    autor VARCHAR(100) NOT NULL COMMENT 'Nome do autor do comentário',
    texto TEXT NOT NULL COMMENT 'Conteúdo do comentário',
    esta_visivel BOOLEAN DEFAULT TRUE COMMENT 'Indica se o comentário está visível para o público',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Data e hora de criação do comentário',
    FOREIGN KEY (data_cardapio) REFERENCES cardapios(data) ON DELETE CASCADE COMMENT 'Link para a data do cardápio'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Comentários dos usuários sobre os cardápios';

-- -----------------------------------------------------------------------------
-- CRIAÇÃO DA TABELA 'protein_votos'
-- Armazena os votos (like/dislike) para proteínas específicas.
-- -----------------------------------------------------------------------------
CREATE TABLE protein_votos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    data_cardapio DATE NOT NULL COMMENT 'Data do cardápio votado',
    meal_type ENUM('almoco', 'janta') NOT NULL COMMENT 'Refeição (almoço ou janta)',
    protein_key VARCHAR(50) NOT NULL COMMENT 'Chave da proteína (proteina_1, proteina_2, vegetariana)',
    identificador VARCHAR(255) NOT NULL COMMENT 'Identificador único do usuário/dispositivo',
    tipo_voto ENUM('like', 'dislike') NOT NULL COMMENT 'Tipo do voto',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Data e hora do voto',
    UNIQUE KEY idx_unique_protein_vote (data_cardapio, meal_type, identificador) COMMENT 'Garante 1 voto por usuário por REFEIÇÃO por dia',
    FOREIGN KEY (data_cardapio) REFERENCES cardapios(data) ON DELETE CASCADE COMMENT 'Link para a data do cardápio'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Votos específicos para as proteínas do almoço/janta';

-- -----------------------------------------------------------------------------
-- CRIAÇÃO DA TABELA 'admins'
-- Armazena as credenciais dos administradores.
-- -----------------------------------------------------------------------------
CREATE TABLE admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario VARCHAR(50) NOT NULL UNIQUE COMMENT 'Nome de usuário do admin',
    senha_hash VARCHAR(255) NOT NULL COMMENT 'Hash da senha (gerado com bcrypt)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Usuários administradores do sistema';

-- -----------------------------------------------------------------------------
-- INSERÇÃO DE DADOS INICIAIS
-- -----------------------------------------------------------------------------

-- Inserir usuário admin padrão (usuário: admin, senha: admin123)
INSERT INTO admins (usuario, senha_hash)
VALUES ('admin', '$2b$10$f/..A.mEb5l.Fm0/N3..o.a98q.t3.nJtA/u/go3.bN.D3wBS1S.2')
ON DUPLICATE KEY UPDATE senha_hash='$2b$10$f/..A.mEb5l.Fm0/N3..o.a98q.t3.nJtA/u/go3.bN.D3wBS1S.2'; -- Atualiza caso 'admin' já exista

-- Inserir cardápios para a semana atual (27/10/2025 - 31/10/2025)
-- Adaptado dos dados fornecidos anteriormente
INSERT INTO cardapios (data, desjejum, almoco, janta) VALUES
-- Segunda-feira, 27/10/2025
('2025-10-27',
 JSON_OBJECT('bebida', 'Café / Leite / Suco', 'acompanhamento', 'Pão francês / Forma', 'guarnicao', 'Fruta / Requeijão / Mingau de Aveia'),
 JSON_OBJECT('salada', 'Crua / Cozida', 'proteina_1', 'Pirarucu Desfiado', 'proteina_2', 'Picadinho Sofisticado', 'vegetariana', 'Omelete tropical', 'acompanhamento', 'Arroz / Feijão / Farofa', 'guarnicao', 'Vatapá', 'sobremesa', 'Fruta / Suco'),
 JSON_OBJECT('salada', 'Crua / Cozida', 'proteina_1', 'Bisteca Suína ao Molho', 'proteina_2', 'Cozidão Nortista', 'vegetariana', 'Suflê de legumes', 'acompanhamento', 'Arroz / Farofa', 'guarnicao', 'Feijão Tropeiro', 'sopa', 'Feijão (carne, macarrão, feijão, batata e cenoura)', 'sobremesa', 'Fruta / Suco')
),
-- Terça-feira, 28/10/2025
('2025-10-28',
 JSON_OBJECT('bebida', 'Café / Leite / Suco', 'acompanhamento', 'Pão francês / Hamburguer', 'guarnicao', 'Fruta / Patê de Presunto / Banana Cozida'),
 JSON_OBJECT('salada', 'Crua / Cozida', 'proteina_1', 'Frango à Chinesa', 'proteina_2', 'Isca de Carne', 'vegetariana', 'Carne de soja à delícia', 'acompanhamento', 'Arroz / Feijão / Farofa', 'guarnicao', 'Espaguete ao molho de ervas', 'sobremesa', 'Creme de Goiaba / Suco'),
 JSON_OBJECT('salada', 'Crua / Cozida', 'proteina_1', 'Desfiado de Frango e Legumes', 'proteina_2', 'Panqueca de Carne', 'vegetariana', 'Almôndegas de Soja', 'acompanhamento', 'Arroz / Farofa', 'guarnicao', 'Purê de Abóbora', 'sopa', 'Canja (frango, cheiro verde, batata, cenoura e arroz)', 'sobremesa', 'Doce / Suco')
),
-- Quarta-feira, 29/10/2025
('2025-10-29',
 JSON_OBJECT('bebida', 'Café / Leite / Suco', 'acompanhamento', 'Pão francês / Massa fina', 'guarnicao', 'Fruta / Molho de Carne / Cuscuz à Paulista'),
 JSON_OBJECT('salada', 'Crua / Cozida', 'proteina_1', 'Filé de Frango Grelhado', 'proteina_2', 'Estrogonofe de Carne', 'vegetariana', 'Berinjela recheada', 'acompanhamento', 'Arroz / Feijão / Farofa', 'guarnicao', 'Espaguete ao alho e óleo', 'sobremesa', 'Fruta / Suco'),
 JSON_OBJECT('salada', 'Crua / Cozida', 'proteina_1', 'Pirarucu Desfiado', 'proteina_2', 'Picadinho Sofisticado', 'vegetariana', 'Macarronada de Soja', 'acompanhamento', 'Arroz / Feijão / Farofa', 'guarnicao', 'Vatapá', 'sopa', 'Lorena (carne, macarrão, repolho, batata e cenoura)', 'sobremesa', 'Fruta / Suco')
),
-- Quinta-feira, 30/10/2025
('2025-10-30',
 JSON_OBJECT('bebida', 'Café / Leite / Suco', 'acompanhamento', 'Pão francês / Hamburguer', 'guarnicao', 'Fruta / Ovos Mexidos c/ Legumes / Bola de Frango'),
 JSON_OBJECT('salada', 'Crua / Cozida', 'proteina_1', 'Desfiado de Frango e Legumes', 'proteina_2', 'Panqueca de Carne', 'vegetariana', 'Almôndegas de Soja', 'acompanhamento', 'Arroz / Feijão / Farofa', 'guarnicao', 'Purê de Abóbora', 'sobremesa', 'Gelatina / Suco'),
 JSON_OBJECT('salada', 'Crua / Cozida', 'proteina_1', 'Coxa / Sobrecoxas Assadas', 'proteina_2', 'Isca de Carne', 'vegetariana', 'Carne de soja à delícia', 'acompanhamento', 'Arroz / Feijão / Farofa', 'guarnicao', 'Espaguete ao molho de ervas', 'sopa', 'Canja (frango, cheiro verde, batata, cenoura e arroz)', 'sobremesa', 'Gelatina / Suco')
),
-- Sexta-feira, 31/10/2025
('2025-10-31',
 JSON_OBJECT('bebida', 'Café / Leite / Suco', 'acompanhamento', 'Pão francês / Forma', 'guarnicao', 'Fruta / Presunto / Ovo Cozido'),
 JSON_OBJECT('salada', 'Crua / Cozida', 'proteina_1', 'Feijoada completa (carne suína e calabresa)', 'proteina_2', 'Cozidão Nortista', 'vegetariana', 'Feijoada vegetariana', 'acompanhamento', 'Arroz / Feijão / Farofa', 'guarnicao', 'Espaguete c/ Açafrão', 'sobremesa', 'Fruta / Suco'),
 JSON_OBJECT('salada', 'Crua / Cozida', 'proteina_1', 'Filé de Frango Grelhado', 'proteina_2', 'Estrogonofe de Carne', 'vegetariana', 'Berinjela recheada', 'acompanhamento', 'Arroz / Farofa', 'guarnicao', 'Espaguete ao alho e óleo', 'sopa', 'Carne (carne, macarrão, feijão verde, batata e cenoura)', 'sobremesa', 'Fruta / Suco')
)
-- Use ON DUPLICATE KEY UPDATE para evitar erro se as datas já existirem (útil para re-executar)
ON DUPLICATE KEY UPDATE
  desjejum = VALUES(desjejum),
  almoco = VALUES(almoco),
  janta = VALUES(janta),
  -- Resetar likes/dislikes gerais ao inserir/atualizar dados da semana
  likes = 0,
  dislikes = 0;

-- -----------------------------------------------------------------------------
-- FIM DO SCRIPT
-- -----------------------------------------------------------------------------
SELECT 'Script de configuração concluído com sucesso!' AS status;