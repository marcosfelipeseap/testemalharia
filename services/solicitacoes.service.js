const supabase = require('../config/supabaseClient');

const SolicitacoesService = {
    getAllSolicitacoes: async () => {
        const { data, error } = await supabase.schema('malharia')
            .from('solicitacoes_insumos')
            .select(`
                *,
                malharia:malharia_id (nome)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    verificarPendente: async (malharia_id) => {
        const { data, error } = await supabase.schema('malharia')
            .from('solicitacoes_insumos')
            .select('id')
            .eq('malharia_id', malharia_id)
            .eq('status', 'pendente');
        
        if (error) throw error;
        return data.length > 0;
    },

    criarSolicitacao: async (dados) => {
        const { data, error } = await supabase.schema('malharia')
            .from('solicitacoes_insumos')
            .insert([dados])
            .select();
        
        if (error) throw error;
        return data;
    },

    responderSolicitacao: async (id, dados) => {
        dados.updated_at = new Date().toISOString();
        const { data, error } = await supabase.schema('malharia')
            .from('solicitacoes_insumos')
            .update(dados)
            .eq('id', id)
            .select();
            
        if (error) throw error;
        return data;
    },

    excluirSolicitacao: async (id) => {
        const { error } = await supabase.schema('malharia')
            .from('solicitacoes_insumos')
            .delete()
            .eq('id', id);
            
        if (error) throw error;
        return true;
    }
};

module.exports = SolicitacoesService;