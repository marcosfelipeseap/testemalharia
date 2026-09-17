const express = require('express');
const router = express.Router();
const impressoesController = require('../controllers/impressoes.controller');

router.get('/', impressoesController.index);
router.get('/create', impressoesController.create);
router.post('/', impressoesController.store);

// Novas rotas de edição
router.get('/:id/edit', impressoesController.edit);
router.post('/:id/update', impressoesController.update);

router.post('/:id/delete', impressoesController.destroy);

module.exports = router;