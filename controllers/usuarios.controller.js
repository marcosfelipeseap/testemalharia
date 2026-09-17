const supabase = require('../config/supabaseClient');
const bcrypt = require('bcryptjs');

// ==========================================
// ROTAS DO PERFIL (Para todos os logados)
// ==========================================

exports.getPerfil = async (req, res) => {
    try {
        const { data: perfilDb, error } = await supabase.schema('malharia')
            .from('usuarios')
            .select('*')
            .eq('id', req.user.id)
            .single();

        if (error) throw error;

        res.render('usuarios/perfil', { perfil: perfilDb, error: null, success: null });
    } catch (err) {
        console.error("Erro ao carregar perfil:", err);
        res.render('usuarios/perfil', { perfil: req.user, error: 'Erro ao carregar os dados do banco.', success: null });
    }
};

exports.updatePerfil = async (req, res) => {
    try {
        const { data: perfilAtual } = await supabase.schema('malharia')
            .from('usuarios')
            .select('*')
            .eq('id', req.user.id)
            .single();

        const { nome, username, email, telefone, senha_atual, nova_senha, confirmar_senha, avatar } = req.body;
        const updates = { nome, username, email, telefone };

        if (avatar) {
            if (avatar === 'remove') {
                updates.avatar = null;
            } else if (avatar.trim() !== '') {
                updates.avatar = avatar;
            }
        }

        if (nova_senha && nova_senha.trim() !== '') {
            if (nova_senha !== confirmar_senha) {
                return res.render('usuarios/perfil', { perfil: perfilAtual, error: 'A nova senha e a confirmação não coincidem.', success: null });
            }
            if (!senha_atual) {
                return res.render('usuarios/perfil', { perfil: perfilAtual, error: 'Para alterar a senha, deve informar a sua senha atual.', success: null });
            }
            const validPassword = await bcrypt.compare(senha_atual, perfilAtual.senha);
            if (!validPassword) {
                return res.render('usuarios/perfil', { perfil: perfilAtual, error: 'A senha atual informada está incorreta.', success: null });
            }

            const salt = await bcrypt.genSalt(10);
            updates.senha = await bcrypt.hash(nova_senha, salt);
        }

        const { error } = await supabase.schema('malharia')
            .from('usuarios')
            .update(updates)
            .eq('id', req.user.id);

        if (error) throw error;

        req.user.nome = nome;
        req.user.username = username;

        const { data: perfilNovo } = await supabase.schema('malharia')
            .from('usuarios')
            .select('*')
            .eq('id', req.user.id)
            .single();

        res.render('usuarios/perfil', { perfil: perfilNovo, error: null, success: 'Perfil atualizado com sucesso!' });
    } catch (err) {
        console.error(err);
        res.render('usuarios/perfil', { perfil: req.user, error: 'Erro ao atualizar o perfil. A foto pode ser muito grande.', success: null });
    }
};

// ==========================================
// ROTAS DE GESTÃO (Apenas Gestor e Admin)
// ==========================================

// Função auxiliar para evitar repetição no backend
const getNivelByCargo = (cargo) => {
    const cargosNiveis = { 'monitor': 1, 'controlador': 1, 'coordenador': 2, 'gestor': 3, 'admin': 4 };
    return cargosNiveis[cargo] || 0;
};

exports.index = async (req, res) => {
    try {
        const { data: usuarios, error: errUser } = await supabase.schema('malharia')
            .from('usuarios')
            .select('*')
            .order('criado_em', { ascending: false });
        if (errUser) throw errUser;

        const { data: malharias, error: errMal } = await supabase.schema('malharia')
            .from('malharia')
            .select('id, nome');
        if (errMal) throw errMal;

        const { data: vinculos, error: errVinc } = await supabase.schema('malharia')
            .from('usuario_malharia')
            .select('usuario_id, malharia_id');
        if (errVinc) throw errVinc;

        const usuariosMapeados = usuarios.map(usuario => {
            if (usuario.cargo === 'monitor') {
                const vinculosDoUsuario = vinculos.filter(v => v.usuario_id === usuario.id);
                usuario.malharias_permitidas = vinculosDoUsuario.map(v => v.malharia_id);
            }
            return usuario;
        });

        res.render('usuarios/index', { usuarios: usuariosMapeados, malharias });
    } catch (error) {
        console.error("Erro ao listar usuários:", error);
        res.redirect('/');
    }
};

