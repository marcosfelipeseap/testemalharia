const express = require('express');
const router = express.Router();

const { requireAuth, requireMalhariaAccess, checkUserPassive } = require('../middlewares/auth.middleware'); 

// ======== IMPORTAÇÃO DAS ROTAS ========
const dashboardRoutes = require('./dashboard.routes'); // Rotas Públicas
const processosRoutes = require('./processos.routes');
const unidadesRoutes = require('./unidades.routes');
const malhariasRoutes = require('./malharias.routes');
const itensRoutes = require('./itens.routes');
const registrosRoutes = require('./registros.routes');
const maquinariosRoutes = require('./maquinarios.routes');
const estoqueRoutes = require('./estoque.routes'); 
const cortesRoutes = require('./cortes.routes'); 
const maquinasImpressaoRoutes = require('./maquinas_impressao.routes');
const impressoesRoutes = require('./impressoes.routes');
const tintasBobinasRoutes = require('./tintas_bobinas.routes'); 
const rankingRoutes = require('./ranking.routes');

// ======== ÁREA PÚBLICA (SEM EXIGIR LOGIN, MAS COM LEITURA PASSIVA DE SESSÃO) ========
router.use('/painel-publico', checkUserPassive, dashboardRoutes);

// Atalho para o botão do Painel Público funcionar (tanto de dentro do sistema como do Login)
router.get('/publico', (req, res) => {
    res.redirect('/painel-publico/diario');
});

// ======== ÁREA RESTRITA (COM LOGIN) ========
router.use('/processos', requireAuth, requireMalhariaAccess, processosRoutes);
router.use('/unidades', requireAuth, requireMalhariaAccess, unidadesRoutes);
router.use('/malharias', requireAuth, requireMalhariaAccess, malhariasRoutes);
router.use('/itens', requireAuth, requireMalhariaAccess, itensRoutes);
router.use('/registros', requireAuth, requireMalhariaAccess, registrosRoutes);
router.use('/maquinarios', requireAuth, requireMalhariaAccess, maquinariosRoutes);
router.use('/estoque', requireAuth, requireMalhariaAccess, estoqueRoutes); 
router.use('/cortes', requireAuth, requireMalhariaAccess, cortesRoutes); 

// Rota de Gamificação
router.use('/ranking', requireAuth, rankingRoutes);

// Rotas do Ambiente de Insumos
router.use('/maquinas-impressao', requireAuth, maquinasImpressaoRoutes);
router.use('/impressoes', requireAuth, impressoesRoutes);
router.use('/tintas-bobinas', requireAuth, tintasBobinasRoutes); 

// ======== ROTA PRINCIPAL ========
// Redireciona quem acessa a raiz do sistema direto para o login
router.get('/', (req, res) => {
    res.redirect('/auth/login');
});

module.exports = router;