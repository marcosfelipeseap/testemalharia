const itensService = require('../services/itens.service');
const maquinariosService = require('../services/maquinarios.service');
const malhariasService = require('../services/malharias.service');

exports.index = async (req, res) => {
    try {
        const busca = req.query.busca || '';
        const error = req.query.error || null; 
        
        let itens = await itensService.getAllItens(busca);

        // FILTRO APENAS PARA MONITOR (Nível 1)
        // O Coordenador vê todos os itens, mas os botões de ação ficam ocultos via EJS (nivel < 3).
        if (req.user.cargo === 'monitor') {
            const permitidas = (req.user.malharias_permitidas || []).map(String);
            let maquinasPermitidas = new Set();
            
            for (let idMalharia of permitidas) {
                const malhariaDetalhe = await malhariasService.getMalhariaById(idMalharia);
                
                if (malhariaDetalhe && malhariaDetalhe.itens) {
                    let arrItens = [];
                    if (typeof malhariaDetalhe.itens === 'string') {
                        try { arrItens = JSON.parse(malhariaDetalhe.itens); } catch(e){}
                    } else if (Array.isArray(malhariaDetalhe.itens)) {
                        arrItens = malhariaDetalhe.itens;
                    }
                    
                    arrItens.forEach(i => {
                        const idDaMaquina = i.maquinario_id || i.maquina_id || i.id;
                        if (idDaMaquina) maquinasPermitidas.add(String(idDaMaquina));
                    });
                }
            }

            itens = itens.filter(item => {
                let temAcesso = false;
                if (item.maquinas && Array.isArray(item.maquinas)) {
                    item.maquinas.forEach(vinc => {
                        const idMaqItem = vinc.maquina_id || vinc.maquinario_id;
                        if (idMaqItem && maquinasPermitidas.has(String(idMaqItem))) {
                            temAcesso = true;
                        }
                    });
                }
                if (item.maquina_id && maquinasPermitidas.has(String(item.maquina_id))) {
                    temAcesso = true;
                }
                return temAcesso;
            });
        }

        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.json({ itens });
        }

        res.render('itens/index', { title: 'Itens / Produtos', itens, busca, error });
    } catch (error) {
        console.error("ERRO NO INDEX ITENS:", error);
        if (req.xhr) return res.status(500).json({ error: 'Erro ao buscar' });
        res.redirect('/');
    }
};

exports.create = async (req, res) => {
    try {
        const maquinas = await maquinariosService.getAllMaquinas();
        res.render('itens/create', { title: 'Novo Item', maquinas, error: null, formData: {} });
    } catch (error) { res.redirect('/itens'); }
};

exports.store = async (req, res) => {
    try {
        const { nome, descricao, meta_diaria, maquina_id } = req.body;
        await itensService.createItem({ nome, descricao, meta_diaria: parseInt(meta_diaria) || 0 }, maquina_id);
        res.redirect('/itens');
    } catch (error) {
        const maquinas = await maquinariosService.getAllMaquinas();
        res.render('itens/create', { title: 'Novo Item', maquinas, error: 'Erro ao salvar: ' + error.message, formData: req.body });
    }
};

exports.edit = async (req, res) => {
    try {
        const { id } = req.params;
        const item = await itensService.getItemById(id);
        const maquinas = await maquinariosService.getAllMaquinas();
        if (!item) return res.redirect('/itens');
        res.render('itens/edit', { title: 'Editar Item', item, maquinas, error: null });
    } catch (error) { res.redirect('/itens'); }
};

exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, descricao, meta_diaria, maquina_id } = req.body;
        await itensService.updateItem(id, { nome, descricao, meta_diaria: parseInt(meta_diaria) || 0 }, maquina_id);
        res.redirect('/itens');
    } catch (error) { res.redirect(`/itens/${req.params.id}/edit`); }
};

exports.destroy = async (req, res) => {
    try {
        await itensService.deleteItem(req.params.id);
        res.redirect('/itens');
    } catch (error) {
        let msg = error.code === '23503' ? 'Não é possível excluir este item pois ele faz parte de um ou mais processos.' : 'Erro ao excluir item.';
        res.redirect(`/itens?error=${encodeURIComponent(msg)}`);
    }
};

exports.apiStore = async (req, res) => {
    try {
        const { nome } = req.body;
        const item = await itensService.createItem({ nome }, []); 
        res.status(201).json(item);
    } catch (error) { res.status(500).json({ error: error.message }); }
};