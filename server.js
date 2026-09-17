// Carrega as variáveis de ambiente do arquivo .env
require('dotenv').config();

// Importa a aplicação Express configurada
const app = require('./app');

// Define a porta do servidor (padrão 3000 se não definida no .env)
const PORT = process.env.PORT || 3000;

// Inicia o servidor escutando na porta definida
app.listen(PORT, () => {
  console.log(`--------------------------------------------------`);
  console.log(`🚀 Servidor rodando com sucesso!`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`👉 Acesso local: http://localhost:${PORT}`);
  console.log(`--------------------------------------------------`);
});