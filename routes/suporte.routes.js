const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/auth.middleware');
const suporteController = require('../controllers/suporte.controller');

router.use(requireAuth);

router.get('/mensagens', suporteController.getMensagens);
router.post('/mensagens', suporteController.enviarMensagem);
router.delete('/mensagens', suporteController.encerrarChat); // NOVA ROTA
router.get('/contatos', suporteController.getContatos);
router.get('/notificacoes', suporteController.checkNotificacoes); // NOVA ROTA

module.exports = router;