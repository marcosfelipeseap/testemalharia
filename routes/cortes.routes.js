const express = require('express');
const router = express.Router();
const cortesController = require('../controllers/cortes.controller');
const { requireAuth, requireRole, requireMalhariaAccess } = require('../middlewares/auth.middleware');
const upload = require('../config/upload.config');

// Proteção global da rota: Exige login e nível mínimo de Monitor (Nível 1)
router.use(requireAuth);
router.use(requireRole('monitor'));
// O middleware abaixo bloqueia o cargo "controlador" que também possui Nível 1, permitindo apenas monitores, coordenadores e gestores
router.use(requireMalhariaAccess);

router.get('/', cortesController.index);

// Ações de criação, edição e exclusão restritas ao Gestor (Nível 3) ou superior
router.post('/store', requireRole('gestor'), upload.single('documento_comprovante'), cortesController.store);
router.post('/:id/update', requireRole('gestor'), upload.single('documento_comprovante'), cortesController.update);
router.post('/:id/delete', requireRole('gestor'), cortesController.destroy);

module.exports = router;