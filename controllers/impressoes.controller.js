const impressoesService = require('../services/impressoes.service');
const maquinasService = require('../services/maquinas_impressao.service');

// Lógica de Trava de Horário (Igual aos Registros Gerais)
function validarHorarioBrasilia(dataEnviada) {
    const dataAtualBr = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
    const dataHoraObj = new Date(dataAtualBr);
    
    const getBrDateString = (ms) => {
        const obj = new Date(ms);
        const ano = obj.getFullYear();
        const mes = String(obj.getMonth() + 1).padStart(2, '0');
        const dia = String(obj.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
    };
    
    const hojeMs = dataHoraObj.getTime();
    const hojeBr = getBrDateString(hojeMs);
    const ontemBr = getBrDateString(hojeMs - (24 * 60 * 60 * 1000));
    
    const horaAtual = dataHoraObj.getHours();
    const diaSemanaHoje = dataHoraObj.getDay(); 

    if (dataEnviada === hojeBr) return true;
    if (dataEnviada === ontemBr && horaAtual < 12) return true; // Domingo é validado aqui se hoje for Segunda
    
    if (diaSemanaHoje === 1 && horaAtual < 12) {
        const sextaBr = getBrDateString(hojeMs - (3 * 24 * 60 * 60 * 1000));
        const sabadoBr = getBrDateString(hojeMs - (2 * 24 * 60 * 60 * 1000));
        
        if (dataEnviada === sextaBr || dataEnviada === sabadoBr) {
            return true;
        }
    }
    return false;
}

exports.index = async (req, res) => {
    try {
        const dataBusca = req.query.data || new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }).split(',')[0].split('/').reverse().join('-');
        
        const impressoes = await impressoesService.getImpressoesByData(dataBusca);
        const todasMaquinas = await maquinasService.getAll();

        const maquinasComRegistroIds = impressoes.map(i => i.maquina_id);
        
        const maquinasPendentes = todasMaquinas.filter(m => {
            if (maquinasComRegistroIds.includes(m.id)) return false;
            const dataCriacao = m.criado_em ? m.criado_em.split('T')[0] : '2000-01-01';
            return dataCriacao <= dataBusca;
        });

        const resumoGeral = await impressoesService.getResumoImpressoes();
        const primeiraData = resumoGeral.length > 0 ? resumoGeral[0].data_registro : new Date().toISOString().split('T')[0];

        res.render('impressoes/index', { 
            title: 'Controle de Impressões', 
            impressoes, todasMaquinas, maquinasPendentes, dataBusca,
            resumoGeralJSON: JSON.stringify(resumoGeral),
            todasMaquinasJSON: JSON.stringify(todasMaquinas), 
            primeiraData, user: req.user
        });
    } catch (error) {
        console.error("Erro no index de impressões:", error);
        res.redirect('/');
    }
};

exports.create = async (req, res) => {
    try {
        const dataSelecionada = req.query.data || new Date().toISOString().split('T')[0];
        
        // Proteção GET: Bloqueia acesso ao formulário se fora do prazo
        if (req.user.nivel < 3 && !validarHorarioBrasilia(dataSelecionada)) {
            return res.redirect('/impressoes?data=' + dataSelecionada);
        }

        const maquinas = await maquinasService.getAll();
        const maquinaSelecionada = req.query.maquina || '';

        res.render('impressoes/create', { 
            title: 'Novo Apontamento de Impressão', 
            maquinas, dataSelecionada, maquinaSelecionada, user: req.user
        });
    } catch (error) {
        res.redirect('/impressoes');
    }
};

