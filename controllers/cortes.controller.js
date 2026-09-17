const cortesService = require('../services/cortes.service');
const malhariasService = require('../services/malharias.service');
const processosService = require('../services/processos.service');
const itensService = require('../services/itens.service');
const supabase = require('../config/supabaseClient');

// Função paginadora para burlar o limite de 1000 linhas do Supabase
const fetchAllFromSupabase = async (table, selectQuery, inFilter = null) => {
    let allRows = [];
    let start = 0;
    const step = 999;
    
    while (true) {
        let query = supabase.schema('malharia')
            .from(table)
            .select(selectQuery)
            .order('id', { ascending: true })
            .range(start, start + step);
        
        // Aplica o filtro direto na query do Supabase para otimizar a resposta
        if (inFilter && inFilter.values.length > 0) {
            query = query.in(inFilter.column, inFilter.values);
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error(`Erro ao paginar ${table}:`, error.message);
            break;
        }
        if (!data || data.length === 0) break;
        
        allRows = allRows.concat(data);
        if (data.length <= step) break;
        
        start += step + 1;
    }
    return allRows;
};

exports.index = async (req, res) => {
    try {
        let malharias = await malhariasService.getAllMalharias();
        let permitidasFilter = null;

        // Filtra as malharias restritas caso o usuário seja apenas monitor
        if (req.user.cargo === 'monitor') {
            const permitidas = (req.user.malharias_permitidas || []).map(String);
            malharias = malharias.filter(m => permitidas.includes(String(m.id)));
            permitidasFilter = { column: 'malharia_id', values: permitidas };
        }

        const todosProcessos = await processosService.getAllProcessos();
        const processosAtivos = todosProcessos.filter(p => p.situacao !== 'Concluído' && p.situacao !== 'Finalizado' && p.status !== 'DEMANDA CONCLUÍDA');
        const todosItens = await itensService.getAllItens();
        
        // Passa o filtro de segurança para o banco trazer apenas os cortes permitidos
        const cortes = await fetchAllFromSupabase('cortes', '*, processo:processo_id(numero_processo, orgao, processo_item(*)), item:item_id(nome, meta_diaria)', permitidasFilter);
        const producao = await fetchAllFromSupabase('registro_diario_item', 'id, processo_id, processo_item_id, item_id, qtd_produzida, registro:registro_id!inner(malharia_id, data_registro)');
        
        // Busca as máquinas físicas direto na tabela malharia_item
        const maquinasDaOficina = await fetchAllFromSupabase('malharia_item', 'malharia_id, maquinario_id, status');

        cortes.forEach(c => {
            c.tamanho_exato = '-';
            c.descricao_exata = '';
            if (c.processo && c.processo.processo_item) {
                const pi = c.processo.processo_item.find(p => String(p.id) === String(c.processo_item_id));
                if (pi) {
                    if (pi.tamanho) c.tamanho_exato = pi.tamanho;
                    if (pi.descricao) c.descricao_exata = pi.descricao;
                }
            }
        });

        const malhariasData = malharias.map(m => {
            const cortesMalharia = cortes.filter(c => String(c.malharia_id) === String(m.id));
            const produtosCortes = {};

            cortesMalharia.forEach(c => {
                const itemKey = c.processo_item_id ? String(c.processo_item_id) : `legado_${c.processo_id}_${c.item_id}`; 
                
                if (!produtosCortes[itemKey]) {
                    produtosCortes[itemKey] = {
                        item_id: c.item_id,
                        processo_id: c.processo_id,
                        processo_item_id: c.processo_item_id,
                        numero_processo: c.processo?.numero_processo || 'S/N',
                        orgao: c.processo?.orgao || 'S/N',
                        nome: c.item?.nome || 'Item Desconhecido',
                        tamanho: c.tamanho_exato,
                        descricao: c.descricao_exata,
                        total_cortado: 0,
                        total_produzido: 0,
                        saldo: 0,
                        primeira_data_corte: c.data_corte ? String(c.data_corte).substring(0, 10) : '2099-12-31',
                        historico: []
                    };
                }
                produtosCortes[itemKey].total_cortado += c.quantidade;
                
                const dataAtualLoop = c.data_corte ? String(c.data_corte).substring(0, 10) : '2099-12-31';
                if (dataAtualLoop < produtosCortes[itemKey].primeira_data_corte) {
                    produtosCortes[itemKey].primeira_data_corte = dataAtualLoop;
                }

                c.numero_processo = c.processo?.numero_processo || 'S/N';
                produtosCortes[itemKey].historico.push(c);
            });

            let totalSaldoMalharia = 0;
            let somaMetasEstoque = 0;
            let produtosDetalhados = [];
            
            // Pega as máquinas físicas desta oficina que estão disponíveis
            const maquinasFisicasOficina = maquinasDaOficina.filter(maq => String(maq.malharia_id) === String(m.id) && maq.status !== 'indisponivel');
            const qtdMaquinas = maquinasFisicasOficina.length;

            Object.values(produtosCortes).forEach(prod => {
                prod.historico.sort((a, b) => new Date(b.data_corte) - new Date(a.data_corte));
                const dataCorteBaseStr = prod.primeira_data_corte;

                const consumido = producao.filter(p => {
                    if (!p.registro) return false;
                    if (String(p.registro.malharia_id) !== String(m.id)) return false;
                    
                    let isMesmoProduto = false;
                    const pPiId = String(p.processo_item_id || '').trim();
                    const prodPiId = String(prod.processo_item_id || '').trim();
                    
                    if (pPiId && pPiId !== 'undefined' && pPiId !== 'null' && prodPiId && prodPiId !== 'undefined' && prodPiId !== 'null') {
                        isMesmoProduto = (pPiId === prodPiId);
                    } else {
                        isMesmoProduto = (String(p.processo_id) === String(prod.processo_id) && String(p.item_id) === String(prod.item_id));
                    }
                    if (!isMesmoProduto) return false;
                    
                    const dataProdStr = String(p.registro.data_registro || '1970-01-01').substring(0, 10);
                    return dataProdStr >= dataCorteBaseStr; 
                }).reduce((sum, p) => sum + (parseInt(p.qtd_produzida) || 0), 0);

                prod.total_produzido = consumido;
                prod.saldo = prod.total_cortado - consumido;
                if (prod.saldo < 0) prod.saldo = 0; 
                
                totalSaldoMalharia += prod.saldo;

                if (prod.saldo > 0) {
                    const itemRef = todosItens.find(i => String(i.id) === String(prod.item_id));
                    let metaItem = 100; // Padrão se nada for encontrado
                    let atendeMaquina = false;

                    if (itemRef) {
                        metaItem = parseFloat(itemRef.meta_diaria) || 100;
                        
                        // Verifica se o produto tem máquina exigida E se a oficina a possui fisicamente
                        if (itemRef.maquinas && itemRef.maquinas.length > 0) {
                            const maquinasDoProduto = itemRef.maquinas.map(req => String(req.maquinario_id));
                            const maquinasDaOficinaIds = maquinasFisicasOficina.map(fis => String(fis.maquinario_id));
                            
                            // A oficina tem pelo menos UMA das máquinas que o produto pede?
                            atendeMaquina = maquinasDoProduto.some(reqId => maquinasDaOficinaIds.includes(reqId));
                        } else {
                            // Produto não exige máquina (feito à mão ou genérico), então oficina atende automaticamente
                            atendeMaquina = true;
                        }
                    }

                    // Se a oficina não atende o maquinário, não calculamos a meta desse produto para não inflar irrealmente
                    if (atendeMaquina) {
                        somaMetasEstoque += metaItem;
                        produtosDetalhados.push({ nome: prod.nome, tamanho: prod.tamanho, saldo: prod.saldo, meta: metaItem });
                    }
                }
            });

            // Análise de Capacidade
            const mediaMeta = produtosDetalhados.length > 0 ? (somaMetasEstoque / produtosDetalhados.length) : 100;
            const maquinasCalculo = qtdMaquinas > 0 ? qtdMaquinas : 1; 
            
            const capacidadeDiaria = maquinasCalculo * mediaMeta;
            const capacidadeSemanal = capacidadeDiaria * 5; 
            
            const percentual = capacidadeSemanal > 0 ? (totalSaldoMalharia / capacidadeSemanal) * 100 : 0;

            let statusEstoque = 'sem_estoque';
            if (totalSaldoMalharia > 0 && percentual < 30) statusEstoque = 'baixo';
            else if (totalSaldoMalharia > 0 && percentual >= 30) statusEstoque = 'saudavel';

            return {
                id: m.id, 
                nome: m.nome, 
                tipo: m.tipo,
                total_saldo: totalSaldoMalharia,
                status_estoque: statusEstoque,
                calculo: {
                    qtd_maquinas: qtdMaquinas,
                    media_meta: mediaMeta.toFixed(0),
                    capacidade_diaria: capacidadeDiaria.toFixed(0), 
                    capacidade_semanal: capacidadeSemanal.toFixed(0),
                    percentual: percentual.toFixed(1),
                    produtos: produtosDetalhados
                },
                produtos: Object.values(produtosCortes)
            };
        });

        res.render('cortes/index', {
            title: 'Controle de Cortes',
            malhariasData, 
            malharias,
            processosAtivosJSON: JSON.stringify(processosAtivos),
            todosItensJSON: JSON.stringify(todosItens)
        });
    } catch(error) {
        console.error("Erro no Controller de Cortes:", error);
        res.redirect('/');
    }
};

