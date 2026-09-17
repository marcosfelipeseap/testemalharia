const InsumosService = require('../services/insumos.service');

const InsumosController = {
    index: async (req, res) => {
        try {
            const malharias = await InsumosService.getMalharias();
            res.render('insumos/index', { title: 'Controle de Insumos', malharias });
        } catch (error) {
            console.error(error);
            res.status(500).send('Erro ao carregar dashboard de insumos.');
        }
    },

    // --- CATÁLOGO GLOBAL ---
    listarCatalogo: async (req, res) => {
        try {
            const tecido = await InsumosService.getCatalogo('tecido');
            const aviamento = await InsumosService.getCatalogo('aviamento');
            const error = req.query.error || null; // Captura erro de duplicidade se existir
            
            res.render('insumos/catalogo', { title: 'Catálogo Global de Insumos', tecido, aviamento, error });
        } catch (error) {
            console.error(error);
            res.status(500).send('Erro ao carregar catálogo.');
        }
    },

    criarItemCatalogo: async (req, res) => {
        try {
            const { nome, categoria } = req.body;
            const nomeLimpo = nome.trim();

            // Verifica duplicidade antes de inserir
            const existe = await InsumosService.verificarItemCatalogoExistente(nomeLimpo, categoria);
            if (existe) {
                return res.redirect(`/insumos/catalogo?error=${encodeURIComponent('Este item já existe no catálogo!')}`);
            }

            await InsumosService.criarItemCatalogo({ nome: nomeLimpo, categoria });
            res.redirect('/insumos/catalogo');
        } catch (error) {
            console.error(error);
            res.status(500).send('Erro ao criar item no catálogo.');
        }
    },

    editarItemCatalogo: async (req, res) => {
        try {
            const { nome, categoria } = req.body;
            const { id } = req.params;
            const nomeLimpo = nome.trim();

            // Verifica duplicidade (ignorando o próprio ID do item sendo editado)
            const existe = await InsumosService.verificarItemCatalogoExistente(nomeLimpo, categoria, id);
            if (existe) {
                return res.redirect(`/insumos/catalogo?error=${encodeURIComponent('Já existe outro item com este nome no catálogo!')}`);
            }

            await InsumosService.atualizarItemCatalogo(id, { nome: nomeLimpo, categoria });
            res.redirect('/insumos/catalogo');
        } catch (error) {
            console.error(error);
            res.status(500).send('Erro ao editar item no catálogo.');
        }
    },

    excluirItemCatalogo: async (req, res) => {
        try {
            await InsumosService.excluirItemCatalogo(req.params.id);
            res.redirect('/insumos/catalogo');
        } catch (error) {
            console.error(error);
            res.status(500).send('Erro ao excluir item do catálogo.');
        }
    },

    // --- ESTOQUE E MOVIMENTAÇÕES ---
    listarEstoque: async (req, res) => {
        try {
            const { malharia_id, categoria } = req.params;
            const insumos = await InsumosService.getInsumos(malharia_id, categoria);
            
            const catalogoCompleto = await InsumosService.getCatalogo(categoria); 
            const nomesNoEstoque = insumos.map(i => i.nome.toLowerCase().trim());
            const catalogo = catalogoCompleto.filter(c => !nomesNoEstoque.includes(c.nome.toLowerCase().trim()));

            res.render('insumos/estoque', { title: `Estoque de ${categoria}`, insumos, catalogo, malharia_id, categoria });
        } catch (error) {
            console.error("ERRO REAL AO CARREGAR ESTOQUE:", error);
            res.status(500).send('Erro ao carregar estoque. Verifique o terminal para mais detalhes.');
        }
    },

    criarProduto: async (req, res) => {
        try {
            const { malharia_id, categoria } = req.params;
            const { nome } = req.body;
            await InsumosService.criarInsumo({ malharia_id, categoria, nome });
            res.redirect(`/insumos/${malharia_id}/${categoria}`);
        } catch (error) {
            console.error(error);
            res.status(500).send('Erro ao criar produto.');
        }
    },

    detalhesProduto: async (req, res) => {
        try {
            const { malharia_id, categoria, insumo_id } = req.params;
            const { insumo, movimentacoes } = await InsumosService.getInsumoDetalhes(insumo_id);
            res.render('insumos/detalhes', { title: `Detalhes: ${insumo.nome}`, insumo, movimentacoes, malharia_id, categoria });
        } catch (error) {
            console.error(error);
            res.status(500).send('Erro ao carregar detalhes.');
        }
    },

    adicionarEntrada: async (req, res) => {
        try {
            const { malharia_id, categoria, insumo_id } = req.params;
            const dados = req.body;

            const notaFiscalFile = req.files['nota_fiscal'] ? req.files['nota_fiscal'][0] : null;
            const comprovanteFile = req.files['comprovante'] ? req.files['comprovante'][0] : null;

            const nota_fiscal_url = await InsumosService.uploadArquivo(notaFiscalFile, 'notas_fiscais');
            const comprovante_url = await InsumosService.uploadArquivo(comprovanteFile, 'comprovantes');

            await InsumosService.adicionarMovimentacao({
                insumo_id,
                quantidade: dados.quantidade,
                tipo_detalhe: dados.tipo_detalhe,
                cor: dados.cor,
                tamanho: dados.tamanho,
                observacao: dados.observacao,
                data_acao: dados.data_acao,
                responsavel: dados.responsavel,
                nota_fiscal_url,
                comprovante_url
            });

            res.redirect(`/insumos/${malharia_id}/${categoria}/${insumo_id}`);
        } catch (error) {
            console.error("ERRO AO SALVAR ENTRADA:", error);
            res.status(500).send('Erro ao registrar entrada.');
        }
    },

    editarProduto: async (req, res) => {
        try {
            const { malharia_id, categoria, insumo_id } = req.params;
            await InsumosService.atualizarInsumo(insumo_id, { nome: req.body.nome });
            res.redirect(`/insumos/${malharia_id}/${categoria}/${insumo_id}`);
        } catch (error) {
            console.error(error); res.status(500).send('Erro ao editar produto.');
        }
    },

    excluirProduto: async (req, res) => {
        try {
            const { malharia_id, categoria, insumo_id } = req.params;
            await InsumosService.excluirInsumo(insumo_id);
            res.redirect(`/insumos/${malharia_id}/${categoria}`);
        } catch (error) {
            console.error(error); res.status(500).send('Erro ao excluir produto.');
        }
    },

    editarEntrada: async (req, res) => {
        try {
            const { malharia_id, categoria, insumo_id, movimentacao_id } = req.params;
            const dados = req.body;

            const updateData = {
                quantidade: dados.quantidade, tipo_detalhe: dados.tipo_detalhe,
                cor: dados.cor, tamanho: dados.tamanho, observacao: dados.observacao,
                data_acao: dados.data_acao, responsavel: dados.responsavel
            };

            if (req.files && req.files['nota_fiscal']) {
                updateData.nota_fiscal_url = await InsumosService.uploadArquivo(req.files['nota_fiscal'][0], 'notas_fiscais');
            }
            if (req.files && req.files['comprovante']) {
                updateData.comprovante_url = await InsumosService.uploadArquivo(req.files['comprovante'][0], 'comprovantes');
            }

            await InsumosService.atualizarMovimentacao(movimentacao_id, updateData, insumo_id);
            res.redirect(`/insumos/${malharia_id}/${categoria}/${insumo_id}`);
        } catch (error) {
            console.error(error); res.status(500).send('Erro ao editar lançamento.');
        }
    },

    excluirEntrada: async (req, res) => {
        try {
            const { malharia_id, categoria, insumo_id, movimentacao_id } = req.params;
            await InsumosService.excluirMovimentacao(movimentacao_id, insumo_id);
            res.redirect(`/insumos/${malharia_id}/${categoria}/${insumo_id}`);
        } catch (error) {
            console.error(error); res.status(500).send('Erro ao excluir lançamento.');
        }
    }
};

module.exports = InsumosController;