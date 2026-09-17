const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');

// Acessível via GET: /painel-publico/diario
router.get('/diario', dashboardController.diarioPublico);

// No futuro, se quiser um ranking público, basta adicionar:
// router.get('/ranking', dashboardController.rankingPublico);

module.exports = router;