jest.mock('../src/config/db');

// 1. Importa a função específica que queremos testar
const { getDbTodayDate } = require('../src/controllers/publicController');

// "describe" agrupa um conjunto de testes relacionados ao "publicController"
describe('Testes para Funções Auxiliares (Helpers) do publicController', () => {

    // "test" define um caso de teste individual
    test('getDbTodayDate deve retornar a data no formato YYYY-MM-DD', () => {
        
        // 2. Chama a função que está sendo testada
        const dateString = getDbTodayDate();

        // 3. Define o padrão esperado (Expressão Regular para YYYY-MM-DD)
        const regex = /^\d{4}-\d{2}-\d{2}$/;

        // 4. "expect" é a asserção (o que esperamos que aconteça)
        // Esperamos que a string de data (dateString) corresponda (toMatch) à regex.
        expect(dateString).toMatch(regex);
    });

    // Pode-se adicionar mais testes aqui no futuro...
    // exemplo : test('outroTeste deve fazer outra coisa', () => { ... });

});

// Feito por Wilian Tavares, confia