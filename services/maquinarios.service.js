const supabase = require('../config/supabaseClient');

// --- TIPOS DE MAQUINÁRIO ---
exports.getAllTipos = async () => {
    const { data, error } = await supabase
        .schema('malharia')
        .from('tipo_maquinario')
        .select('*')
        .order('nome');
    if (error) throw error;
    return data;
};

exports.createTipo = async (nome) => {
    const { data, error } = await supabase
        .schema('malharia')
        .from('tipo_maquinario')
        .insert([{ nome }])
        .select()
        .single();
    if (error) throw error;
    return data;
};

// [NOVO] Atualizar nome do tipo
exports.updateTipo = async (id, nome) => {
    const { error } = await supabase
        .schema('malharia')
        .from('tipo_maquinario')
        .update({ nome })
        .eq('id', id);
    if (error) throw error;
    return true;
};

exports.deleteTipo = async (id) => {
    const { error } = await supabase
        .schema('malharia')
        .from('tipo_maquinario')
        .delete()
        .eq('id', id);
    if (error) throw error;
    return true;
};

// --- MAQUINÁRIOS ---
exports.getAllMaquinas = async (busca = '') => {
    let query = supabase
        .schema('malharia')
        .from('maquinario')
        .select('*, tipo:tipo_maquinario(*)')
        .order('nome');

    if (busca) {
        query = query.ilike('nome', `%${busca}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
};

exports.getMaquinaById = async (id) => {
    const { data, error } = await supabase
        .schema('malharia')
        .from('maquinario')
        .select('*')
        .eq('id', id)
        .single();
    if (error) throw error;
    return data;
};

exports.createMaquina = async (dados) => {
    const { data, error } = await supabase
        .schema('malharia')
        .from('maquinario')
        .insert([dados]);
    if (error) throw error;
    return data;
};

exports.updateMaquina = async (id, dados) => {
    const { error } = await supabase
        .schema('malharia')
        .from('maquinario')
        .update(dados)
        .eq('id', id);
    if (error) throw error;
    return true;
};

exports.deleteMaquina = async (id) => {
    const { error } = await supabase
        .schema('malharia')
        .from('maquinario')
        .delete()
        .eq('id', id);
    if (error) throw error;
    return true;
};