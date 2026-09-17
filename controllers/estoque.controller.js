const registrosService = require('../services/registros.service');
const malhariasService = require('../services/malharias.service');
const transferenciasService = require('../services/transferencias.service');
const processosService = require('../services/processos.service');
const supabase = require('../config/supabaseClient'); 

exports.index = async (req, res) => {
    try {
        let malharias = await malhariasService.getAllMalharias();
        
        if (req.user.cargo === 'monitor') {
            const permitidas = (req.user.malharias_permitidas || []).map(String);
            malharias = malharias.filter(m => permitidas.includes(String(m.id)));
        }

        const todosRegistros = await registrosService.getAllRegistros();
        let todasTransferencias = await transferenciasService.getAllTransferencias();
        
        let estoque = {};
        let transferenciasPendentes = []; 
        let minhasPendencias = []; 
        let meuHistorico = [];

        const sedeId = 'sede-central-estoque';
        estoque[sedeId] = { 
            id: sedeId, nome: 'MALHARIA SEDE', tipo: 'Centro de Distribuição', processos: {}, total_geral: 0, isSede: true 
        };

        malharias.forEach(m => {
            estoque[m.id] = { id: m.id, nome: m.nome, tipo: m.tipo, processos: {}, total_geral: 0, isSede: false };
        });

        // AGRUPANDO O ESTOQUE PELO ID ÚNICO DA LINHA DO PROCESSO (TAMANHO EXATO)
        todosRegistros.forEach(reg => {
            const malhariaId = reg.malharia_id;
            const malhariaPermitida = req.user.cargo === 'monitor' ? (req.user.malharias_permitidas || []).map(String).includes(String(malhariaId)) : true;

            if (malhariaPermitida && estoque[malhariaId] && reg.itens && reg.itens.length > 0) {
                reg.itens.forEach(item => {
                    const qtdProduzida = parseInt(item.qtd_produzida, 10) || 0;

                    if (qtdProduzida > 0 && item.processo) {
                        const procId = String(item.processo_id);
                        const itemId = String(item.item_id);
                        const procItemId = item.processo_item_id ? String(item.processo_item_id) : itemId; 

                        let desc = item.descricao || (item.item ? item.item.descricao : '');
                        let tam = item.tamanho || (item.item ? item.item.tamanho : '');
                        let nomeItem = item.item ? item.item.nome : 'Desconhecido';

                        estoque[malhariaId].total_geral += qtdProduzida;

                        if (!estoque[malhariaId].processos[procId]) {
                            estoque[malhariaId].processos[procId] = { id: procId, numero_processo: item.processo.numero_processo, orgao: item.processo.orgao, itens: {} };
                        }

                        if (!estoque[malhariaId].processos[procId].itens[procItemId]) {
                            estoque[malhariaId].processos[procId].itens[procItemId] = {
                                item_id: itemId, 
                                processo_item_id_real: item.processo_item_id || null,
                                nome: nomeItem, descricao: desc, tamanho: tam, total_produzido: 0, em_transito: 0, entregue: 0
                            };
                        }
                        estoque[malhariaId].processos[procId].itens[procItemId].total_produzido += qtdProduzida;
                    }
                });
            }
        });

        todasTransferencias.sort((a, b) => new Date(a.data_transferencia) - new Date(b.data_transferencia));

        todasTransferencias.forEach(transf => {
            const malhariaId = transf.malharia_origem_id ? String(transf.malharia_origem_id) : sedeId;
            const procId = String(transf.processo_id);
            const itemId = String(transf.item_id);
            const procItemId = transf.processo_item_id ? String(transf.processo_item_id) : itemId;
            
            const qtd = parseInt(transf.quantidade, 10) || 0;
            const qtdSolicitada = parseInt(transf.quantidade_solicitada, 10) || qtd;
            const tipoDestino = transf.tipo_destino || 'sede';

            const permitidas = req.user.cargo === 'monitor' ? (req.user.malharias_permitidas || []).map(String) : [];
            const pertenceAoUsuario = req.user.cargo === 'monitor' ? (malhariaId === sedeId ? false : permitidas.includes(malhariaId)) : true;
            
            transf.nome_origem = malhariaId === sedeId ? 'MALHARIA SEDE' : (malharias.find(m => String(m.id) === String(malhariaId))?.nome || 'Oficina Desconhecida');

            transf.tamanho_exato = transf.item?.tamanho || '-';
            if (transf.processo_item_id && transf.processo && transf.processo.processo_item) {
                const pi = transf.processo.processo_item.find(p => String(p.id) === String(transf.processo_item_id));
                if (pi && pi.tamanho) transf.tamanho_exato = pi.tamanho;
            }

            if (transf.status === 'pendente') {
                transferenciasPendentes.push(transf); 
                if (req.user.nivel < 3 && pertenceAoUsuario) {
                    minhasPendencias.push(transf);
                }
            } else if ((transf.status === 'aprovada' || transf.status === 'rejeitada') && req.user.nivel < 3 && pertenceAoUsuario && !transf.arquivado) {
                const seteDiasAtras = new Date();
                seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
                const dataAv = transf.data_avaliacao ? new Date(transf.data_avaliacao) : new Date(transf.data_transferencia);
                
                if (dataAv >= seteDiasAtras) {
                    transf.timestamp_ordenacao = dataAv.getTime();
                    meuHistorico.push(transf);
                }
            }

            if (transf.status === 'rejeitada') return;

            const qtdAbaterOrigem = transf.status === 'pendente' ? qtdSolicitada : qtd;

            if (estoque[malhariaId] && estoque[malhariaId].processos[procId] && estoque[malhariaId].processos[procId].itens[procItemId]) {
                estoque[malhariaId].processos[procId].itens[procItemId].total_produzido -= qtdAbaterOrigem;
                estoque[malhariaId].total_geral -= qtdAbaterOrigem;
                
                if (estoque[malhariaId].processos[procId].itens[procItemId].total_produzido < 0) {
                    const diff = 0 - estoque[malhariaId].processos[procId].itens[procItemId].total_produzido;
                    estoque[malhariaId].processos[procId].itens[procItemId].total_produzido = 0;
                    estoque[malhariaId].total_geral += diff; 
                }
                
                if (transf.status === 'pendente') {
                    estoque[malhariaId].processos[procId].itens[procItemId].em_transito = (estoque[malhariaId].processos[procId].itens[procItemId].em_transito || 0) + qtdAbaterOrigem;
                }

                if (transf.status === 'aprovada' && tipoDestino === 'processo') {
                    estoque[malhariaId].processos[procId].itens[procItemId].entregue = (estoque[malhariaId].processos[procId].itens[procItemId].entregue || 0) + qtd;
                }
            }

            if (transf.status === 'aprovada' && tipoDestino === 'sede') {
                estoque[sedeId].total_geral += qtd;

                if (!estoque[sedeId].processos[procId]) {
                    estoque[sedeId].processos[procId] = { id: procId, numero_processo: transf.processo ? transf.processo.numero_processo : 'S/N', orgao: transf.processo ? transf.processo.orgao : 'Órgão Desconhecido', itens: {} };
                }
                if (!estoque[sedeId].processos[procId].itens[procItemId]) {
                    estoque[sedeId].processos[procId].itens[procItemId] = { 
                        item_id: itemId, 
                        processo_item_id_real: transf.processo_item_id || null,
                        nome: transf.item ? transf.item.nome : 'Item Transferido', 
                        descricao: transf.item ? transf.item.descricao : '', 
                        tamanho: transf.tamanho_exato, 
                        total_produzido: 0, em_transito: 0, entregue: 0 
                    };
                }
                estoque[sedeId].processos[procId].itens[procItemId].total_produzido += qtd;
            }
        });

        let estoqueArray = Object.values(estoque);
        estoqueArray.sort((a, b) => {
            if (a.isSede && !b.isSede) return -1;
            if (!a.isSede && b.isSede) return 1;
            return a.nome.localeCompare(b.nome);
        });

        meuHistorico.sort((a, b) => b.timestamp_ordenacao - a.timestamp_ordenacao);

        res.render('estoque/index', { 
            title: 'Estoque Consolidado', 
            estoque: estoqueArray,
            transferenciasPendentes,
            minhasPendencias,
            meuHistorico
        });
    } catch (error) {
        console.error("Erro ao carregar estoque:", error);
        res.redirect('/');
    }
};

