const rankingService = require('../services/ranking.service');

exports.index = async (req, res) => {
    try {
        const hoje = new Date();
        const mes = req.query.mes ? parseInt(req.query.mes) : hoje.getMonth() + 1;
        const ano = req.query.ano ? parseInt(req.query.ano) : hoje.getFullYear();

        const ranking = await rankingService.getRankingPerformance(mes, ano);

        res.render('ranking/index', {
            title: 'Ranking de Performance',
            ranking,
            mesAtual: mes,
            anoAtual: ano,
            user: req.user
        });
    } catch (error) {
        console.error("Erro ao carregar o ranking completo:", error);
        res.redirect('/');
    }
};