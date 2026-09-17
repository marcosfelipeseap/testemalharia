const express = require('express');
const router = express.Router();
const estoqueController = require('../controllers/estoque.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const upload = require('../config/upload.config'); // Middleware de Upload

router.get('/', authMiddleware.requireAuth, estoqueController.index);

// Rota de Transferência com Upload do PDF (campo 'documento_termo')
router.post('/transferir', authMiddleware.requireAuth, upload.single('documento_termo'), estoqueController.transferir);

router.get('/historico', authMiddleware.requireAuth, estoqueController.historico);
router.post('/arquivar', authMiddleware.requireAuth, estoqueController.arquivar);

router.post('/aprovar', authMiddleware.requireRole('gestor'), estoqueController.aprovar);
router.post('/rejeitar', authMiddleware.requireRole('gestor'), estoqueController.rejeitar);

module.exports = router;