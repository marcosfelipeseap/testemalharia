const supabase = require('../config/supabaseClient');

const TABLE_REGISTRO = 'registro_diario';
const TABLE_ITENS = 'registro_diario_item';
const TABLE_FERIADO = 'feriado'; 
const BUCKET_IMG = 'processo_imagens';

const enriquecerComUsuarios = async (dados) => {
    if (!dados) return dados;
    
    const arrayDados = Array.isArray(dados) ? dados : [dados];
    const userIds = [...new Set(arrayDados.map(r => r.criado_por).filter(id => id != null))];
    
    if (userIds.length === 0) return dados;

    const { data: users, error } = await supabase.schema('malharia')
        .from('usuarios')
        .select('id, nome')
        .in('id', userIds);

    if (error) {
        console.error("Erro ao buscar usuários:", error);
        return dados;
    }

    const userMap = {};
    users.forEach(u => userMap[u.id] = { nome: u.nome });

    const processarUsuario = (reg) => {
        reg.usuario = userMap[reg.criado_por] || { nome: 'Desconhecido' };
        return reg;
    };

    return Array.isArray(dados) ? arrayDados.map(processarUsuario) : processarUsuario(dados);
};

const enriquecerRegistros = (dados) => {
    if (!dados) return dados;
    const processarRegistro = (reg) => {
        if (reg.itens && Array.isArray(reg.itens)) {
            reg.itens = reg.itens.map(it => {
                let desc = null; let tam = null; let urlImagem = null;
                
                if (it.processo) {
                    if (it.processo.processo_item && Array.isArray(it.processo.processo_item)) {
                        const detalhe = it.processo.processo_item.find(pi => String(pi.id) === String(it.processo_item_id));
                        if (detalhe) { desc = detalhe.descricao; tam = detalhe.tamanho; }
                    }
                    
                    if (it.processo.imagens && Array.isArray(it.processo.imagens)) {
                        const imagensComUrl = it.processo.imagens.map(img => {
                            const { data: storageData } = supabase.storage.from(BUCKET_IMG).getPublicUrl(img.caminho_arquivo);
                            return { ...img, url_publica: storageData.publicUrl };
                        });
                        
                        const imgProduto = imagensComUrl.find(img => String(img.processo_item_id) === String(it.processo_item_id));
                        const imgGeral = imagensComUrl.find(img => !img.processo_item_id);
                        
                        if (imgProduto) urlImagem = imgProduto.url_publica;
                        else if (imgGeral) urlImagem = imgGeral.url_publica;
                    }
                }
                return { ...it, descricao: desc, tamanho: tam, url_imagem: urlImagem };
            });
        }
        return reg;
    };
    if (Array.isArray(dados)) return dados.map(processarRegistro);
    else return processarRegistro(dados);
};

exports.getAllRegistros = async () => {
    const { data, error } = await supabase
        .schema('malharia')
        .from(TABLE_REGISTRO)
        .select(`
            *, 
            malharia:malharia_id (nome), 
            justificativa:justificativa_id (nome), 
            itens:registro_diario_item(
                processo_id, processo_item_id, item_id, qtd_produzida, 
                processo:processo_id(id, numero_processo, orgao, processo_item(id, item_id, descricao, tamanho), imagens:processo_imagem(*)), 
                item:item_id(id, nome)
            )
        `).order('data_registro', { ascending: false });
        
    if (error) throw error; 
    let dadosComUser = await enriquecerComUsuarios(data);
    return enriquecerRegistros(dadosComUser);
};

exports.getRegistrosByData = async (dataBusca) => {
    const { data, error } = await supabase
        .schema('malharia')
        .from(TABLE_REGISTRO)
        .select(`
            *, 
            malharia:malharia_id (id, nome, tipo), 
            justificativa:justificativa_id (nome), 
            itens:registro_diario_item(
                processo_id, processo_item_id, item_id, qtd_produzida, 
                processo:processo_id(id, numero_processo, orgao, processo_item(id, item_id, descricao, tamanho), imagens:processo_imagem(*)), 
                item:item_id(id, nome)
            )
        `).eq('data_registro', dataBusca).order('criado_em', { ascending: false });
        
    if (error) throw error; 
    let dadosComUser = await enriquecerComUsuarios(data);
    return enriquecerRegistros(dadosComUser);
};

exports.getRegistroById = async (id) => {
    const { data, error } = await supabase
        .schema('malharia')
        .from(TABLE_REGISTRO)
        .select(`
            *, 
            malharia:malharia_id (nome, num_internos), 
            justificativa:justificativa_id (nome), 
            itens:registro_diario_item(
                processo_id, processo_item_id, item_id, qtd_produzida, 
                processo:processo_id(id, numero_processo, orgao, processo_item(id, item_id, descricao, tamanho), imagens:processo_imagem(*)), 
                item:item_id(id, nome)
            )
        `).eq('id', id).single();
        
    if (error) throw error; 
    let dadosComUser = await enriquecerComUsuarios(data);
    return enriquecerRegistros(dadosComUser);
};

exports.getTiposJustificativa = async () => { 
    const { data, error } = await supabase.schema('malharia').from('tipo_justificativa').select('*').order('nome'); 
    if (error) throw error; 
    return data; 
};

