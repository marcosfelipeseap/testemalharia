const supabase = require('../config/supabaseClient');
const TABLE_NAME = 'maquinas_impressao';

exports.getAll = async () => {
    const { data, error } = await supabase.schema('malharia')
        .from(TABLE_NAME)
        .select('*, malharia:malharia_id(nome)')
        .order('nome');
    if (error) throw error;
    return data;
};

exports.create = async (dados) => {
    const { data, error } = await supabase.schema('malharia')
        .from(TABLE_NAME)
        .insert([dados])
        .select()
        .single();
    if (error) throw error;
    return data;
};

exports.update = async (id, dados) => {
    const { data, error } = await supabase.schema('malharia')
        .from(TABLE_NAME)
        .update(dados)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
};

exports.delete = async (id) => {
    const { error } = await supabase.schema('malharia')
        .from(TABLE_NAME)
        .delete()
        .eq('id', id);
    if (error) throw error;
    return true;
};