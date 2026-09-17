const express = require('express');
const router = express.Router();
const controller = require('../controllers/maquinarios.controller');
const { requireRole } = require('../middlewares/auth.middleware');

router.get('/', controller.index);

// Apenas Gestor e Admin podem aceder aos métodos abaixo
router.use(requireRole('gestor'));
router.get('/tipos', controller.indexTipos);
router.post('/tipos', controller.storeTipo);
router.post('/tipos/:id/update', controller.updateTipo);
router.post('/tipos/:id/delete', controller.destroyTipo);
router.get('/create', controller.create);
router.post('/', controller.store);
router.get('/:id/edit', controller.edit);
router.post('/:id/update', controller.update);
router.post('/:id/delete', controller.destroy);

module.exports = router;