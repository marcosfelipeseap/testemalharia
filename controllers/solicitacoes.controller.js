const solicitacoesService = require('../services/solicitacoes.service');
const malhariasService = require('../services/malharias.service');
const insumosService = require('../services/insumos.service');

const SolicitacoesController = {
    index: async (req, res) => {
        try {
            const { busca, status } = req.query;
            let solicitacoes = await solicitacoesService.getAllSolicitacoes();
            let malharias = await malhariasService.getAllMalharias();

            const tecido = await insumosService.getCatalogo('tecido');
            const aviamento = await insumosService.getCatalogo('aviamento');
            const catalogo = [...tecido, ...aviamento];

            const isMonitor = req.user.cargo === 'monitor' || req.user.cargo === 'coordenador';
            const permitidas = isMonitor ? (req.user.malharias_permitidas || []).map(String) : [];

            if (isMonitor) {
                solicitacoes = solicitacoes.filter(s => permitidas.includes(String(s.malharia_id)));
                malharias = malharias.filter(m => permitidas.includes(String(m.id)));
            }

            if (busca) {
                const termo = busca.toLowerCase().trim();
                solicitacoes = solicitacoes.filter(s => 
                    s.justificativa.toLowerCase().includes(termo) ||
                    (s.malharia && s.malharia.nome.toLowerCase().includes(termo)) ||
                    (s.itens_solicitados && s.itens_solicitados.join(' ').toLowerCase().includes(termo))
                );
            }

            if (status) {
                solicitacoes = solicitacoes.filter(s => s.status === status);
            }

            res.render('solicitacoes/index', { 
                title: 'Solicitações de Insumos', 
                solicitacoes, 
                malharias,
                catalogo,
                filtros: req.query,
                error: req.query.error || null,
                success: req.query.success || null
            });
        } catch (error) {
            console.error(error);
            res.status(500).send('Erro ao carregar solicitações.');
        }
    },

    criar: async (req, res) => {
        try {
            const { malharia_id, justificativa, observacao, itens_solicitados } = req.body;

            const jaExiste = await solicitacoesService.verificarPendente(malharia_id);
            if (jaExiste) {
                return res.redirect('/solicitacoes?error=' + encodeURIComponent('Esta oficina já possui uma solicitação pendente. Aguarde a resposta do gestor para solicitar novamente.'));
            }

            let itensArray = [];
            if (itens_solicitados) {
                itensArray = Array.isArray(itens_solicitados) ? itens_solicitados : [itens_solicitados];
            }

            await solicitacoesService.criarSolicitacao({
                malharia_id,
                categoria: 'misto', 
                itens_solicitados: itensArray,
                justificativa,
                observacao,
                solicitante_id: req.user.id
            });

            res.redirect('/solicitacoes?success=' + encodeURIComponent('Solicitação enviada com sucesso!'));
        } catch (error) {
            console.error(error);
            res.redirect('/solicitacoes?error=' + encodeURIComponent('Erro ao criar solicitação.'));
        }
    },

    responder: async (req, res) => {
        try {
            const { id } = req.params;
            const { status, resposta_gestor, prazo_entrega } = req.body;

            if (req.user.nivel < 3) {
                return res.redirect('/solicitacoes?error=' + encodeURIComponent('Sem permissão para responder.'));
            }

            await solicitacoesService.responderSolicitacao(id, {
                status,
                resposta_gestor,
                prazo_entrega: prazo_entrega || null,
                gestor_id: req.user.id
            });

            res.redirect('/solicitacoes?success=' + encodeURIComponent('Solicitação respondida com sucesso.'));
        } catch (error) {
            console.error(error);
            res.redirect('/solicitacoes?error=' + encodeURIComponent('Erro ao responder solicitação.'));
        }
    },

    excluir: async (req, res) => {
        try {
            // TRAVA: Apenas usuários com o cargo estrito de 'admin' podem excluir
            if (req.user.cargo !== 'admin') {
                return res.redirect('/solicitacoes?error=' + encodeURIComponent('Ação negada. Apenas o Administrador pode excluir históricos.'));
            }
            await solicitacoesService.excluirSolicitacao(req.params.id);
            res.redirect('/solicitacoes?success=' + encodeURIComponent('Solicitação excluída do histórico com sucesso.'));
        } catch (error) {
            console.error(error);
            res.redirect('/solicitacoes?error=' + encodeURIComponent('Erro ao excluir solicitação.'));
        }
    }
};

module.exports = SolicitacoesController;