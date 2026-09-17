const supabase = require('../config/supabaseClient');

const TABLE = 'unidade';

// Busca todas as unidades
exports.getAllUnidades = async () => {
    const { data, error } = await supabase
        .schema('malharia')
        .from(TABLE)
        .select('*')
        .order('nome', { ascending: true });

    if (error) throw error;
    return data;
};

// Busca unidade por ID
exports.getUnidadeById = async (id) => {
    const { data, error } = await supabase
        .schema('malharia')
        .from(TABLE)
        .select('*')
        .eq('id', id)
        .single();

    if (error) throw error;
    return data;
};

// Cria nova unidade
exports.createUnidade = async (unidadeData) => {
    const { data, error } = await supabase
        .schema('malharia')
        .from(TABLE)
        .insert([unidadeData])
        .select();

    if (error) throw error;
    return data;
};

// Atualiza unidade
exports.updateUnidade = async (id, unidadeData) => {
    const { data, error } = await supabase
        .schema('malharia')
        .from(TABLE)
        .update(unidadeData)
        .eq('id', id)
        .select();

    if (error) throw error;
    return data;
};

// Remove unidade
exports.deleteUnidade = async (id) => {
    const { error } = await supabase
        .schema('malharia')
        .from(TABLE)
        .delete()
        .eq('id', id);

    if (error) throw error;
    return true;
};