const supabase = require('../config/supabaseClient');

const TABLE = 'malharia';
const TABLE_ITEMS = 'malharia_item';

exports.getAllMalharias = async () => {
    // ALTERAÇÃO AQUI: Mudamos unidade:unidade_id ( nome, cidade ) para ( * )
    // Assim temos acesso ao endereço, telefone, lat, lon da unidade na tela de malharias
    const { data, error } = await supabase
        .schema('malharia')
        .from(TABLE)
        .select(`
            *,
            unidade:unidade_id ( * ),
            itens:malharia_item ( id ) 
        `)
        .order('nome', { ascending: true });

    if (error) throw error;
    return data;
};

// ... O resto do arquivo continua igual ...
exports.getMalhariaById = async (id) => {
    const { data, error } = await supabase
        .schema('malharia')
        .from(TABLE)
        .select(`
            *,
            itens:malharia_item (
                *,
                maquinario:maquinario_id ( 
                    nome,
                    tipo:tipo_id ( nome ) 
                )
            )
        `)
        .eq('id', id)
        .single();

    if (error) throw error;
    return data;
};

exports.createMalharia = async (dadosMalharia, listaItens) => {
    const { data: malharia, error: errMalharia } = await supabase
        .schema('malharia')
        .from(TABLE)
        .insert([dadosMalharia])
        .select()
        .single();

    if (errMalharia) throw errMalharia;

    if (listaItens && listaItens.length > 0) {
        const itensParaSalvar = listaItens.map(item => ({
            malharia_id: malharia.id,
            maquinario_id: item.maquinario_id,
            modelo: item.modelo,
            numero_serie: item.numero_serie,
            status: item.status || 'disponivel'
        }));

        const { error: errItens } = await supabase
            .schema('malharia')
            .from(TABLE_ITEMS)
            .insert(itensParaSalvar);
            
        if (errItens) throw errItens;
    }
    return malharia;
};

exports.updateMalharia = async (id, dadosMalharia, listaItens) => {
    const { error: errUpdate } = await supabase
        .schema('malharia')
        .from(TABLE)
        .update(dadosMalharia)
        .eq('id', id);

    if (errUpdate) throw errUpdate;

    await supabase.schema('malharia').from(TABLE_ITEMS).delete().eq('malharia_id', id);

    if (listaItens && listaItens.length > 0) {
        const itensParaSalvar = listaItens.map(item => ({
            malharia_id: id,
            maquinario_id: item.maquinario_id,
            modelo: item.modelo,
            numero_serie: item.numero_serie,
            status: item.status
        }));
        const { error: errItens } = await supabase
            .schema('malharia')
            .from(TABLE_ITEMS)
            .insert(itensParaSalvar);

        if (errItens) throw errItens;
    }
    return true;
};

exports.deleteMalharia = async (id) => {
    const { error } = await supabase
        .schema('malharia')
        .from(TABLE)
        .delete()
        .eq('id', id);
    if (error) throw error;
    return true;
};