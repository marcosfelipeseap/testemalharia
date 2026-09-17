const supabase = require('../config/supabaseClient');

exports.getMensagens = async (req, res) => {
    try {
        const isGestor = req.user.cargo === 'gestor';
        const userId = isGestor ? req.query.usuario_id : req.user.id;
        
        if (!userId) return res.json([]);

        // Monta a query filtrando as mensagens que O USUÁRIO ATUAL já apagou
        let query = supabase.schema('malharia')
            .from('suporte_mensagens')
            .select(`
                id, mensagem, created_at, remetente_id, lida,
                remetente:remetente_id(nome, cargo)
            `)
            .eq('usuario_id', userId)
            .order('created_at', { ascending: true });

        if (isGestor) {
            query = query.eq('apagado_por_gestor', false);
        } else {
            query = query.eq('apagado_por_usuario', false);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Marca como lidas apenas as que estão visíveis
        const mensagensNaoLidas = (data || []).filter(m => !m.lida && m.remetente_id !== req.user.id);
        if (mensagensNaoLidas.length > 0) {
            const idsParaLer = mensagensNaoLidas.map(m => m.id);
            await supabase.schema('malharia')
                .from('suporte_mensagens')
                .update({ lida: true })
                .in('id', idsParaLer);
        }

        res.json(data || []);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar mensagens' });
    }
};

exports.enviarMensagem = async (req, res) => {
    try {
        const { mensagem, usuario_id } = req.body;
        const chatOwnerId = req.user.cargo === 'gestor' ? usuario_id : req.user.id;

        const { error } = await supabase.schema('malharia')
            .from('suporte_mensagens')
            .insert([{
                usuario_id: chatOwnerId,
                remetente_id: req.user.id,
                mensagem,
                lida: false,
                apagado_por_gestor: false, // Ao mandar nova mensagem, volta a aparecer para ambos
                apagado_por_usuario: false
            }]);

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao enviar' });
    }
};

exports.getContatos = async (req, res) => {
    try {
        // Gestor só vê contatos que ele não apagou a conversa inteira
        const { data, error } = await supabase.schema('malharia')
            .from('suporte_mensagens')
            .select('usuario_id, lida, remetente_id, usuario:usuario_id(nome)')
            .eq('apagado_por_gestor', false) 
            .order('created_at', { ascending: false });
            
        if (error) throw error;

        const contatosMap = new Map();
        
        for (const msg of (data || [])) {
            if (msg.usuario) {
                if (!contatosMap.has(msg.usuario_id)) {
                    contatosMap.set(msg.usuario_id, {
                        id: msg.usuario_id,
                        nome: msg.usuario.nome,
                        pendente: false
                    });
                }
                if (!msg.lida && msg.remetente_id !== req.user.id) {
                    contatosMap.get(msg.usuario_id).pendente = true;
                }
            }
        }
        
        const contatos = Array.from(contatosMap.values());
        res.json(contatos);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar contatos' });
    }
};

exports.checkNotificacoes = async (req, res) => {
    try {
        const isGestor = req.user.cargo === 'gestor';
        
        let query = supabase.schema('malharia')
            .from('suporte_mensagens')
            .select('id', { count: 'exact' })
            .eq('lida', false)
            .neq('remetente_id', req.user.id);
        
        if (isGestor) {
            query = query.eq('apagado_por_gestor', false);
        } else {
            query = query.eq('usuario_id', req.user.id).eq('apagado_por_usuario', false);
        }

        const { count, error } = await query;
        if (error) throw error;
        
        res.json({ temNova: count > 0 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ temNova: false });
    }
};

// Modificado de DELETE para UPDATE (Soft Delete)
exports.encerrarChat = async (req, res) => {
    try {
        const isGestor = req.user.cargo === 'gestor';
        const userId = isGestor ? req.body.usuario_id : req.user.id;
        
        if (!userId) return res.status(400).json({ error: 'Usuário não informado' });

        const columnToUpdate = isGestor ? 'apagado_por_gestor' : 'apagado_por_usuario';

        const { error } = await supabase.schema('malharia')
            .from('suporte_mensagens')
            .update({ [columnToUpdate]: true })
            .eq('usuario_id', userId);

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao limpar chat' });
    }
};