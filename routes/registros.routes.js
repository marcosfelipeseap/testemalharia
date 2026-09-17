const express = require('express');
const router = express.Router();
const registrosController = require('../controllers/registros.controller');

// ======== ROTAS (MONITOR / COORDENADOR) ========
router.get('/painel', registrosController.painelDiario);
router.get('/historico', registrosController.historico);

// ======== BUSCA AVANÇADA / RELATÓRIOS (CARDS) ========
router.get('/relatorios', registrosController.relatorios);

// ======== HISTÓRICO ESPECÍFICO POR MALHARIA ========
router.get('/malharia/:malharia_id/historico', registrosController.historicoPorMalharia);

// ======== ROTAS GERAIS ========
router.get('/', registrosController.index);
router.get('/create', registrosController.create);
router.post('/', registrosController.store);
router.post('/:id/delete', registrosController.destroy);

router.post('/feriados', registrosController.storeFeriado);
router.post('/feriados/:id/delete', registrosController.destroyFeriado);

router.get('/api/malharia-info/:id', registrosController.getMalhariaInfo);
router.get('/:id/edit', registrosController.edit);
router.post('/:id/update', registrosController.update);

module.exports = router;