const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const supabase = require('./config/supabaseClient'); 

// Importação do Serviço de Ranking para o Pódio Global
const rankingService = require('./services/ranking.service');

const app = express();

app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/main');

app.use(express.static(path.join(__dirname, 'public')));
app.use(morgan('dev'));

app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ limit: '10mb', extended: true })); 
app.use(cookieParser());

app.use(async (req, res, next) => {
    res.locals.currentPath = req.path;
    res.locals.query = req.query; 
    
    // Regra do ambiente Insumos
    if (req.path.startsWith('/insumos') || 
        req.path.startsWith('/impressoes') || 
        req.path.startsWith('/maquinas-impressao') || 
        req.path.startsWith('/tintas-bobinas') || 
        (req.query && req.query.env === 'insumos')) {
        res.locals.currentEnv = 'insumos';
    } else {
        res.locals.currentEnv = 'malharia';
    }

    try {
        const { count: countPendentes } = await supabase.schema('malharia')
            .from('solicitacoes_insumos')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pendente');
        res.locals.pendingSolicitacoesCount = countPendentes || 0;

        const tresDiasAtras = new Date();
        tresDiasAtras.setDate(tresDiasAtras.getDate() - 3);
        const isoDate = tresDiasAtras.toISOString();

        const { count: countAprovadas } = await supabase.schema('malharia')
            .from('solicitacoes_insumos')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'aprovada')
            .gte('updated_at', isoDate);
        res.locals.recentAprovadasCount = countAprovadas || 0;

        const { count: countRejeitadas } = await supabase.schema('malharia')
            .from('solicitacoes_insumos')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'rejeitada')
            .gte('updated_at', isoDate);
        res.locals.recentRejeitadasCount = countRejeitadas || 0;

        // NOVO: Coleta o Ranking Global do Mês Atual para o Top 5 do Cabeçalho
        const dataAtual = new Date();
        const rankingCompleto = await rankingService.getRankingPerformance(dataAtual.getMonth() + 1, dataAtual.getFullYear());
        res.locals.top5Ranking = rankingCompleto.slice(0, 5); // Pega apenas os 5 primeiros

    } catch (e) {
        console.error("Erro no middleware global:", e);
        res.locals.pendingSolicitacoesCount = 0;
        res.locals.recentAprovadasCount = 0;
        res.locals.recentRejeitadasCount = 0;
        res.locals.top5Ranking = [];
    }
    
    next();
});

// Importações corretas de rotas sem duplicidade
const authRoutes = require('./routes/auth.routes');         
const usuariosRoutes = require('./routes/usuarios.routes'); 
const insumosRoutes = require('./routes/insumos.routes');
const solicitacoesRoutes = require('./routes/solicitacoes.routes'); 
const suporteRoutes = require('./routes/suporte.routes'); 
const indexRoutes = require('./routes/index.routes');

// Montagem das rotas independentes
app.use('/auth', authRoutes);
app.use('/usuarios', usuariosRoutes);
app.use('/insumos', insumosRoutes);
app.use('/solicitacoes', solicitacoesRoutes); 
app.use('/suporte', suporteRoutes);

// A rota raiz DEVE ser a última. Ela carrega a proteção de todas as rotas (incluindo as novas)
app.use('/', indexRoutes);

app.use((req, res, next) => {
    res.status(404).render('partials/alerts', {
        layout: false, 
        message: 'Página não encontrada',
        type: 'danger'
    });
});

module.exports = app;