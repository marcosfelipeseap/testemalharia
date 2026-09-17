const express = require('express');
const router = express.Router();
const maquinasController = require('../controllers/maquinas_impressao.controller');

router.get('/', maquinasController.index);
router.post('/', maquinasController.store);
router.post('/:id/update', maquinasController.update);
router.post('/:id/delete', maquinasController.destroy);

module.exports = router;