const supabase = require('../config/supabaseClient');

exports.getAllCortes = async () => {
    const { data, error } = await supabase
        .schema('malharia')
        .from('cortes')
        .select(`
            *,
            processo:processo_id(numero_processo, orgao, processo_item(*)),
            item:item_id(nome)
        `)
        .order('data_corte', { ascending: false });

    if (error) throw error;
    return data || [];
};

exports.createCorte = async (dados) => {
    const { data, error } = await supabase.schema('malharia').from('cortes').insert([dados]).select().single();
    if (error) throw error;
    return data;
};

exports.updateCorte = async (id, dados) => {
    const { data, error } = await supabase.schema('malharia').from('cortes').update(dados).eq('id', id).select().single();
    if (error) throw error;
    return data;
};

exports.deleteCorte = async (id) => {
    const { data: corte, error: findError } = await supabase.schema('malharia').from('cortes').select('*').eq('id', id).single();
    if (findError) throw findError;

    if (corte && corte.documento_comprovante) {
        try {
            const urlObj = new URL(corte.documento_comprovante);
            const pathParts = urlObj.pathname.split('/comprovantes-cortes/');
            if(pathParts.length > 1) {
                const filePath = decodeURIComponent(pathParts[1]);
                await supabase.storage.from('comprovantes-cortes').remove([filePath]);
            }
        } catch (e) { console.error("Aviso: Falha ao deletar arquivo do storage", e); }
    }

    const { error } = await supabase.schema('malharia').from('cortes').delete().eq('id', id);
    if (error) throw error;
    return true;
};