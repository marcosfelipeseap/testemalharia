const express = require('express');
const router = express.Router();
const malhariasController = require('../controllers/malharias.controller');
const { requireRole } = require('../middlewares/auth.middleware');

router.get('/', malhariasController.index);

// Monitores precisam aceder à edição para preencher a série/modelo
router.get('/:id/edit', malhariasController.edit);
router.post('/:id/update', malhariasController.update);

// Apenas Gestor e Admin podem Criar ou Apagar malharias
router.use(requireRole('gestor'));
router.get('/create', malhariasController.create); 
router.post('/', malhariasController.store);
router.post('/:id/delete', malhariasController.destroy);

module.exports = router;