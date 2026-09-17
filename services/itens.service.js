const supabase = require('../config/supabaseClient');

exports.getAllItens = async (busca = '') => {
    let query = supabase
        .schema('malharia')
        .from('item')
        .select('*, maquinas:item_maquinario(maquinario_id, maquina:maquinario(nome))')
        .order('nome');

    if (busca) {
        query = query.ilike('nome', `%${busca}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
};

exports.getItemById = async (id) => {
    const { data, error } = await supabase
        .schema('malharia')
        .from('item')
        .select('*, maquinas:item_maquinario(maquinario_id)')
        .eq('id', id)
        .single();

    if (error) throw error;
    return data;
};

// Função auxiliar para salvar vínculos (apenas IDs das máquinas)
async function salvarVinculos(itemId, maquinasIds) {
    // 1. Remove vínculos antigos
    await supabase.schema('malharia').from('item_maquinario').delete().eq('item_id', itemId);

    // Se não houver máquinas selecionadas, para por aqui
    if (!maquinasIds || maquinasIds.length === 0) return;

    // Garante que seja um array (caso venha apenas 1 checkbox marcado)
    const ids = Array.isArray(maquinasIds) ? maquinasIds : [maquinasIds];
    
    // Prepara os dados para inserção
    const insertData = ids.map(maqId => ({
        item_id: itemId,
        maquinario_id: parseInt(maqId)
    })).filter(v => v.maquinario_id); // Remove IDs inválidos

    if (insertData.length > 0) {
        const { error } = await supabase
            .schema('malharia')
            .from('item_maquinario')
            .insert(insertData);
        
        if (error) {
            console.error("Erro ao salvar vínculos:", error);
            throw new Error("Erro ao vincular máquinas: " + error.message);
        }
    }
}

exports.createItem = async (dadosItem, maquinasIds) => {
    console.log("Criando item:", dadosItem); // Log para Debug
    
    // 1. Cria o Item (Salvando nome, descricao e META DIÁRIA)
    const { data: item, error } = await supabase
        .schema('malharia')
        .from('item')
        .insert([dadosItem])
        .select()
        .single();

    if (error) throw error;

    // 2. Salva as máquinas selecionadas
    await salvarVinculos(item.id, maquinasIds);

    return item;
};

exports.updateItem = async (id, dadosItem, maquinasIds) => {
    // 1. Atualiza dados do Item
    const { error } = await supabase
        .schema('malharia')
        .from('item')
        .update(dadosItem)
        .eq('id', id);

    if (error) throw error;

    // 2. Atualiza as máquinas
    await salvarVinculos(id, maquinasIds);

    return true;
};

exports.deleteItem = async (id) => {
    const { error } = await supabase.schema('malharia').from('item').delete().eq('id', id);
    if (error) throw error;
    return true;
};