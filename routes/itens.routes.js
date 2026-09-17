const express = require('express');
const router = express.Router();
const itensController = require('../controllers/itens.controller');
const { requireRole } = require('../middlewares/auth.middleware');

router.get('/', itensController.index);

// Apenas Gestor e Admin podem aceder aos métodos abaixo
router.use(requireRole('gestor'));
router.get('/create', itensController.create);
router.post('/', itensController.store);
router.post('/api', itensController.apiStore);
router.get('/:id/edit', itensController.edit);
router.post('/:id/update', itensController.update);
router.post('/:id/delete', itensController.destroy);

module.exports = router;