const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requireAuth, requireInsumosAccess } = require('../middlewares/auth.middleware');
const InsumosController = require('../controllers/insumos.controller');

const upload = multer({ storage: multer.memoryStorage() });

router.use(requireAuth, requireInsumosAccess);

router.get('/', InsumosController.index);

// --- ROTAS DO CATÁLOGO GLOBAL ---
router.get('/catalogo', InsumosController.listarCatalogo);
router.post('/catalogo/novo', InsumosController.criarItemCatalogo);
router.post('/catalogo/:id/editar', InsumosController.editarItemCatalogo);
router.post('/catalogo/:id/excluir', InsumosController.excluirItemCatalogo);

// --- ROTAS DE ESTOQUE ---
router.get('/:malharia_id/:categoria', InsumosController.listarEstoque);
router.post('/:malharia_id/:categoria/novo', InsumosController.criarProduto);

router.get('/:malharia_id/:categoria/:insumo_id', InsumosController.detalhesProduto);
router.post('/:malharia_id/:categoria/:insumo_id/movimentar', 
    upload.fields([
        { name: 'nota_fiscal', maxCount: 1 }, 
        { name: 'comprovante', maxCount: 1 }
    ]), 
    InsumosController.adicionarEntrada
);

// --- ROTAS DE EDIÇÃO E EXCLUSÃO ---
router.post('/:malharia_id/:categoria/:insumo_id/editar', InsumosController.editarProduto);
router.post('/:malharia_id/:categoria/:insumo_id/excluir', InsumosController.excluirProduto);

router.post('/:malharia_id/:categoria/:insumo_id/movimentacao/:movimentacao_id/editar', 
    upload.fields([{ name: 'nota_fiscal', maxCount: 1 }, { name: 'comprovante', maxCount: 1 }]), 
    InsumosController.editarEntrada
);
router.post('/:malharia_id/:categoria/:insumo_id/movimentacao/:movimentacao_id/excluir', InsumosController.excluirEntrada);

module.exports = router;