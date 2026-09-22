const registrosService = require('../services/registros.service');
const malhariasService = require('../services/malharias.service');
const processosService = require('../services/processos.service');
const rankingService = require('../services/ranking.service'); 

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
        const mesAtual = hojeObj.getMonth() + 1;
        const anoAtual = hojeObj.getFullYear();
        
        const formatData = (d) => {
            const mes = String(d.getMonth() + 1).padStart(2, '0');
            const dia = String(d.getDate()).padStart(2, '0');
            return `${d.getFullYear()}-${mes}-${dia}`;
        };

        let [registros, feriadosRaw, malhariasRaw, processosRaw, itensDisponiveis, rankingRaw] = await Promise.all([
            registrosService.getRegistrosFiltrados(null, formatData(hojeObj)), 
            registrosService.getFeriados(),                                    
            malhariasService.getAllMalharias(),                                
            processosService.getAllProcessos(),                                
            processosService.getAllItensDisponiveis(),                         
            rankingService.getRankingPerformance(mesAtual, anoAtual)           
        ]);
        
        registros = removerDuplicatasRegistros(registros);

        const itensMap = {};
        if (itensDisponiveis && Array.isArray(itensDisponiveis)) {
            itensDisponiveis.forEach(it => { itensMap[it.id] = it.nome; });
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
            
            let numMaquinas = reg.malharia_id && malhariasMap[reg.malharia_id] !== undefined ? malhariasMap[reg.malharia_id] : 'Não informado';
            
            const baseData = { data: dataFormatada, oficina: oficinaNome, metaOficina: reg.meta_calculada || 0, justificativa: reg.justificativa ? reg.justificativa.nome : '', observacao: reg.observacao || '', maquinas: numMaquinas, internos: reg.qtd_internos || 0, internosVinc: reg.qtd_internos || 0, dateObj: dataObj };

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

                    const numeroProcessoLimpo = it.processo && it.processo.numero_processo ? it.processo.numero_processo.replace(/\./g, '') : '';
                    const nomeDoProcesso = it.processo && it.processo.orgao ? it.processo.orgao : (numeroProcessoLimpo || 'Diversos');
                    const procId = it.processo_id || (it.processo ? it.processo.id : nomeDoProcesso);
                    const itemNome = it.item ? it.item.nome : (itensMap[it.item_id] || 'Desconhecido');
                    const qtd = reg.qtd_produzida_ajustada || it.qtd_produzida || 0;

                    if (it.processo) {
                        if (!demandasMap[procId]) demandasMap[procId] = { id: procId, orgao: nomeDoProcesso, numero: it.processo.numero_processo || '', itensMap: {} };
                        let itemKey = `${itemNome}|${tipoItem}|${tamanhoItem}`;
                        if (!demandasMap[procId].itensMap[itemKey]) demandasMap[procId].itensMap[itemKey] = { nome: itemNome, descricao: tipoItem, tamanho: tamanhoItem };
                    }

                    const assinatura = `${dataFormatada}|${oficinaNome}|${itemNome}|${tamanhoItem}|${tipoItem}|${nomeDoProcesso}|${qtd}`;
                    if (!assinaturasGlobais.has(assinatura)) {
                        assinaturasGlobais.add(assinatura);
                        rawData.push({ ...baseData, producaoDia: qtd, item: itemNome, tamanho: tamanhoItem, tipo: tipoItem || '-', processoNome: nomeDoProcesso, processoId: procId });
                    }
                });
            } else {
                const assinaturaVazia = `${dataFormatada}|${oficinaNome}|Nenhum|SemProducao`;
                if (!assinaturasGlobais.has(assinaturaVazia)) {
                    assinaturasGlobais.add(assinaturaVazia);
                    rawData.push({ ...baseData, producaoDia: 0, item: 'Nenhum', tamanho: '', tipo: '-', processoNome: '-', processoId: null });
                }
            }
        });

        const feriados = feriadosRaw.map(f => ({ data: f.data_feriado.split('-').reverse().join('/'), descricao: f.descricao, oficina: f.malharia ? f.malharia.nome : 'Todas' }));

        const demandasFormatadas = Object.values(demandasMap).map(d => ({ id: d.id, orgao: d.orgao, numero: d.numero, itens: Object.values(d.itensMap) }));

        const formatDateBR = (dateStr) => {
            if (!dateStr) return '-';
            try {
                let clean = dateStr.toString().split('T')[0];
                let parts = clean.split('-');
                if (parts.length === 3) { return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`; }
                if (clean.includes('/')) {
                    let p2 = clean.split('/');
                    if (p2.length === 3) {
                        if (p2[2].length === 4) return `${p2[0].padStart(2, '0')}/${p2[1].padStart(2, '0')}/${p2[2]}`;
                        if (p2[0].length === 4) return `${p2[2].padStart(2, '0')}/${p2[1].padStart(2, '0')}/${p2[0]}`;
                    }
                }
                return dateStr;
            } catch(e) { return dateStr; }
        };

        const processosMapeados = [];
        const cronogramaDataMap = {};

        (processosRaw || []).forEach(p => {
            const produtosBasicosSet = new Set(); 
            const itensFormatados = (p.itens || []).map(i => {
                const nomeItem = itensMap[i.item_id] || (i.item ? i.item.nome : 'Item');
                produtosBasicosSet.add(nomeItem); 

                const descItem = i.descricao ? ` (${i.descricao})` : '';
                const tamItem = (i.tamanho && i.tamanho !== '-') ? ` [Tam: ${i.tamanho}]` : '';
                const strPrazo = formatDateBR(i.data_prazo);
                const qtdSol = i.qtd_solicitada || 0;
                const qtdEnt = i.qtd_entregue || 0;
                const qtdFaltante = i.qtd_faltante || 0;
                const statusItem = p.status || 'Entrega não iniciada';

                if (strPrazo !== '-' && strPrazo) {
                    const chCrono = `${p.id}_${strPrazo}`;
                    if (!cronogramaDataMap[chCrono]) {
                        cronogramaDataMap[chCrono] = { nProcesso: p.numero_processo || 'S/N', orgao: p.orgao || 'Sem Órgão', prazo: strPrazo, items: [], totalPendente: 0 };
                    }
                    cronogramaDataMap[chCrono].items.push({ produto: `${nomeItem}${descItem}`, tamanho: i.tamanho || 'Único', status: statusItem, obs: p.observacao || '', qtdPendente: qtdFaltante });
                    cronogramaDataMap[chCrono].totalPendente += qtdFaltante;
                }

                return { produto: `${nomeItem}${descItem}${tamItem}`, dataEntrada: formatDateBR(p.data_entrada), qtdSolicitada: qtdSol, qtdAutorizada: i.qtd_autorizada || 0, qtdEntregue: qtdEnt, qtdFaltante: qtdFaltante, prazo: strPrazo, situacao: p.situacao || 'Pendente', status: statusItem, obs: p.observacao || '-' };
            });

            processosMapeados.push({ nProcesso: p.numero_processo || '', tipoDemanda: p.tipo_demanda || 'Geral', orgao: p.orgao || 'Órgão não especificado', produtosBasicos: [...produtosBasicosSet], status: p.status || 'Entrega não iniciada', situacao: p.situacao || 'Pendente', linkSei: p.link_sei || '', obs: p.observacao || '', qtdAutorizada: p.totais ? p.totais.autorizado : 0, qtdEntregue: p.totais ? p.totais.entregue : 0, qtdFaltante: p.totais ? p.totais.faltante : 0, itens: itensFormatados });
        });

        // ENVIO DA VARIÁVEL USER PARA O EJS
        res.render('dashboard/index', {
            layout: 'layouts/public',
            title: 'Painel Público - Produção',
            rawDataJSON: JSON.stringify(rawData),
            feriadosJSON: JSON.stringify(feriados),
            demandasJSON: JSON.stringify(demandasFormatadas),
            processosJSON: JSON.stringify(processosMapeados),
            scheduleJSON: JSON.stringify(Object.values(cronogramaDataMap)),
            rankingJSON: JSON.stringify(rankingRaw), 
            infoOficinasEstaticoJSON: JSON.stringify(infoOficinasEstatico),
            user: req.user || res.locals.user || null // <--- ESTA É A LINHA MÁGICA QUE FALTAVA!
        });

    } catch (error) {
        console.error("Erro ao carregar o dashboard público:", error);
        res.status(500).send("Erro no servidor ao montar o painel público. Consulte os logs.");
    }
};