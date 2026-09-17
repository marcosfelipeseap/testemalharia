const supabase = require('../config/supabaseClient');
const bcrypt = require('bcryptjs');

exports.register = async (nome, email, username, senha) => {
    // Verifica se username já existe
    const { data: existente } = await supabase.schema('malharia')
        .from('usuarios')
        .select('id')
        .eq('username', username)
        .single();

    if (existente) return { error: 'Nome de utilizador já está em uso.' };

    // Verifica se o e-mail já existe
    const { data: emailExistente } = await supabase.schema('malharia')
        .from('usuarios')
        .select('id')
        .eq('email', email)
        .single();

    if (emailExistente) return { error: 'Este e-mail já está registado.' };

    const salt = await bcrypt.genSalt(10);
    const hashSenha = await bcrypt.hash(senha, salt);

    const { data, error } = await supabase.schema('malharia')
        .from('usuarios')
        .insert([{
            nome,
            email,
            username,
            senha: hashSenha,
            status: 'pendente' // Aguardando aprovação
        }])
        .select()
        .single();

    return { user: data, error: error?.message };
};

exports.authenticate = async (username, senha) => {
    const { data: user, error } = await supabase.schema('malharia')
        .from('usuarios')
        .select('*')
        .eq('username', username)
        .single();

    if (error || !user) return { error: 'Utilizador não encontrado.' };
    if (user.status !== 'aprovado') return { error: 'A sua conta ainda não foi aprovada por um Gestor ou Admin.' };

    const isMatch = await bcrypt.compare(senha, user.senha);
    if (!isMatch) return { error: 'Senha incorreta.' };

    return { user };
};

// Funções para a recuperação de senha
exports.findByEmail = async (email) => {
    const { data: user, error } = await supabase.schema('malharia')
        .from('usuarios')
        .select('*')
        .eq('email', email)
        .single();
    
    if (error || !user) return { error: 'Nenhuma conta encontrada com este e-mail.' };
    return { user };
};

exports.updatePassword = async (userId, novaSenha) => {
    const salt = await bcrypt.genSalt(10);
    const hashSenha = await bcrypt.hash(novaSenha, salt);

    const { error } = await supabase.schema('malharia')
        .from('usuarios')
        .update({ senha: hashSenha })
        .eq('id', userId);

    if (error) return { error: 'Erro ao atualizar a senha na base de dados.' };
    return { success: true };
};