exports.store = async (req, res) => {
    try {
        const { data_registro, maquina_id, observacao, categorias, demandas, produtos, tamanhos, tipos_arquivo, modalidades, numeros_impressoes } = req.body;
        
        // Proteção POST: Bloqueia gravação no banco se burlar front-end
        if (req.user.nivel < 3 && !validarHorarioBrasilia(data_registro)) {
            return res.redirect('/impressoes?data=' + data_registro);
        }

        const dadosImpressao = { data_registro, maquina_id, observacao, criado_por: req.user.id };

        let itensProduzidos = [];
        if (categorias) {
            if (Array.isArray(categorias)) {
                for(let i=0; i < categorias.length; i++){
                    itensProduzidos.push({ 
                        categoria: categorias[i], demanda: demandas[i] ? demandas[i].trim() : '', 
                        produto: produtos[i], tamanho: tamanhos[i], tipo_arquivo: tipos_arquivo[i],
                        modalidade: modalidades[i], numero_impressoes: parseInt(numeros_impressoes[i]) 
                    });
                }
            } else {
                itensProduzidos.push({ 
                    categoria: categorias, demanda: demandas ? demandas.trim() : '', 
                    produto: produtos, tamanho: tamanhos, tipo_arquivo: tipos_arquivo, 
                    modalidade: modalidades, numero_impressoes: parseInt(numeros_impressoes) 
                });
            }
        }

        await impressoesService.createImpressaoComItens(dadosImpressao, itensProduzidos);
        res.redirect(`/impressoes?data=${data_registro}`);
    } catch (error) {
        console.error("Erro ao salvar impressão:", error);
        res.redirect('/impressoes'); 
    }
};

exports.edit = async (req, res) => {
    try {
        const impressao = await impressoesService.getImpressaoById(req.params.id);
        
        // Proteção GET: Bloqueia formulário de edição se fora do prazo
        if (req.user.nivel < 3 && !validarHorarioBrasilia(impressao.data_registro)) {
            return res.redirect('/impressoes?data=' + impressao.data_registro);
        }

        const maquinas = await maquinasService.getAll();
        res.render('impressoes/edit', { 
            title: 'Editar Apontamento de Impressão', 
            impressao, maquinas, user: req.user
        });
    } catch (error) {
        console.error(error);
        res.redirect('/impressoes');
    }
};

exports.update = async (req, res) => {
    try {
        const { data_registro, maquina_id, observacao, categorias, demandas, produtos, tamanhos, tipos_arquivo, modalidades, numeros_impressoes } = req.body;
        
        // Proteção POST: Bloqueia atualização no banco
        if (req.user.nivel < 3 && !validarHorarioBrasilia(data_registro)) {
            return res.redirect('/impressoes?data=' + data_registro);
        }

        const dadosImpressao = { data_registro, maquina_id, observacao };

        let itensProduzidos = [];
        if (categorias) {
            if (Array.isArray(categorias)) {
                for(let i=0; i < categorias.length; i++){
                    itensProduzidos.push({ 
                        categoria: categorias[i], demanda: demandas[i] ? demandas[i].trim() : '', 
                        produto: produtos[i], tamanho: tamanhos[i], tipo_arquivo: tipos_arquivo[i],
                        modalidade: modalidades[i], numero_impressoes: parseInt(numeros_impressoes[i]) 
                    });
                }
            } else {
                itensProduzidos.push({ 
                    categoria: categorias, demanda: demandas ? demandas.trim() : '', 
                    produto: produtos, tamanho: tamanhos, tipo_arquivo: tipos_arquivo, 
                    modalidade: modalidades, numero_impressoes: parseInt(numeros_impressoes) 
                });
            }
        }

        await impressoesService.updateImpressaoComItens(req.params.id, dadosImpressao, itensProduzidos);
        res.redirect(`/impressoes?data=${data_registro}`);
    } catch (error) {
        res.redirect('/impressoes'); 
    }
};

exports.destroy = async (req, res) => {
    try {
        // Deleção restrita sempre para Nível 3+
        if (req.user.nivel < 3) return res.redirect('/impressoes');
        
        await impressoesService.deleteImpressao(req.params.id);
        res.redirect('/impressoes');
    } catch (error) {
        res.redirect('/impressoes');
    }
};