const supabase = require('../config/supabaseClient');

exports.getItensComGrupos = async () => {
    const { data, error } = await supabase.schema('malharia')
        .from('tb_itens')
        .select(`
            id, nome, estoque_minimo,
            grupos:tb_grupos(id, nome, estoque_atual)
        `)
        .order('nome');
    if (error) throw error;
    
    if (data) {
        data.forEach(item => {
            if (item.grupos) {
                item.grupos.sort((a, b) => a.nome.localeCompare(b.nome));
            }
        });
    }
    return data;
};

exports.createItem = async (dados) => {
    const { error } = await supabase.schema('malharia').from('tb_itens').insert([dados]);
    if (error) throw error;
    return true;
};

exports.updateItem = async (id, dados) => {
    const { error } = await supabase.schema('malharia').from('tb_itens').update(dados).eq('id', id);
    if (error) throw error;
    return true;
};

exports.deleteItem = async (id) => {
    const { error } = await supabase.schema('malharia').from('tb_itens').delete().eq('id', id);
    if (error) throw error;
    return true;
};

exports.createGrupo = async (dados) => {
    const { error } = await supabase.schema('malharia').from('tb_grupos').insert([dados]);
    if (error) throw error;
    return true;
};

exports.updateGrupo = async (id, dados) => {
    const { error } = await supabase.schema('malharia').from('tb_grupos').update(dados).eq('id', id);
    if (error) throw error;
    return true;
};

exports.deleteGrupo = async (id) => {
    const { error } = await supabase.schema('malharia').from('tb_grupos').delete().eq('id', id);
    if (error) throw error;
    return true;
};

exports.getMovimentacoes = async () => {
    const { data, error } = await supabase.schema('malharia')
        .from('tb_movimentacoes')
        .select(`
            *,
            usuario:criado_por(nome),
            grupo:grupo_id(nome, item:item_id(nome))
        `)
        .order('data_movimentacao', { ascending: false })
        .order('criado_em', { ascending: false });
    if (error) throw error;
    return data;
};

// ATUALIZADO: Salva múltiplas entradas/usos de uma vez e ajusta o estoque
exports.createMovimentacoesEmLote = async (grupo_id, movimentacoes, usuario_id) => {
    const { data: grupo, error: errGrupo } = await supabase.schema('malharia')
        .from('tb_grupos').select('estoque_atual').eq('id', grupo_id).single();
    if (errGrupo) throw errGrupo;

    let novoEstoque = grupo.estoque_atual || 0;
    let inserts = [];

    movimentacoes.forEach(mov => {
        const qtd = parseInt(mov.quantidade) || 0;
        if (mov.tipo === 'entrada') {
            novoEstoque += qtd;
        } else if (mov.tipo === 'uso') {
            novoEstoque -= qtd;
        }
        
        inserts.push({
            grupo_id: grupo_id,
            tipo: mov.tipo,
            quantidade: qtd,
            data_movimentacao: mov.data_movimentacao,
            fornecedor: mov.tipo === 'entrada' ? mov.fornecedor : null,
            criado_por: usuario_id
        });
    });

    const { error: errUpdate } = await supabase.schema('malharia')
        .from('tb_grupos').update({ estoque_atual: novoEstoque }).eq('id', grupo_id);
    if (errUpdate) throw errUpdate;

    if (inserts.length > 0) {
        const { error: errMov } = await supabase.schema('malharia')
            .from('tb_movimentacoes').insert(inserts);
        if (errMov) throw errMov;
    }
    
    return true;
};

exports.deleteMovimentacao = async (id) => {
    const { data: mov, error: errGet } = await supabase.schema('malharia')
        .from('tb_movimentacoes').select('*').eq('id', id).single();
    if (errGet) throw errGet;

    const { data: grupo, error: errGrupo } = await supabase.schema('malharia')
        .from('tb_grupos').select('estoque_atual').eq('id', mov.grupo_id).single();
    if (errGrupo) throw errGrupo;

    let novoEstoque = grupo.estoque_atual || 0;
    if (mov.tipo === 'entrada') novoEstoque -= mov.quantidade; 
    else if (mov.tipo === 'uso') novoEstoque += mov.quantidade; 

    await supabase.schema('malharia').from('tb_grupos').update({ estoque_atual: novoEstoque }).eq('id', mov.grupo_id);
    const { error: errDel } = await supabase.schema('malharia').from('tb_movimentacoes').delete().eq('id', id);
    if (errDel) throw errDel;

    return true;
};