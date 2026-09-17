const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuarios.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');

// Todas as rotas aqui exigem login
router.use(requireAuth);

// Rotas do Perfil (Qualquer usuário logado acessa)
router.get('/perfil', usuariosController.getPerfil);
router.post('/perfil', usuariosController.updatePerfil);

// Rotas de Gestão de Usuários (Apenas Gestor e Admin -> Nível 3 ou superior)
router.use(requireRole('gestor')); 

router.get('/', usuariosController.index);
router.get('/:id/editar', usuariosController.edit);
router.post('/:id/editar', usuariosController.update);
router.post('/:id/excluir', usuariosController.delete); // Usando POST para simular DELETE por segurança no form

module.exports = router;