const unidadesService = require('../services/unidades.service');

// Função auxiliar: Busca coordenadas APENAS pelo CEP
async function buscarCoordenadasPorCEP(cep) {
    if (!cep) return { lat: null, lon: null };

    try {
        const cepLimpo = cep.replace(/\D/g, '');
        // Busca no Nominatim (OpenStreetMap)
        const url = `https://nominatim.openstreetmap.org/search?postalcode=${cepLimpo}&country=Brazil&format=json&limit=1`;
        
        const response = await fetch(url, {
            headers: { 'User-Agent': 'SistemaMalharia/1.0' }
        });
        
        const data = await response.json();
        
        if (data && data.length > 0) {
            return { lat: data[0].lat, lon: data[0].lon };
        }
    } catch (error) {
        console.error('Erro ao buscar CEP:', error.message);
    }
    return { lat: null, lon: null };
}

exports.index = async (req, res) => {
    try {
        const unidades = await unidadesService.getAllUnidades();
        res.render('unidades/index', { title: 'Gerenciar Unidades', unidades });
    } catch (error) {
        res.render('unidades/index', { title: 'Gerenciar Unidades', unidades: [], error: 'Erro ao carregar.' });
    }
};

exports.create = (req, res) => {
    res.render('unidades/create', { title: 'Nova Unidade' });
};

exports.store = async (req, res) => {
    try {
        const { nome, cidade, endereco, cep, responsavel, capacidade, telefone } = req.body;
        
        const { lat, lon } = await buscarCoordenadasPorCEP(cep);

        await unidadesService.createUnidade({
            nome, cidade, endereco, cep, responsavel, capacidade, telefone,
            lat, lon
        });

        res.redirect('/unidades');
    } catch (error) {
        console.error(error);
        res.redirect('/unidades/create');
    }
};

exports.edit = async (req, res) => {
    try {
        const unidade = await unidadesService.getUnidadeById(req.params.id);
        if (!unidade) return res.redirect('/unidades');
        res.render('unidades/edit', { title: 'Editar Unidade', unidade });
    } catch (error) {
        res.redirect('/unidades');
    }
};

exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, cidade, endereco, cep, responsavel, capacidade, telefone } = req.body;

        const { lat, lon } = await buscarCoordenadasPorCEP(cep);

        await unidadesService.updateUnidade(id, {
            nome, cidade, endereco, cep, responsavel, capacidade, telefone,
            lat, lon
        });

        res.redirect('/unidades');
    } catch (error) {
        res.redirect(`/unidades/${req.params.id}/edit`);
    }
};

exports.destroy = async (req, res) => {
    try {
        await unidadesService.deleteUnidade(req.params.id);
        res.redirect('/unidades');
    } catch (error) {
        res.redirect('/unidades');
    }
};

// Salvar coordenadas via AJAX
exports.saveCoords = async (req, res) => {
    try {
        const { lat, lon } = req.body;
        const { id } = req.params;
        
        if(lat && lon) {
            await unidadesService.updateUnidade(id, { lat, lon });
            return res.json({ success: true });
        }
        res.status(400).json({ success: false });
    } catch (error) {
        console.error("Erro no saveCoords:", error);
        res.status(500).json({ success: false });
    }
};