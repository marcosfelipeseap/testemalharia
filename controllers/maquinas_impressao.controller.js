const maquinasService = require('../services/maquinas_impressao.service');
const malhariasService = require('../services/malharias.service');

exports.index = async (req, res) => {
    try {
        const maquinas = await maquinasService.getAll();
        const malharias = await malhariasService.getAllMalharias();
        
        res.render('maquinas_impressao/index', {
            title: 'Máquinas de Impressão',
            maquinas,
            malharias,
            user: req.user // <- CORREÇÃO AQUI
        });
    } catch (error) {
        console.error("Erro ao listar máquinas:", error);
        res.redirect('/');
    }
};

exports.store = async (req, res) => {
    try {
        const { nome, malharia_id } = req.body;
        await maquinasService.create({ nome, malharia_id });
        res.redirect('/maquinas-impressao');
    } catch (error) {
        console.error("Erro ao criar máquina:", error);
        res.redirect('/maquinas-impressao');
    }
};

exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, malharia_id } = req.body;
        await maquinasService.update(id, { nome, malharia_id });
        res.redirect('/maquinas-impressao');
    } catch (error) {
        console.error("Erro ao atualizar máquina:", error);
        res.redirect('/maquinas-impressao');
    }
};

exports.destroy = async (req, res) => {
    try {
        await maquinasService.delete(req.params.id);
        res.redirect('/maquinas-impressao');
    } catch (error) {
        console.error("Erro ao deletar máquina:", error);
        res.redirect('/maquinas-impressao');
    }
};