const registrosService = require('../services/registros.service');
const malhariasService = require('../services/malharias.service');
const processosService = require('../services/processos.service');

function removerDuplicatasRegistros(array) {
    if (!Array.isArray(array)) return array;
    const map = new Map();
    array.forEach(item => {
        if (item && item.id) map.set(item.id, item);
    });
    return Array.from(map.values());
}

exports.diarioPublico = async (req, res) => {
    try {
        const hojeObj = new Date();
        const formatData = (d) => {
            const mes = String(d.getMonth() + 1).padStart(2, '0');
            const dia = String(d.getDate()).padStart(2, '0');
            return `${d.getFullYear()}-${mes}-${dia}`;
        };

        // Busca simultânea das bases sem interferir em nenhum service
        let [registros, feriadosRaw, malhariasRaw, processosRaw, itensDisponiveis] = await Promise.all([
            registrosService.getRegistrosFiltrados(null, formatData(hojeObj)),
            registrosService.getFeriados(),
            malhariasService.getAllMalharias(),
            processosService.getAllProcessos(),
            processosService.getAllItensDisponiveis()
        ]);
        
        registros = removerDuplicatasRegistros(registros);

        // Mapeia os nomes originais dos itens (Apenas o nome base: Camisa, Calça, etc)
        const itensMap = {};
        if (itensDisponiveis && Array.isArray(itensDisponiveis)) {
            itensDisponiveis.forEach(it => {
                itensMap[it.id] = it.nome;
            });
        }

        const malhariasMap = {};
        const infoOficinasEstatico = [];
        
        if (malhariasRaw && Array.isArray(malhariasRaw)) {
            malhariasRaw.forEach(m => {
                malhariasMap[m.id] = (m.itens && Array.isArray(m.itens)) ? m.itens.length : 0;
                infoOficinasEstatico.push({
                    nome: m.nome,
                    remunerados: m.remunerados || 0
                });
            });
        }

        let rawData = [];
        const assinaturasGlobais = new Set();
        const demandasMap = {};
        
        registros.forEach(reg => {
            const dataFormatada = reg.data_registro.split('-').reverse().join('/');
            const dataObj = new Date(reg.data_registro + 'T00:00:00'); 
            const oficinaNome = reg.malharia ? reg.malharia.nome : 'Desconhecida';
            
            let numMaquinas = reg.malharia_id && malhariasMap[reg.malharia_id] !== undefined
                ? malhariasMap[reg.malharia_id] 
                : 'Não informado';
            
            const baseData = {
                data: dataFormatada,
                oficina: oficinaNome,
                metaOficina: reg.meta_calculada || 0,
                justificativa: reg.justificativa ? reg.justificativa.nome : '',
                observacao: reg.observacao || '',
                maquinas: numMaquinas, 
                internos: reg.qtd_internos || 0,
                internosVinc: reg.qtd_internos || 0,
                dateObj: dataObj
            };

            if (reg.itens && reg.itens.length > 0) {
                reg.itens.forEach(it => {
                    let tamanhoItem = it.tamanho || '';
                    let tipoItem = it.descricao || '';
                    
                    if (it.processo && Array.isArray(it.processo.processo_item)) {
                        const pItem = it.processo.processo_item.find(pi => String(pi.id) === String(it.processo_item_id)) || it.processo.processo_item[0];
                        if (pItem) {
                            if (!tamanhoItem) tamanhoItem = pItem.tamanho || '';
                            if (!tipoItem) tipoItem = pItem.descricao || '';
                        }
                    } else if (it.processo && it.processo.processo_item) {
                        if (!tamanhoItem) tamanhoItem = it.processo.processo_item.tamanho || '';
                        if (!tipoItem) tipoItem = it.processo.processo_item.descricao || '';
                    }

                    const numeroProcessoLimpo = it.processo && it.processo.numero_processo 
                        ? it.processo.numero_processo.replace(/\./g, '') 
                        : '';
                        
                    const nomeDoProcesso = it.processo && it.processo.orgao 
                        ? it.processo.orgao 
                        : (numeroProcessoLimpo || 'Diversos');

                    const procId = it.processo_id || (it.processo ? it.processo.id : nomeDoProcesso);
                    const itemNome = it.item ? it.item.nome : (itensMap[it.item_id] || 'Desconhecido');
                    const qtd = reg.qtd_produzida_ajustada || it.qtd_produzida || 0;

                    if (it.processo) {
                        if (!demandasMap[procId]) {
                            demandasMap[procId] = {
                                id: procId,
                                orgao: nomeDoProcesso,
                                numero: it.processo.numero_processo || '',
                                itensMap: {}
                            };
                        }
                        let itemKey = `${itemNome}|${tipoItem}|${tamanhoItem}`;
                        if (!demandasMap[procId].itensMap[itemKey]) {
                            demandasMap[procId].itensMap[itemKey] = {
                                nome: itemNome,
                                descricao: tipoItem,
                                tamanho: tamanhoItem
                            };
                        }
                    }

                    const assinatura = `${dataFormatada}|${oficinaNome}|${itemNome}|${tamanhoItem}|${tipoItem}|${nomeDoProcesso}|${qtd}`;
                    
                    if (!assinaturasGlobais.has(assinatura)) {
                        assinaturasGlobais.add(assinatura);
                        
                        rawData.push({
                            ...baseData,
                            producaoDia: qtd,
                            item: itemNome,
                            tamanho: tamanhoItem,
                            tipo: tipoItem || '-',
                            processoNome: nomeDoProcesso,
                            processoId: procId
                        });
                    }
                });
            } else {
                const assinaturaVazia = `${dataFormatada}|${oficinaNome}|Nenhum|SemProducao`;
                if (!assinaturasGlobais.has(assinaturaVazia)) {
                    assinaturasGlobais.add(assinaturaVazia);
                    rawData.push({
                        ...baseData,
                        producaoDia: 0,
                        item: 'Nenhum',
                        tamanho: '',
                        tipo: '-',
                        processoNome: '-',
                        processoId: null
                    });
                }
            }
        });

        const feriados = feriadosRaw.map(f => ({
            data: f.data_feriado.split('-').reverse().join('/'),
            descricao: f.descricao,
            oficina: f.malharia ? f.malharia.nome : 'Todas'
        }));

        const demandasFormatadas = Object.values(demandasMap).map(d => ({
            id: d.id,
            orgao: d.orgao,
            numero: d.numero,
            itens: Object.values(d.itensMap)
        }));

        // Formatador Blindado para as Datas (Remove T00:00:00.000Z para evitar bugs de fuso horário)
        const formatDateBR = (dateStr) => {
            if (!dateStr) return '-';
            try {
                let clean = dateStr.toString().split('T')[0];
                let parts = clean.split('-');
                if (parts.length === 3) {
                    return `${parts[2]}/${parts[1]}/${parts[0]}`;
                }
                return dateStr;
            } catch(e) {
                return dateStr;
            }
        };

        const processosMapeados = (processosRaw || []).map(p => {
            const produtosBasicosSet = new Set(); // Mapeia apenas os nomes limpos

            const itensFormatados = (p.itens || []).map(i => {
                const nomeItem = itensMap[i.item_id] || (i.item ? i.item.nome : 'Item');
                produtosBasicosSet.add(nomeItem); // Salva o nome puro para o filtro (ex: Camisa)

                const descItem = i.descricao ? ` (${i.descricao})` : '';
                const tamItem = (i.tamanho && i.tamanho !== '-') ? ` [Tam: ${i.tamanho}]` : '';

                return {
                    produto: `${nomeItem}${descItem}${tamItem}`,
                    dataEntrada: formatDateBR(p.data_entrada),
                    qtdSolicitada: i.qtd_solicitada || 0,
                    qtdAutorizada: i.qtd_autorizada || 0,
                    qtdEntregue: i.qtd_entregue || 0,
                    qtdFaltante: i.qtd_faltante || 0,
                    prazo: formatDateBR(i.data_prazo),
                    situacao: p.situacao || 'Pendente',
                    status: p.status || 'Entrega não iniciada',
                    obs: p.observacao || '-'
                };
            });

            return {
                nProcesso: p.numero_processo || '',
                tipoDemanda: p.tipo_demanda || 'Geral',
                orgao: p.orgao || 'Órgão não especificado',
                produtosBasicos: [...produtosBasicosSet], // Envia o array de nomes limpos para o filtro Front-End!
                status: p.status || 'Entrega não iniciada',
                situacao: p.situacao || 'Pendente',
                linkSei: p.link_sei || '',
                obs: p.observacao || '',
                qtdAutorizada: p.totais ? p.totais.autorizado : 0,
                qtdEntregue: p.totais ? p.totais.entregue : 0,
                qtdFaltante: p.totais ? p.totais.faltante : 0,
                itens: itensFormatados
            };
        });

        res.render('dashboard/index', {
            layout: 'layouts/public',
            title: 'Painel Público - Produção',
            rawDataJSON: JSON.stringify(rawData),
            feriadosJSON: JSON.stringify(feriados),
            demandasJSON: JSON.stringify(demandasFormatadas),
            processosJSON: JSON.stringify(processosMapeados),
            infoOficinasEstaticoJSON: JSON.stringify(infoOficinasEstatico)
        });
    } catch (error) {
        console.error("Erro ao carregar o dashboard público:", error);
        res.status(500).send("Erro no servidor ao montar o painel.");
    }
};