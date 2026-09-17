const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Recupera as credenciais do arquivo .env
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// Verifica se as credenciais existem
if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Erro: SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórios no .env');
    process.exit(1);
}

// Inicializa o cliente Supabase
// Definimos o schema padrão como 'malharia' nas opções globais para garantir consistência,
// embora seja possível (e recomendado pelo prompt) reforçar usando .schema('malharia') nas queries.
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false // Como é um backend server-side, não persistimos sessão localstorage
    },
    db: {
        schema: 'malharia' // Define o schema padrão para conexões
    }
});

module.exports = supabase;