const express = require('express');
const router = express.Router();
const processosController = require('../controllers/processos.controller');
const multer = require('multer');

// Configuração do Multer (Armazenamento em memória para envio ao Supabase)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// 1. Rotas de API
router.get('/api/itens', processosController.getItensApi);
// Retorna itens de um processo específico com suas imagens prontas
router.get('/api/:id/itens-com-imagens', processosController.getProcessoItensComImagensApi);

// 2. Rota Principal
router.get('/', processosController.index);

// 3. Rotas de Criação
router.get('/create', processosController.create);
router.post('/', processosController.store);

// 4. Rotas de Termos de Entrega
router.post('/:id/termos', upload.single('arquivo_pdf'), processosController.storeTermo);
router.post('/:id/termos/:termo_id/delete', processosController.destroyTermo);

// 5. Novas Rotas de Imagens (Modelos Gerais e por Produto)
router.post('/:id/imagens', upload.single('arquivo_imagem'), processosController.storeImagem);
router.post('/:id/imagens/:imagem_id/delete', processosController.destroyImagem);

// Rota para Imagem Específica do Item/Produto
router.post('/:id/itens/:item_id/imagens', upload.single('arquivo_imagem'), processosController.storeItemImagem);

// 6. Rotas Parametrizadas
router.get('/:id', processosController.show);
router.get('/:id/edit', processosController.edit);
router.post('/:id/update', processosController.update); // <- Corrigido aqui para processosController
router.post('/:id/delete', processosController.destroy);

module.exports = router;