exports.edit = async (req, res) => {
    try {
        const { id } = req.params;
        const { data: usuario } = await supabase.schema('malharia').from('usuarios').select('*').eq('id', id).single();
        
        // Bloqueio Backend: Impede que alguém digite a URL e tente editar outro usuário do mesmo nível ou superior
        if (!usuario) return res.redirect('/usuarios');
        const nivelAlvo = getNivelByCargo(usuario.cargo);
        if (req.user.id !== usuario.id && req.user.nivel !== 4 && req.user.nivel <= nivelAlvo) {
            return res.redirect('/usuarios');
        }

        const { data: malharias } = await supabase.schema('malharia').from('malharia').select('id, nome');
        const { data: vinculos } = await supabase.schema('malharia').from('usuario_malharia').select('malharia_id').eq('usuario_id', id);
        const malhariasVinculadas = vinculos ? vinculos.map(v => v.malharia_id) : [];

        res.render('usuarios/edit', { usuario, malharias, malhariasVinculadas });
    } catch (err) {
        console.error("Erro interno ao carregar tela de edição:", err);
        res.redirect('/usuarios');
    }
};

exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { cargo, status, malharias } = req.body; 
        
        // Proteção contra elevação de privilégio: Impede que um gestor transforme alguém em admin, por exemplo.
        if (req.user.nivel !== 4 && getNivelByCargo(cargo) >= req.user.nivel) {
            return res.redirect('/usuarios');
        }

        const { error } = await supabase.schema('malharia')
            .from('usuarios')
            .update({ cargo, status })
            .eq('id', id);

        if (error) {
            console.error("❌ Erro do Supabase ao salvar cargo:", error.message);
            return res.status(400).send(`Erro ao salvar no banco de dados: ${error.message}. Verifique as restrições da coluna 'cargo' no Supabase.`);
        }

        if (cargo === 'monitor') {
            await supabase.schema('malharia').from('usuario_malharia').delete().eq('usuario_id', id);
            if (malharias) {
                const idsMalharias = Array.isArray(malharias) ? malharias : [malharias];
                const inserts = idsMalharias.map(m_id => ({ usuario_id: id, malharia_id: parseInt(m_id) }));
                await supabase.schema('malharia').from('usuario_malharia').insert(inserts);
            }
        } else {
            await supabase.schema('malharia').from('usuario_malharia').delete().eq('usuario_id', id);
        }
        
        res.redirect('/usuarios');
        
    } catch (err) {
        console.error("Erro interno ao atualizar usuário:", err);
        res.redirect('/usuarios');
    }
};

exports.delete = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Bloqueio base: Ninguém pode excluir a si mesmo
        if (req.user.id === id) {
            return res.redirect('/usuarios');
        }

        const { data: usuarioAlvo } = await supabase.schema('malharia').from('usuarios').select('cargo').eq('id', id).single();
        if (!usuarioAlvo) return res.redirect('/usuarios');

        // Bloqueio Backend: Impede exclusão de usuários do mesmo nível ou superior (exceto admin)
        const nivelAlvo = getNivelByCargo(usuarioAlvo.cargo);
        if (req.user.nivel !== 4 && req.user.nivel <= nivelAlvo) {
            return res.redirect('/usuarios');
        }

        await supabase.schema('malharia').from('usuarios').delete().eq('id', id);
        res.redirect('/usuarios');
    } catch (err) {
        console.error("Erro interno ao excluir usuário:", err);
        res.redirect('/usuarios');
    }
};