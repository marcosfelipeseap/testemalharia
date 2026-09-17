const malhariasService = require('../services/malharias.service');
const unidadesService = require('../services/unidades.service');
const maquinariosService = require('../services/maquinarios.service');
const supabase = require('../config/supabaseClient'); 

exports.index = async (req, res) => {
    try {
        let malharias = await malhariasService.getAllMalharias();

        // 1. Busca todos os monitores e vínculos (Agora trazendo também o AVATAR)
        const { data: monitores } = await supabase.schema('malharia')
            .from('usuarios')
            .select('id, nome, username, email, telefone, avatar')
            .eq('cargo', 'monitor');

        const { data: vinculos } = await supabase.schema('malharia')
            .from('usuario_malharia')
            .select('usuario_id, malharia_id');

        // 2. Anexa os monitores a cada malharia
        malharias = malharias.map(m => {
            const mId = String(m.id);
            const idsMonitores = vinculos 
                ? vinculos.filter(v => String(v.malharia_id) === mId).map(v => String(v.usuario_id)) 
                : [];

            m.monitores = monitores 
                ? monitores.filter(mon => idsMonitores.includes(String(mon.id))) 
                : [];

            return m;
        });

        if (req.user.cargo === 'monitor') {
            const permitidas = req.user.malharias_permitidas || [];
            malharias = malharias.filter(m => permitidas.includes(m.id));
        }

        // CORREÇÃO AQUI: Passando o user explicitamente para a view
        res.render('malharias/index', { title: 'Gerenciar Malharias', malharias, user: req.user });
    } catch (error) {
        console.error(error);
        // CORREÇÃO AQUI
        res.render('malharias/index', { title: 'Gerenciar Malharias', malharias: [], error: 'Erro ao listar.', user: req.user });
    }
};

exports.create = async (req, res) => {
    try {
        const unidades = await unidadesService.getAllUnidades();
        let maquinarios = [];
        try { maquinarios = await maquinariosService.getAllMaquinas(); } catch (e) { }

        // CORREÇÃO AQUI
        res.render('malharias/create', { title: 'Nova Malharia', unidades: unidades || [], maquinarios: maquinarios || [], user: req.user });
    } catch (error) {
        res.redirect('/malharias');
    }
};

exports.store = async (req, res) => {
    try {
        const { nome, unidade_id, responsavel, num_internos, num_internos_remunerados, horario_limite_planejamento, itensJSON } = req.body;

        if (parseInt(num_internos_remunerados) > parseInt(num_internos)) {
            throw new Error("O número de internos remunerados não pode ser maior que o total de internos.");
        }

        let listaItens = itensJSON ? JSON.parse(itensJSON) : [];

        await malhariasService.createMalharia({
            nome,
            unidade_id,
            responsavel,
            num_internos: parseInt(num_internos) || 0,
            num_internos_remunerados: parseInt(num_internos_remunerados) || 0,
            horario_limite_planejamento: horario_limite_planejamento || '10:00:00'
        }, listaItens);

        res.redirect('/malharias');
    } catch (error) {
        console.error(error);
        res.redirect('/malharias/create'); 
    }
};

exports.edit = async (req, res) => {
    try {
        const { id } = req.params;
        let malharia = await malhariasService.getMalhariaById(id);
        if (!malharia) return res.redirect('/malharias');

        const unidades = await unidadesService.getAllUnidades();
        let maquinarios = [];
        try { maquinarios = await maquinariosService.getAllMaquinas(); } catch(e) {}

        // CORREÇÃO AQUI
        res.render('malharias/edit', { title: 'Editar Malharia', malharia, unidades, maquinarios, user: req.user });
    } catch (error) {
        res.redirect('/malharias');
    }
};

exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, unidade_id, responsavel, num_internos, num_internos_remunerados, horario_limite_planejamento, itensJSON } = req.body;

        if (req.user.cargo === 'monitor') {
            const permitidasStr = (req.user.malharias_permitidas || []).map(String);
            if (!permitidasStr.includes(String(id))) return res.redirect('/malharias');
        }

        let listaItens = itensJSON ? JSON.parse(itensJSON) : [];

        if (req.user.nivel < 3) {
            const malhariaAtual = await malhariasService.getMalhariaById(id);
            await malhariasService.updateMalharia(id, {
                nome: malhariaAtual.nome, unidade_id: malhariaAtual.unidade_id,
                responsavel: malhariaAtual.responsavel, num_internos: malhariaAtual.num_internos,
                num_internos_remunerados: malhariaAtual.num_internos_remunerados,
                horario_limite_planejamento: malhariaAtual.horario_limite_planejamento
            }, listaItens);
        } else {
            await malhariasService.updateMalharia(id, {
                nome, unidade_id, responsavel,
                num_internos: parseInt(num_internos) || 0,
                num_internos_remunerados: parseInt(num_internos_remunerados) || 0,
                horario_limite_planejamento: horario_limite_planejamento || '10:00:00'
            }, listaItens);
        }
        res.redirect('/malharias');
    } catch (error) {
        console.error(error);
        res.redirect(`/malharias/${req.params.id}/edit`);
    }
};

exports.destroy = async (req, res) => {
    try {
        await malhariasService.deleteMalharia(req.params.id);
        res.redirect('/malharias');
    } catch (error) { res.redirect('/malharias'); }
};