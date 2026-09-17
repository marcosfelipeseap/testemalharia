const multer = require('multer');

const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // Limite de 10MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Apenas arquivos PDF são permitidos para o Termo de Entrega!'));
        }
    }
});

module.exports = upload;