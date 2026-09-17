const supabase = require('../config/supabaseClient');

const InsumosService = {
    getMalharias: async () => {
        const { data, error } = await supabase.schema('malharia').from('malharia').select('*').order('nome');
        if (error) throw error;
        return data;
    },

    // --- CATÁLOGO GLOBAL ---
    getCatalogo: async (categoria = null) => {
        let query = supabase.schema('malharia').from('catalogo_insumos').select('*').order('nome');
        if (categoria) query = query.eq('categoria', categoria);
        const { data, error } = await query;
        if (error) throw error;
        return data;
    },
    
    // NOVO: Função para checar duplicidade (ignorando maiúsculas/minúsculas e espaços)
    verificarItemCatalogoExistente: async (nome, categoria, idIgnorado = null) => {
        let query = supabase.schema('malharia').from('catalogo_insumos')
            .select('id')
            .ilike('nome', nome.trim()) // Busca ignorando case
            .eq('categoria', categoria);
            
        if (idIgnorado) {
            query = query.neq('id', idIgnorado); // Usado na edição para não conflitar com o próprio ID
        }

        const { data, error } = await query;
        if (error) throw error;
        return data.length > 0; // Retorna true se já existir
    },

    criarItemCatalogo: async (dados) => {
        const { data, error } = await supabase.schema('malharia').from('catalogo_insumos').insert([dados]).select().single();
        if (error) throw error;
        return data;
    },

    atualizarItemCatalogo: async (id, dados) => {
        const { data, error } = await supabase.schema('malharia').from('catalogo_insumos').update(dados).eq('id', id).select();
        if (error) throw error;
        return data;
    },

    excluirItemCatalogo: async (id) => {
        const { error } = await supabase.schema('malharia').from('catalogo_insumos').delete().eq('id', id);
        if (error) throw error;
        return true;
    },

    // --- ESTOQUE E MOVIMENTAÇÕES ---
    getInsumos: async (malharia_id, categoria) => {
        const { data: insumos, error } = await supabase.schema('malharia')
            .from('insumos')
            .select(`*, insumos_movimentacoes (quantidade, cor, tamanho, data_acao, responsavel)`)
            .eq('malharia_id', malharia_id).eq('categoria', categoria).order('nome');
        if (error) throw error;

        return insumos.map(insumo => {
            const variacoes = {};
            if (insumo.insumos_movimentacoes && insumo.insumos_movimentacoes.length > 0) {
                insumo.insumos_movimentacoes.sort((a, b) => new Date(b.data_acao) - new Date(a.data_acao));
                insumo.insumos_movimentacoes.forEach(mov => {
                    const cor = mov.cor ? mov.cor.trim().toUpperCase() : 'ÚNICA';
                    const tamanho = mov.tamanho ? mov.tamanho.trim().toUpperCase() : 'ÚNICO';
                    const chave = `${cor}-${tamanho}`;
                    if (!variacoes[chave]) { variacoes[chave] = { cor: mov.cor || '-', tamanho: mov.tamanho || '-', quantidade: 0, ultima_entrega: mov }; }
                    variacoes[chave].quantidade += Number(mov.quantidade);
                });
            }
            insumo.variacoes = Object.values(variacoes).filter(v => v.quantidade !== 0);
            delete insumo.insumos_movimentacoes; 
            return insumo;
        });
    },

    criarInsumo: async (dados) => {
        const { data, error } = await supabase.schema('malharia').from('insumos').insert([dados]).select().single();
        if (error) throw error;
        return data;
    },

    getInsumoDetalhes: async (insumo_id) => {
        const { data: insumo, error: err1 } = await supabase.schema('malharia').from('insumos').select('*').eq('id', insumo_id).single();
        if (err1) throw err1;

        const { data: movimentacoes, error: err2 } = await supabase.schema('malharia').from('insumos_movimentacoes').select('*').eq('insumo_id', insumo_id).order('data_acao', { ascending: false });
        if (err2) throw err2;

        const variacoes = {};
        movimentacoes.forEach(mov => {
            const cor = mov.cor ? mov.cor.trim().toUpperCase() : 'ÚNICA';
            const tamanho = mov.tamanho ? mov.tamanho.trim().toUpperCase() : 'ÚNICO';
            const chave = `${cor}-${tamanho}`;
            if (!variacoes[chave]) { 
                variacoes[chave] = { 
                    cor: mov.cor || '-', 
                    tamanho: mov.tamanho || '-', 
                    quantidade: 0,
                    ultima_entrega: mov
                }; 
            }
            variacoes[chave].quantidade += Number(mov.quantidade);
        });
        insumo.variacoes = Object.values(variacoes);

        return { insumo, movimentacoes };
    },

    adicionarMovimentacao: async (dadosMovimentacao) => {
        const { data, error } = await supabase.schema('malharia').from('insumos_movimentacoes').insert([dadosMovimentacao]).select();
        if (error) throw error;
        await InsumosService.recalcularTotal(dadosMovimentacao.insumo_id);
        return data;
    },

    uploadArquivo: async (file, folder) => {
        if (!file) return null;
        const fileName = `${folder}/${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;
        const { data, error } = await supabase.storage.from('insumos_docs').upload(fileName, file.buffer, { contentType: file.mimetype, upsert: false });
        if (error) throw error;
        const { data: publicUrl } = supabase.storage.from('insumos_docs').getPublicUrl(fileName);
        return publicUrl.publicUrl;
    },

    atualizarInsumo: async (id, dados) => {
        const { data, error } = await supabase.schema('malharia').from('insumos').update(dados).eq('id', id).select();
        if (error) throw error;
        return data;
    },

    excluirInsumo: async (id) => {
        const { error } = await supabase.schema('malharia').from('insumos').delete().eq('id', id);
        if (error) throw error;
        return true;
    },

    recalcularTotal: async (insumo_id) => {
        const { data: movs, error } = await supabase.schema('malharia').from('insumos_movimentacoes').select('quantidade').eq('insumo_id', insumo_id);
        let total = 0;
        if (movs) { total = movs.reduce((acc, curr) => acc + Number(curr.quantidade), 0); }
        await supabase.schema('malharia').from('insumos').update({ quantidade_total: total }).eq('id', insumo_id);
    },

    atualizarMovimentacao: async (id, dados, insumo_id) => {
        const { data, error } = await supabase.schema('malharia').from('insumos_movimentacoes').update(dados).eq('id', id).select();
        if (error) throw error;
        await InsumosService.recalcularTotal(insumo_id);
        return data;
    },

    excluirMovimentacao: async (id, insumo_id) => {
        const { error } = await supabase.schema('malharia').from('insumos_movimentacoes').delete().eq('id', id);
        if (error) throw error;
        await InsumosService.recalcularTotal(insumo_id);
        return true;
    }
};

module.exports = InsumosService;