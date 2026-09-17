const express = require('express');
const router = express.Router();
const SolicitacoesController = require('../controllers/solicitacoes.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

router.use(requireAuth);

router.get('/', SolicitacoesController.index);
router.post('/novo', SolicitacoesController.criar);
router.post('/:id/responder', SolicitacoesController.responder);
router.post('/:id/excluir', SolicitacoesController.excluir); // Rota que estava faltando/dando 404

module.exports = router;