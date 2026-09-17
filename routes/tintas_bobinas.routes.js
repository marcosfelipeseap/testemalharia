const express = require('express');
const router = express.Router();
const tbController = require('../controllers/tintas_bobinas.controller');

// Dashboard e Gestão de Itens/Grupos
router.get('/', tbController.index);
router.post('/itens', tbController.storeItem);
router.post('/itens/:id/update', tbController.updateItem);
router.post('/itens/:id/delete', tbController.deleteItem);

router.post('/grupos', tbController.storeGrupo);
router.post('/grupos/:id/update', tbController.updateGrupo);
router.post('/grupos/:id/delete', tbController.deleteGrupo);

// Gestão de Movimentações (Entradas/Usos)
router.get('/movimentacoes', tbController.movimentacoesIndex);
router.post('/movimentacoes', tbController.storeMovimentacao);
router.post('/movimentacoes/:id/delete', tbController.deleteMovimentacao);

module.exports = router;