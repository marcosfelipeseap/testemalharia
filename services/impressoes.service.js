const supabase = require('../config/supabaseClient');

const TABLE_DIARIAS = 'impressoes_diarias';
const TABLE_ITENS = 'impressoes_itens';

exports.getImpressoesByData = async (dataBusca) => {
    const { data, error } = await supabase.schema('malharia')
        .from(TABLE_DIARIAS)
        .select(`
            *,
            maquina:maquina_id (id, nome),
            usuario:criado_por (nome),
            itens:impressoes_itens (*)
        `)
        .eq('data_registro', dataBusca)
        .order('criado_em', { ascending: false });

    if (error) throw error;
    return data;
};

exports.getImpressaoById = async (id) => {
    const { data, error } = await supabase.schema('malharia')
        .from(TABLE_DIARIAS)
        .select(`
            *,
            maquina:maquina_id (id, nome, malharia:malharia_id(nome)),
            itens:impressoes_itens (*)
        `)
        .eq('id', id)
        .single();
        
    if (error) throw error;
    return data;
};

exports.getResumoImpressoes = async () => {
    const { data, error } = await supabase.schema('malharia')
        .from(TABLE_DIARIAS)
        .select('data_registro, maquina_id')
        .order('data_registro', { ascending: false });
    
    if (error) throw error;
    return data;
};

exports.createImpressaoComItens = async (dadosImpressao, itens) => {
    const { data: impressao, error: errImp } = await supabase.schema('malharia')
        .from(TABLE_DIARIAS)
        .insert([dadosImpressao])
        .select()
        .single();
    
    if (errImp) throw errImp;

    if (itens && itens.length > 0) {
        const itensParaSalvar = itens.map(item => ({
            ...item,
            impressao_id: impressao.id
        }));
        
        const { error: errItens } = await supabase.schema('malharia')
            .from(TABLE_ITENS)
            .insert(itensParaSalvar);
            
        if (errItens) throw errItens;
    }
    
    return impressao;
};

exports.updateImpressaoComItens = async (id, dadosImpressao, itens) => {
    // 1. Atualiza o registro pai
    const { error: errImp } = await supabase.schema('malharia')
        .from(TABLE_DIARIAS)
        .update(dadosImpressao)
        .eq('id', id);
    if (errImp) throw errImp;

    // 2. Apaga todos os itens antigos
    const { error: errDel } = await supabase.schema('malharia')
        .from(TABLE_ITENS)
        .delete()
        .eq('impressao_id', id);
    if (errDel) throw errDel;

    // 3. Insere os itens novos/atualizados
    if (itens && itens.length > 0) {
        const itensParaSalvar = itens.map(item => ({
            ...item,
            impressao_id: id
        }));
        
        const { error: errItens } = await supabase.schema('malharia')
            .from(TABLE_ITENS)
            .insert(itensParaSalvar);
            
        if (errItens) throw errItens;
    }
    
    return true;
};

exports.deleteImpressao = async (id) => {
    const { error } = await supabase.schema('malharia')
        .from(TABLE_DIARIAS)
        .delete()
        .eq('id', id);
        
    if (error) throw error;
    return true;
};