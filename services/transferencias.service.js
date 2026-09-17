const supabase = require('../config/supabaseClient');

exports.getAllTransferencias = async () => {
    const { data, error } = await supabase
        .schema('malharia')
        .from('transferencias_estoque')
        .select(`
            *,
            processo (id, numero_processo, orgao, processo_item(*)),
            item (*),
            solicitante:usuarios!transferencias_estoque_usuario_id_fkey(nome)
        `);
        
    if (error) {
        console.error("Erro ao buscar transferencias:", error);
        const { data: fallbackData } = await supabase
            .schema('malharia')
            .from('transferencias_estoque')
            .select('*, processo(id, numero_processo, orgao, processo_item(*)), item(*)');
        return fallbackData || [];
    }
    return data;
};

exports.createTransferencia = async (dados) => {
    const arrDados = Array.isArray(dados) ? dados : [dados];
    
    const { data, error } = await supabase
        .schema('malharia')
        .from('transferencias_estoque')
        .insert(arrDados)
        .select();
        
    if (error) throw error;
    return data;
};

exports.updateTransferencia = async (id, dados) => {
    const { data, error } = await supabase
        .schema('malharia')
        .from('transferencias_estoque')
        .update(dados)
        .eq('id', id)
        .select();
        
    if (error) throw error;
    return data;
};