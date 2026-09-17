const tbService = require('../services/tintas_bobinas.service');

exports.index = async (req, res) => {
    try {
        const itens = await tbService.getItensComGrupos();
        res.render('tintas_bobinas/index', {
            title: 'Controle de Tintas e Bobinas',
            itens, user: req.user
        });
    } catch (error) {
        console.error(error);
        res.redirect('/insumos');
    }
};

exports.storeItem = async (req, res) => {
    try {
        const { nome, estoque_minimo } = req.body;
        await tbService.createItem({ nome, estoque_minimo: parseInt(estoque_minimo) || 0 });
        res.redirect('/tintas-bobinas');
    } catch (error) { res.redirect('/tintas-bobinas'); }
};

exports.updateItem = async (req, res) => {
    try {
        const { nome, estoque_minimo } = req.body;
        await tbService.updateItem(req.params.id, { nome, estoque_minimo: parseInt(estoque_minimo) || 0 });
        res.redirect('/tintas-bobinas');
    } catch (error) { res.redirect('/tintas-bobinas'); }
};

exports.deleteItem = async (req, res) => {
    try {
        await tbService.deleteItem(req.params.id);
        res.redirect('/tintas-bobinas');
    } catch (error) { res.redirect('/tintas-bobinas'); }
};

exports.storeGrupo = async (req, res) => {
    try {
        const { item_id, nome } = req.body;
        await tbService.createGrupo({ item_id, nome });
        res.redirect('/tintas-bobinas');
    } catch (error) { res.redirect('/tintas-bobinas'); }
};

exports.updateGrupo = async (req, res) => {
    try {
        const { nome } = req.body;
        await tbService.updateGrupo(req.params.id, { nome });
        res.redirect('/tintas-bobinas');
    } catch (error) { res.redirect('/tintas-bobinas'); }
};

exports.deleteGrupo = async (req, res) => {
    try {
        await tbService.deleteGrupo(req.params.id);
        res.redirect('/tintas-bobinas');
    } catch (error) { res.redirect('/tintas-bobinas'); }
};

exports.movimentacoesIndex = async (req, res) => {
    try {
        const movimentacoes = await tbService.getMovimentacoes();
        res.render('tintas_bobinas/movimentacoes', {
            title: 'Histórico Global', movimentacoes, user: req.user
        });
    } catch (error) {
        console.error(error);
        res.redirect('/tintas-bobinas');
    }
};

// ATUALIZADO: Trata requisições com múltiplas linhas de uma vez
exports.storeMovimentacao = async (req, res) => {
    try {
        const { grupo_id, tipos, quantidades, datas_movimentacao, fornecedores } = req.body;
        let movimentacoes = [];
        
        if (tipos) {
            if (Array.isArray(tipos)) {
                for(let i=0; i < tipos.length; i++){
                    movimentacoes.push({
                        tipo: tipos[i],
                        quantidade: quantidades[i],
                        data_movimentacao: datas_movimentacao[i],
                        fornecedor: fornecedores[i] || ''
                    });
                }
            } else {
                movimentacoes.push({
                    tipo: tipos, quantidade: quantidades,
                    data_movimentacao: datas_movimentacao, fornecedor: fornecedores || ''
                });
            }
        }

        await tbService.createMovimentacoesEmLote(grupo_id, movimentacoes, req.user.id);
        res.redirect('/tintas-bobinas');
    } catch (error) {
        console.error("Erro ao registrar movimentação em lote:", error);
        res.redirect('/tintas-bobinas');
    }
};

exports.deleteMovimentacao = async (req, res) => {
    try {
        await tbService.deleteMovimentacao(req.params.id);
        // Tenta voltar de onde o usuário veio
        const redirectUrl = req.get('Referrer') || '/tintas-bobinas';
        res.redirect(redirectUrl);
    } catch (error) {
        res.redirect('/tintas-bobinas');
    }
};