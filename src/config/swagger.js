const swaggerJsDoc = require('swagger-jsdoc');

const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'API - Sabores da SI (RU ICET)',
            version: '1.0.0',
            description: 'Documentação interativa da API RESTful do Sistema de Cardápio e Votação do Restaurante Universitário do ICET/UFAM.',
            contact: { name: 'Equipe de Desenvolvimento' }
        },
        servers: [
            { url: 'http://localhost:3000', description: 'Servidor Local (Desenvolvimento)' }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                }
            }
        },
        paths: {
            '/api/cardapio/semana': {
                get: {
                    summary: 'Busca o cardápio da semana atual e os votos/comentários',
                    tags: ['Público'],
                    responses: { 200: { description: 'JSON com os dados da semana' } }
                }
            },
            '/api/votar': {
                post: {
                    summary: 'Registra ou atualiza um voto (Like/Dislike) na proteína',
                    tags: ['Público'],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        meal_type: { type: 'string', example: 'almoco' },
                                        protein_key: { type: 'string', example: 'proteina_1' },
                                        tipo_voto: { type: 'string', example: 'like' }
                                    }
                                }
                            }
                        }
                    },
                    responses: { 200: { description: 'Voto computado com sucesso' }, 403: { description: 'Fora do horário ou data inválida' } }
                }
            },
            '/api/admin/login': {
                post: {
                    summary: 'Autenticação do Administrador',
                    tags: ['Admin'],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        usuario: { type: 'string', example: 'admin' },
                                        senha: { type: 'string', example: 'senha123' }
                                    }
                                }
                            }
                        }
                    },
                    responses: { 200: { description: 'Retorna o Token JWT' }, 401: { description: 'Credenciais inválidas' } }
                }
            },
            '/api/admin/importar': {
                post: {
                    summary: 'Importar Planilha de Cardápio em Lote (RF008)',
                    tags: ['Admin'],
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        content: {
                            'multipart/form-data': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        planilha: { type: 'string', format: 'binary', description: 'Arquivo .csv ou .xlsx' }
                                    }
                                }
                            }
                        }
                    },
                    responses: { 200: { description: 'Importação concluída' }, 401: { description: 'Token JWT Ausente/Inválido' } }
                }
            }
        }
    },
    apis: [] 
};

module.exports = swaggerJsDoc(swaggerOptions);