exports.store = async (req, res) => {
    try {
        const { malharia_id, data_corte, processos_ids, processo_item_ids, itens_ids, quantidades } = req.body;
        
        if (!req.file) return res.send("<script>alert('O comprovante em PDF é obrigatório.'); window.location.href='/cortes';</script>");
        if (!processos_ids) return res.send("<script>alert('Nenhum produto foi adicionado à lista.'); window.location.href='/cortes';</script>");

        const fileExt = 'pdf';
        const fileName = `corte_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = fileName; // Upload direto na raiz do bucket

        const { error: uploadError } = await supabase.storage.from('comprovantes-cortes').upload(filePath, req.file.buffer, { contentType: 'application/pdf', upsert: false });
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('comprovantes-cortes').getPublicUrl(filePath);
        
        const toArray = (val) => Array.isArray(val) ? val : [val];
        const pIds = toArray(processos_ids);
        const pItemIds = toArray(processo_item_ids);
        const iIds = toArray(itens_ids);
        const qtds = toArray(quantidades);

        for (let i = 0; i < pIds.length; i++) {
            if (parseInt(qtds[i]) > 0) {
                await cortesService.createCorte({
                    malharia_id, processo_id: pIds[i], processo_item_id: pItemIds[i], item_id: iIds[i],
                    quantidade: parseInt(qtds[i]), data_corte, documento_comprovante: publicUrlData.publicUrl, usuario_id: req.user.id
                });
            }
        }
        res.redirect('/cortes');
    } catch (error) {
        console.error(error); 
        res.send(`<script>alert('Erro: ${error.message}'); window.location.href='/cortes';</script>`);
    }
};

exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { quantidade, data_corte } = req.body;
        let dadosUpdate = { quantidade: parseInt(quantidade), data_corte };

        if (req.file) {
            const fileName = `corte_edit_${Date.now()}_${Math.random().toString(36).substring(7)}.pdf`;
            const filePath = fileName; // Upload direto na raiz do bucket
            const { error: uploadError } = await supabase.storage.from('comprovantes-cortes').upload(filePath, req.file.buffer, { contentType: 'application/pdf', upsert: false });
            if (uploadError) throw uploadError;
            const { data: publicUrlData } = supabase.storage.from('comprovantes-cortes').getPublicUrl(filePath);
            dadosUpdate.documento_comprovante = publicUrlData.publicUrl;
        }

        await cortesService.updateCorte(id, dadosUpdate);
        res.redirect('/cortes');
    } catch (error) {
        res.send(`<script>alert('Erro: ${error.message}'); window.location.href='/cortes';</script>`);
    }
};

exports.destroy = async (req, res) => {
    try { 
        await cortesService.deleteCorte(req.params.id); 
        res.redirect('/cortes'); 
    } catch (error) { res.redirect('/cortes'); }
};