exports.createRegistroComItens = async (dadosRegistro, itensProduzidos) => { 
    const { data: registro, error: errReg } = await supabase.schema('malharia').from(TABLE_REGISTRO).insert([dadosRegistro]).select().single(); 
    if (errReg) throw errReg; 
    
    if (itensProduzidos && itensProduzidos.length > 0) { 
        const itensParaSalvar = itensProduzidos.map(item => ({ 
            registro_id: registro.id, 
            processo_id: item.processo_id, 
            processo_item_id: item.processo_item_id,
            item_id: item.item_id, 
            qtd_produzida: item.qtd_produzida 
        })); 
        const { error: errItens } = await supabase.schema('malharia').from(TABLE_ITENS).insert(itensParaSalvar); 
        if (errItens) throw errItens; 
    } 
    return registro; 
};

exports.deleteRegistro = async (id) => { 
    const { error } = await supabase.schema('malharia').from(TABLE_REGISTRO).delete().eq('id', id); 
    if (error) throw error; 
    return true; 
};

exports.updateRegistroComItens = async (id, dadosRegistro, itensProduzidos) => { 
    const { error: errReg } = await supabase.schema('malharia').from(TABLE_REGISTRO).update(dadosRegistro).eq('id', id); 
    if (errReg) throw errReg; 
    
    const { error: errDel } = await supabase.schema('malharia').from('registro_diario_item').delete().eq('registro_id', id); 
    if (errDel) throw errDel; 
    
    if (itensProduzidos && itensProduzidos.length > 0) { 
        const itensParaSalvar = itensProduzidos.map(item => ({ 
            registro_id: id, 
            processo_id: item.processo_id, 
            processo_item_id: item.processo_item_id,
            item_id: item.item_id, 
            qtd_produzida: item.qtd_produzida 
        })); 
        const { error: errItens } = await supabase.schema('malharia').from('registro_diario_item').insert(itensParaSalvar); 
        if (errItens) throw errItens; 
    } 
    return true; 
};

// =========================================================
// CORREÇÃO DO LIMITE DE 1000 LINHAS DO SUPABASE NO CALENDÁRIO
// =========================================================
exports.getResumoRegistros = async () => { 
    let todosRegistros = [];
    let from = 0;
    const limit = 999;
    let buscarMais = true;

    while (buscarMais) {
        const { data, error } = await supabase.schema('malharia')
            .from(TABLE_REGISTRO)
            .select('data_registro, malharia_id')
            .order('data_registro', { ascending: false })
            .range(from, from + limit); 
        
        if (error) throw error; 
        
        if (data && data.length > 0) {
            todosRegistros.push(...data);
        }
        
        // Se a busca retornar menos que o limite, significa que acabou e o laço para
        if (!data || data.length <= limit) {
            buscarMais = false;
        } else {
            from += limit + 1; // Prepara para buscar o próximo bloco de 1000
        }
    }
    return todosRegistros; 
};

exports.getFeriados = async () => { 
    const { data, error } = await supabase.schema('malharia').from(TABLE_FERIADO).select('*, malharia:malharia_id(nome)').order('data_feriado', { ascending: true }); 
    if (error) throw error; 
    return data || []; 
};

exports.createFeriado = async (dados) => { 
    const { data, error } = await supabase.schema('malharia').from(TABLE_FERIADO).insert([dados]).select().single(); 
    if (error) throw error; 
    return data; 
};

exports.deleteFeriado = async (id) => { 
    const { error } = await supabase.schema('malharia').from(TABLE_FERIADO).delete().eq('id', id); 
    if (error) throw error; 
    return true; 
};

exports.getRegistrosByMalharia = async (malhariaId) => {
    const { data, error } = await supabase
        .schema('malharia')
        .from(TABLE_REGISTRO)
        .select(`
            *, 
            malharia:malharia_id (id, nome, tipo), 
            justificativa:justificativa_id (nome), 
            itens:registro_diario_item(
                processo_id, processo_item_id, item_id, qtd_produzida, 
                processo:processo_id(id, numero_processo, orgao, processo_item(id, item_id, descricao, tamanho), imagens:processo_imagem(*)), 
                item:item_id(id, nome)
            )
        `)
        .eq('malharia_id', malhariaId)
        .order('data_registro', { ascending: false });
        
    if (error) throw error; 
    let dadosComUser = await enriquecerComUsuarios(data);
    return enriquecerRegistros(dadosComUser);
};


exports.getRegistrosFiltrados = async (dataInicio, dataFim) => {
    let query = supabase
        .schema('malharia')
        .from(TABLE_REGISTRO)
        .select(`
            *, 
            malharia:malharia_id (id, nome, tipo), 
            justificativa:justificativa_id (nome), 
            itens:registro_diario_item(
                processo_id, processo_item_id, item_id, qtd_produzida, 
                processo:processo_id(id, numero_processo, orgao, processo_item(id, item_id, descricao, tamanho), imagens:processo_imagem(*)), 
                item:item_id(id, nome)
            )
        `)
        .order('data_registro', { ascending: false });

    if (dataInicio) query = query.gte('data_registro', dataInicio);
    if (dataFim) query = query.lte('data_registro', dataFim);

    const { data, error } = await query;
    if (error) throw error; 
    let dadosComUser = await enriquecerComUsuarios(data);
    return enriquecerRegistros(dadosComUser);
};