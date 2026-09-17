const supabase = require('../config/supabaseClient');
const TABLE_REGISTRO = 'registro_diario';

exports.getRankingPerformance = async (mes, ano) => {
    try {
        // 1. Funções e Datas de Limite
        const getBrDateString = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };

        const dataInicioStr = `${ano}-${String(mes).padStart(2, '0')}-01`;
        const ultimoDia = new Date(ano, mes, 0).getDate();
        const dataFimStr = `${ano}-${String(mes).padStart(2, '0')}-${ultimoDia}`;

        // Até que dia podemos cobrar que o relatório tenha sido enviado? (Até ontem)
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        
        let dataLimiteCobranca = new Date(ano, mes - 1, ultimoDia); 
        if (dataLimiteCobranca >= hoje) {
            dataLimiteCobranca = new Date(hoje);
            dataLimiteCobranca.setDate(dataLimiteCobranca.getDate() - 1); 
        }

        // 2. Buscas no Banco de Dados (Corrigido para 'malharia' no singular e com select '*')
        const { data: malharias, error: errM } = await supabase.schema('malharia').from('malharia').select('*');
        const { data: feriados, error: errF } = await supabase.schema('malharia').from('feriado').select('data_feriado, malharia_id').gte('data_feriado', dataInicioStr).lte('data_feriado', dataFimStr);
        
        const { data: registros, error: errR } = await supabase
            .schema('malharia')
            .from(TABLE_REGISTRO)
            .select(`
                *,
                justificativa:justificativa_id (nome),
                itens:registro_diario_item(qtd_produzida)
            `)
            .gte('data_registro', dataInicioStr)
            .lte('data_registro', dataFimStr);

        // Se der erro no banco, loga no terminal mas não trava o sistema
        if (errM || errF || errR) {
            if (errM) console.error("Erro Tabela Malharia:", errM);
            if (errF) console.error("Erro Tabela Feriado:", errF);
            if (errR) console.error("Erro Tabela Registro:", errR);
            return []; 
        }

        // 3. Monta a estrutura base de estatísticas
        const stats = {};
        malharias.forEach(m => {
            stats[m.id] = {
                id: m.id,
                nome: m.nome,
                // Procura a data de criação independente de como a coluna se chama
                criado_em: m.criado_em || m.created_at || m.data_criacao || '2000-01-01',
                totalProduzido: 0,
                totalMeta: 0,
                diasFaltaInsumo: 0,
                diasNaoRegistrados: 0, 
                detalhes: [],
                registrosMap: {}
            };
        });

        // 4. Mapeia os registros encontrados
        registros.forEach(reg => {
            if (stats[reg.malharia_id]) {
                stats[reg.malharia_id].registrosMap[reg.data_registro] = reg;
            }
        });

        // 5. Calcula a "Média de Meta" justa para punir os dias não registrados
        Object.values(stats).forEach(s => {
            let sumMeta = 0;
            let countMeta = 0;
            Object.values(s.registrosMap).forEach(r => {
                if (r.meta_calculada && r.meta_calculada > 0) {
                    sumMeta += r.meta_calculada;
                    countMeta++;
                }
            });
            s.mediaMeta = countMeta > 0 ? Math.round(sumMeta / countMeta) : 10; // 10 é fallback de segurança
        });

        // 6. Varredura do Calendário Dia a Dia (Auditoria)
        for (let d = 1; d <= ultimoDia; d++) {
            const dataLoop = new Date(ano, mes - 1, d);
            const dataLoopStr = getBrDateString(dataLoop);
            const isFimDeSemana = dataLoop.getDay() === 0 || dataLoop.getDay() === 6;

            Object.values(stats).forEach(s => {
                // Ignora cobranças em dias antes da malharia ser criada
                if (dataLoopStr < s.criado_em) return; 

                const reg = s.registrosMap[dataLoopStr];
                const isFeriado = feriados && feriados.some(f => f.data_feriado === dataLoopStr && (f.malharia_id === null || f.malharia_id === s.id));

                if (reg) {
                    // DIA COM REGISTRO: Verifica se foi falta de insumo ou registro normal
                    const just = reg.justificativa ? reg.justificativa.nome.toLowerCase() : '';
                    const isInsumo = just.includes('insumo');
                    const produzido = reg.itens ? reg.itens.reduce((acc, curr) => acc + (curr.qtd_produzida || 0), 0) : 0;
                    const meta = reg.meta_calculada || 0;

                    s.detalhes.push({
                        data_registro: dataLoopStr,
                        meta: meta,
                        produzido: produzido,
                        justificativa: reg.justificativa ? reg.justificativa.nome : '-',
                        valido: !isInsumo,
                        isFaltaRegistro: false
                    });

                    if (isInsumo) {
                        s.diasFaltaInsumo++;
                    } else {
                        s.totalProduzido += produzido;
                        s.totalMeta += meta;
                    }
                } else {
                    // DIA SEM REGISTRO: Se for dia útil, não for feriado, e o prazo já passou -> PUNIÇÃO!
                    if (!isFimDeSemana && !isFeriado && dataLoop <= dataLimiteCobranca) {
                        s.totalMeta += s.mediaMeta; // Exige a meta média deles
                        s.diasNaoRegistrados++;     // Conta a falta

                        s.detalhes.push({
                            data_registro: dataLoopStr,
                            meta: s.mediaMeta,
                            produzido: 0,
                            justificativa: 'FALTA DE RELATÓRIO',
                            valido: true, 
                            isFaltaRegistro: true
                        });
                    }
                }
            });
        }

        // 7. Ordena os detalhes por data (do dia 31 para o dia 1)
        Object.values(stats).forEach(s => {
            s.detalhes.sort((a, b) => new Date(b.data_registro) - new Date(a.data_registro));
        });

        // 8. Gera o Ranking Final
        const ranking = Object.values(stats).map(s => {
            const performance = s.totalMeta > 0 ? (s.totalProduzido / s.totalMeta) * 100 : 0;
            return {
                ...s,
                performance: parseFloat(performance.toFixed(1))
            };
        });

        // Ordena: 1º Performance, 2º Desempate Produção
        ranking.sort((a, b) => b.performance - a.performance || b.totalProduzido - a.totalProduzido);

        return ranking;

    } catch (error) {
        console.error("Erro CRÍTICO no serviço de Ranking:", error);
        return []; // BLINDAGEM: Retorna array vazio em caso de erro para não derrubar a aplicação
    }
};