exports.transferir = async (req, res) => {
    try {
        const { malharia_origem_id, processo_id, transferencias_json, tipo_destino } = req.body;
        
        if (!req.file) {
            console.error("Erro: Nenhum arquivo PDF foi recebido pelo Multer.");
            return res.send("<script>alert('Erro: O arquivo PDF do termo não foi recebido pelo servidor. Verifique o formulário.'); window.location.href='/estoque';</script>");
        }

        if (!malharia_origem_id || !processo_id || !transferencias_json) {
            return res.redirect('/estoque');
        }

        if (malharia_origem_id === 'sede-central-estoque' && req.user.nivel < 3) {
            return res.redirect('/estoque');
        }

        const fileExt = 'pdf';
        const fileName = `termo_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `termos/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('termos-malhariaestoque')
            .upload(filePath, req.file.buffer, {
                contentType: 'application/pdf',
                upsert: false
            });

        if (uploadError) {
            console.error("Erro do Supabase Storage:", uploadError);
            return res.send(`<script>alert('Erro ao salvar o PDF no Supabase: ${uploadError.message}. Verifique as permissões (Policies) do Bucket!'); window.location.href='/estoque';</script>`);
        }

        const { data: publicUrlData } = supabase.storage
            .from('termos-malhariaestoque')
            .getPublicUrl(filePath);

        const documentoUrl = publicUrlData.publicUrl;

        const itensTransferir = JSON.parse(transferencias_json);
        const statusDaTransferencia = req.user.nivel >= 3 ? 'aprovada' : 'pendente';
        
        const origemDb = malharia_origem_id === 'sede-central-estoque' ? null : malharia_origem_id;
        const destinoFinal = origemDb === null ? 'processo' : (tipo_destino || 'sede');

        const dadosInsert = itensTransferir.map(t => ({
            malharia_origem_id: origemDb,
            processo_id,
            processo_item_id: t.processo_item_id || null, // CORREÇÃO PARA ID
            item_id: t.item_id,
            quantidade: parseInt(t.quantidade, 10),
            quantidade_solicitada: parseInt(t.quantidade, 10),
            usuario_id: req.user.id,
            status: statusDaTransferencia,
            tipo_destino: destinoFinal,
            documento_termo: documentoUrl
        })).filter(t => t.quantidade > 0); 

        if (dadosInsert.length > 0) {
            await transferenciasService.createTransferencia(dadosInsert);
            
            if (statusDaTransferencia === 'aprovada' && destinoFinal === 'processo') {
                for (let t of dadosInsert) {
                    await processosService.registrarEntregaDeEstoque(t.processo_id, t.processo_item_id, t.item_id, t.quantidade);
                }
            }
        }
        res.redirect('/estoque');
    } catch (error) {
        console.error("Erro geral ao transferir:", error);
        return res.send(`<script>alert('Erro interno do servidor: ${error.message}'); window.location.href='/estoque';</script>`);
    }
};

