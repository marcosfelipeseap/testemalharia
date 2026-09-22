const jwt = require('jsonwebtoken');
const supabase = require('../config/supabaseClient');

const roleLevels = {
    'monitor': 1,
    'controlador': 1, // <--- NOVO CARGO: Nível 1, mas isolado
    'coordenador': 2,
    'gestor': 3,
    'admin': 4
};

exports.requireAuth = async (req, res, next) => {
    const token = req.cookies.access_token;

    if (!token) return res.redirect('/auth/login');

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Busca o usuário no schema malharia (INCLUINDO O AVATAR)
        const { data: user, error } = await supabase.schema('malharia')
            .from('usuarios')
            .select('id, nome, username, cargo, status, avatar') 
            .eq('id', decoded.id)
            .single();

        if (error || !user || user.status !== 'aprovado') {
            res.clearCookie('access_token');
            return res.redirect('/auth/login?error=Conta inativa ou pendente de aprovação.');
        }

        req.user = user;
        req.user.nivel = roleLevels[user.cargo] || 0;

        // Se for monitor, precisamos carregar quais malharias ele tem acesso
        if (user.cargo === 'monitor') {
            const { data: vinculos } = await supabase.schema('malharia')
                .from('usuario_malharia')
                .select('malharia_id')
                .eq('usuario_id', user.id);
            req.user.malharias_permitidas = vinculos ? vinculos.map(v => v.malharia_id) : [];
        }

        // Disponibiliza as informações para todas as views EJS
        res.locals.user = req.user;
        next();
    } catch (err) {
        res.clearCookie('access_token');
        res.redirect('/auth/login');
    }
};

exports.requireRole = (minRole) => {
    return (req, res, next) => {
        if (!req.user) return res.redirect('/auth/login');
        
        const minLevel = roleLevels[minRole];
        if (req.user.nivel < minLevel) {
            return res.redirect('/'); 
        }
        next();
    };
};

// ====================================================
// NOVOS MIDDLEWARES DE ISOLAMENTO DE AMBIENTE
// ====================================================

exports.requireMalhariaAccess = (req, res, next) => {
    if (!req.user) return res.redirect('/auth/login');
    
    // O Controlador SÓ tem acesso aos insumos, barramos ele aqui
    if (req.user.cargo === 'controlador') {
        return res.redirect('/insumos');
    }
    next();
};

exports.requireInsumosAccess = (req, res, next) => {
    if (!req.user) return res.redirect('/auth/login');
    
    // O Monitor SÓ tem acesso a malharia, barramos ele aqui
    if (req.user.cargo === 'monitor') {
        return res.redirect('/');
    }
    next();
};

// ====================================================
// MIDDLEWARE PASSIVO PARA LER A SESSÃO (USADO NO PAINEL PÚBLICO)
// ====================================================
exports.checkUserPassive = async (req, res, next) => {
    const token = req.cookies.access_token;

    // Se não tiver token, deixa seguir viagem na mesma (não expulsa!)
    if (!token) {
        res.locals.user = null;
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Lê os dados do utilizador do Supabase
        const { data: user, error } = await supabase.schema('malharia')
            .from('usuarios')
            .select('id, nome, username, cargo, status, avatar') 
            .eq('id', decoded.id)
            .single();

        // Se encontrou o utilizador e a conta é válida, injeta na sessão
        if (!error && user && user.status === 'aprovado') {
            req.user = user;
            req.user.nivel = roleLevels[user.cargo] || 0;
            res.locals.user = req.user;
        } else {
            res.locals.user = null;
            req.user = null;
        }
    } catch (err) {
        // Se o token estiver expirado, simplesmente ignora em vez de dar erro
        res.locals.user = null;
        req.user = null;
    }
    
    next();
};