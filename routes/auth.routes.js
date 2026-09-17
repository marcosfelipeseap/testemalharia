const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Rotas normais de autenticação
router.get('/login', authController.getLoginPage);
router.post('/login', authController.login);

router.get('/register', authController.getRegisterPage);
router.post('/register', authController.register);

router.get('/logout', authController.logout);

// Novas rotas de recuperação de senha (Resend)
router.get('/forgot-password', authController.getForgotPasswordPage);
router.post('/forgot-password', authController.processForgotPassword);

router.get('/reset-password', authController.getResetPasswordPage);
router.post('/reset-password', authController.processResetPassword);

module.exports = router;