exports.aprovar = async (req, res) => {
    try {
        const { id_transferencia, quantidade_aprovada } = req.body;
        
        const { data: transf } = await supabase
            .schema('malharia')
            .from('transferencias_estoque')
            .select('*')
            .eq('id', id_transferencia)
            .single();

        await transferenciasService.updateTransferencia(id_transferencia, {
            status: 'aprovada',
            quantidade: parseInt(quantidade_aprovada, 10), 
            avaliador_id: req.user.id,
            data_avaliacao: new Date()
        });
        
        if (transf && transf.tipo_destino === 'processo') {
            await processosService.registrarEntregaDeEstoque(transf.processo_id, transf.processo_item_id, transf.item_id, parseInt(quantidade_aprovada, 10));
        }

        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.json({ success: true });
        }
        res.redirect('/estoque');
    } catch (error) {
        console.error(error);
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.status(500).json({ success: false, error: 'Erro ao aprovar' });
        }
        res.redirect('/estoque');
    }
};

exports.rejeitar = async (req, res) => {
    try {
        const { id_transferencia } = req.body;
        await transferenciasService.updateTransferencia(id_transferencia, {
            status: 'rejeitada',
            avaliador_id: req.user.id,
            data_avaliacao: new Date()
        });
        
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.json({ success: true });
        }
        res.redirect('/estoque');
    } catch (error) {
        console.error(error);
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.status(500).json({ success: false, error: 'Erro ao rejeitar' });
        }
        res.redirect('/estoque');
    }
};

