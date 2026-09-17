const userService = require('../services/user.service');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');

// Inicializa a API do Resend usando a chave do ficheiro .env
const resend = new Resend(process.env.RESEND_API_KEY);

exports.getLoginPage = (req, res) => {
    // Se já estiver logado, não deixa acessar a tela de login e manda para a área restrita
    if (req.cookies.access_token) {
        // Se houver cargo salvo no token, pode direcionar corretamente. 
        // Como fallback seguro, envia para /registros
        return res.redirect('/registros');
    }
    res.render('auth/login', { 
        layout: false, 
        error: req.query.error || null,
        success: req.query.success || null 
    });
};

exports.getRegisterPage = (req, res) => {
    if (req.cookies.access_token) return res.redirect('/registros');
    res.render('auth/register', { 
        layout: false, 
        error: null 
    });
};

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const { user, error } = await userService.authenticate(username, password);

        if (error) {
            return res.render('auth/login', { layout: false, error, success: null });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, cargo: user.cargo }, 
            process.env.JWT_SECRET, 
            { expiresIn: '12h' }
        );

        res.cookie('access_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 12 * 60 * 60 * 1000 // 12 horas
        });

        // CORREÇÃO: Direciona o usuário para a área interna correta com base no cargo
        if (user.cargo === 'controlador') {
            res.redirect('/insumos');
        } else {
            res.redirect('/registros');
        }

    } catch (err) {
        console.error('Erro no login:', err);
        res.render('auth/login', { layout: false, error: 'Erro interno.', success: null });
    }
};

exports.register = async (req, res) => {
    try {
        const { nome, email, username, password } = req.body;

        const usernameRegex = /^[a-zA-Z0-9_]+$/;
        if (!usernameRegex.test(username)) {
            return res.render('auth/register', { layout: false, error: 'Utilizador inválido. Use apenas letras, números e underline.' });
        }

        const { error } = await userService.register(nome, email, username, password);

        if (error) {
            return res.render('auth/register', { layout: false, error });
        }

        res.render('auth/login', { 
            layout: false, 
            success: 'Registo realizado! Aguarde que um Gestor ou Administrador aprove e defina o seu cargo para aceder ao sistema.',
            error: null
        });
    } catch (err) {
        console.error('Erro ao registar:', err);
        res.render('auth/register', { layout: false, error: 'Erro ao registar.' });
    }
};

exports.logout = (req, res) => {
    res.clearCookie('access_token');
    // CORREÇÃO: Direciona para o painel público ao deslogar
    res.redirect('/'); 
};

// --- NOVAS FUNÇÕES DE RECUPERAÇÃO DE SENHA ---

exports.getForgotPasswordPage = (req, res) => {
    res.render('auth/forgot-password', { layout: false, error: null, success: null });
};

exports.processForgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const { user, error } = await userService.findByEmail(email);

        if (error) {
            return res.render('auth/forgot-password', { layout: false, error, success: null });
        }

        // Gera token válido por 30 minutos
        const resetToken = jwt.sign(
            { id: user.id }, 
            process.env.JWT_SECRET, 
            { expiresIn: '30m' }
        );

        const resetLink = `${process.env.FRONTEND_URL}/auth/reset-password?token=${resetToken}`;

        // Envio do e-mail usando a API do Resend com o domínio verificado
        await resend.emails.send({
            from: 'Sistema Malharia <nao-responda@malhariaseap.com>', 
            to: user.email,
            subject: 'Recuperação de Senha - Sistema Malharia',
            html: `
                <h3>Olá, ${user.nome}!</h3>
                <p>Recebemos um pedido para redefinir a sua senha.</p>
                <p>Clique no link abaixo para criar uma nova senha:</p>
                <a href="${resetLink}" style="padding: 10px 15px; background: #0d6efd; color: white; text-decoration: none; border-radius: 5px;">Redefinir Minha Senha</a>
                <p><br>Este link expira em 30 minutos. Se não pediu a redefinição, ignore este e-mail.</p>
            `
        });

        res.render('auth/forgot-password', { layout: false, error: null, success: 'Se o e-mail existir no sistema, receberá um link de recuperação em breve!' });
    } catch (err) {
        console.error('Erro ao processar esqueci a senha:', err);
        res.render('auth/forgot-password', { layout: false, error: 'Erro interno ao tentar enviar o e-mail.', success: null });
    }
};

exports.getResetPasswordPage = (req, res) => {
    const { token } = req.query;
    if (!token) {
        return res.redirect('/auth/login?error=Token de recuperação inválido ou ausente.');
    }
    res.render('auth/reset-password', { layout: false, token, error: null });
};

exports.processResetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;

        // Verifica a validade do token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.render('auth/reset-password', { layout: false, token, error: 'O link expirou ou é inválido. Solicite novamente.' });
        }

        // Atualiza a senha
        const { error } = await userService.updatePassword(decoded.id, password);

        if (error) {
            return res.render('auth/reset-password', { layout: false, token, error });
        }

        res.redirect('/auth/login?success=Senha alterada com sucesso! Já pode iniciar sessão.');

    } catch (err) {
        console.error('Erro ao redefinir a senha:', err);
        res.render('auth/reset-password', { layout: false, token: req.body.token, error: 'Erro interno ao redefinir a senha.' });
    }
};