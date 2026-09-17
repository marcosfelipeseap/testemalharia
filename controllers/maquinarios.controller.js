const service = require('../services/maquinarios.service');
const malhariasService = require('../services/malharias.service');

exports.index = async (req, res) => {
    try {
        const busca = req.query.busca || '';
        let maquinas = await service.getAllMaquinas(busca);

        // FILTRO APENAS PARA MONITOR (Nível 1)
        // O Coordenador (Nível 2) ignora este bloco e vê a lista completa carregada acima.
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
            maquinas = maquinas.filter(maq => maquinasPermitidas.has(String(maq.id)));
        }

        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.json({ maquinas });
        }

        res.render('maquinarios/index', { title: 'Maquinários', maquinas, busca });
    } catch (error) {
        console.error("ERRO MAQUINARIOS INDEX:", error);
        if (req.xhr) return res.status(500).json({ error: 'Erro ao buscar' });
        res.redirect('/');
    }
};

exports.create = async (req, res) => {
    try {
        const tipos = await service.getAllTipos();
        res.render('maquinarios/create', { title: 'Nova Máquina', tipos, error: null, formData: {} });
    } catch (error) { res.redirect('/maquinarios'); }
};

exports.store = async (req, res) => {
    try {
        await service.createMaquina({ 
            nome: req.body.nome, 
            tipo_id: req.body.tipo_id || null 
        });
        res.redirect('/maquinarios');
    } catch (error) {
        const tipos = await service.getAllTipos();
        res.render('maquinarios/create', { 
            title: 'Nova Máquina', 
            tipos, 
            error: 'Erro ao salvar: ' + error.message, 
            formData: req.body 
        });
    }
};

exports.edit = async (req, res) => {
    try {
        const maquina = await service.getMaquinaById(req.params.id);
        const tipos = await service.getAllTipos();
        res.render('maquinarios/edit', { title: 'Editar Máquina', maquina, tipos, error: null });
    } catch (error) { res.redirect('/maquinarios'); }
};

exports.update = async (req, res) => {
    try {
        if (req.user.nivel < 3) { 
            return res.redirect('/maquinarios'); 
        }

        let updates = { 
            nome: req.body.nome, 
            tipo_id: req.body.tipo_id || null 
        };
        
        await service.updateMaquina(req.params.id, updates);
        res.redirect('/maquinarios');
    } catch (error) { 
        res.redirect(`/maquinarios/${req.params.id}/edit`); 
    }
};

exports.destroy = async (req, res) => {
    try { await service.deleteMaquina(req.params.id); res.redirect('/maquinarios'); } catch (error) { res.redirect('/maquinarios'); }
};

exports.indexTipos = async (req, res) => {
    try {
        const tipos = await service.getAllTipos();
        res.render('maquinarios/tipos', { title: 'Gerenciar Tipos', tipos, error: null });
    } catch (error) { res.redirect('/maquinarios'); }
};

exports.storeTipo = async (req, res) => {
    try {
        if (!req.body.nome) throw new Error("Nome é obrigatório");
        await service.createTipo(req.body.nome);
        res.redirect('/maquinarios/tipos');
    } catch (error) {
        const tipos = await service.getAllTipos();
        res.render('maquinarios/tipos', { title: 'Gerenciar Tipos', tipos, error: error.message });
    }
};

exports.updateTipo = async (req, res) => {
    try {
        const { id } = req.params; const { nome } = req.body;
        await service.updateTipo(id, nome);
        res.redirect('/maquinarios/tipos');
    } catch (error) { res.redirect('/maquinarios/tipos'); }
};

exports.destroyTipo = async (req, res) => {
    try { await service.deleteTipo(req.params.id); res.redirect('/maquinarios/tipos'); } catch (error) { res.redirect('/maquinarios/tipos'); }
};