exports.arquivar = async (req, res) => {
    try {
        const { id_transferencia } = req.body;
        await transferenciasService.updateTransferencia(id_transferencia, { arquivado: true });
        
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.json({ success: true });
        }
        res.redirect('/estoque');
    } catch (error) {
        console.error(error);
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.status(500).json({ success: false, error: 'Erro ao arquivar' });
        }
        res.redirect('/estoque');
    }
};

exports.historico = async (req, res) => {
    try {
        const { malharia_id, data_inicio, data_fim, status, busca } = req.query;
        
        let query = supabase.schema('malharia')
            .from('transferencias_estoque')
            .select('*, processo(id, numero_processo, orgao, processo_item(*)), item(*)');

        const isMonitor = req.user.cargo === 'monitor';
        const permitidas = isMonitor ? (req.user.malharias_permitidas || []).map(String) : [];

        if (malharia_id) {
            if (isMonitor && malharia_id !== 'sede' && !permitidas.includes(String(malharia_id))) {
                return res.redirect('/estoque/historico');
            }
            if (isMonitor && malharia_id === 'sede') {
                return res.redirect('/estoque/historico');
            }

            if (malharia_id === 'sede') {
                query = query.is('malharia_origem_id', null);
            } else {
                query = query.eq('malharia_origem_id', malharia_id);
            }
        } else {
            if (isMonitor) {
                if (permitidas.length > 0) {
                    query = query.in('malharia_origem_id', permitidas);
                } else {
                    query = query.eq('malharia_origem_id', -1); 
                }
            }
        }

        if (status) query = query.eq('status', status);
        if (data_inicio) query = query.gte('data_transferencia', data_inicio + 'T00:00:00');
        if (data_fim) query = query.lte('data_transferencia', data_fim + 'T23:59:59');

        const { data: transferencias, error } = await query.order('data_transferencia', { ascending: false });
        if (error) throw error;

        let transferenciasFiltradas = transferencias || [];

        const { data: usuarios } = await supabase.schema('malharia').from('usuarios').select('id, nome');
        const mapUsuarios = {};
        if (usuarios) {
            usuarios.forEach(u => mapUsuarios[u.id] = u.nome);
        }

        const buscaSanitizada = busca ? busca.replace(/\./g, '').toLowerCase() : null;

        transferenciasFiltradas = transferenciasFiltradas.filter(t => {
            t.nome_solicitante = mapUsuarios[t.usuario_id] || 'Usuário';
            t.nome_avaliador = t.avaliador_id ? mapUsuarios[t.avaliador_id] : '';

            t.tamanho_exato = t.item?.tamanho || '-';
            if (t.processo_item_id && t.processo && t.processo.processo_item) {
                const pi = t.processo.processo_item.find(p => String(p.id) === String(t.processo_item_id));
                if (pi && pi.tamanho) t.tamanho_exato = pi.tamanho;
            }

            if (buscaSanitizada) {
                const numProc = (t.processo?.numero_processo || '').replace(/\./g, '').toLowerCase();
                const nomeSol = t.nome_solicitante.toLowerCase();
                const nomeAv = t.nome_avaliador.toLowerCase();
                const doc = (t.documento_termo || '').toLowerCase();
                
                return numProc.includes(buscaSanitizada) || 
                       nomeSol.includes(buscaSanitizada) || 
                       nomeAv.includes(buscaSanitizada) ||
                       doc.includes(buscaSanitizada);
            }
            return true;
        });

        let malharias = await malhariasService.getAllMalharias();
        
        if (isMonitor) {
            malharias = malharias.filter(m => permitidas.includes(String(m.id)));
        }

        res.render('estoque/historico', {
            title: 'Histórico de Transferências',
            transferencias: transferenciasFiltradas,
            malharias,
            filtros: req.query
        });
    } catch (error) {
        console.error("Erro ao processar histórico:", error);
        res.send(`<script>alert('Atenção, erro ao processar o banco de dados: ${error.message}'); window.location.href='/estoque';</script>`);
    }
};