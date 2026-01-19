// js/db.js - Gerencia o Banco de Dados (Firebase)

// Variáveis Globais de Dados
window.db = null;
window.hinosData = {};
window.categoriasUsuario = {};

function iniciarBancoDados(user) {
    // 1. Conecta na pasta de repertório do usuário
    window.db = firebase.database().ref('usuarios/' + user.uid + '/repertorio');

    // 2. Escuta mudanças nos Hinos (Carregamento Inicial e Atualizações)
    window.db.on('value', (snapshot) => { 
        window.hinosData = snapshot.val() || {}; 
        // Chama a função de UI para desenhar a lista (estará no ui.js ou index por enquanto)
        if(typeof renderizarHinos === 'function') renderizarHinos(); 
    });

    // 3. Escuta mudanças nas Categorias/Playlists
    firebase.database().ref(`usuarios/${user.uid}/configuracoes/categorias`).on('value', (snap) => {
        window.categoriasUsuario = snap.val() || {
            "adoracao": { nome: "ADORAÇÃO", fixada: true },
            "celebracao": { nome: "CELEBRAÇÃO", fixada: true }
        };
        // Atualiza UI
        if(typeof renderizarAbas === 'function') renderizarAbas();
        if(typeof atualizarSelectCategorias === 'function') atualizarSelectCategorias();
    });
}

// --- FUNÇÕES DE HINOS ---

async function salvarHinoNoFirebase(hino, idEdicao) {
    if(idEdicao) {
        await window.db.child(idEdicao).update(hino);
        showToast("Hino atualizado com sucesso!");
    } else {
        await window.db.push(hino);
        showToast("Hino cadastrado com sucesso!");
    }
}

function excluirHino(id) {
    if(confirm("Tem certeza que deseja apagar essa música permanentemente?")) {
        window.db.child(id).remove()
            .then(() => showToast("Música excluída.", "info"))
            .catch(err => showToast("Erro ao excluir.", "error"));
    }
}

// --- FUNÇÕES DE ESCALA E HISTÓRICO ---

function salvarEscalaNoFirebase(nomeEvento, musicasEscala) {
    const user = firebase.auth().currentUser;
    const novaEscala = {
        nome: nomeEvento,
        data: new Date().toISOString(),
        musicas: musicasEscala,
        totalMusicas: musicasEscala.length
    };

    firebase.database().ref(`usuarios/${user.uid}/escalas`).push(novaEscala)
        .then(() => {
            showToast("Escala salva no Histórico!");
            toggleConfig(); // Fecha menu (função de UI)
        })
        .catch(err => showToast("Erro ao salvar: " + err.message, "error"));
}

function buscarHistoricoEscalas(callback) {
    const user = firebase.auth().currentUser;
    firebase.database().ref(`usuarios/${user.uid}/escalas`).once('value').then(snapshot => {
        callback(snapshot.val());
    });
}

function carregarEscalaDoHistorico(idEscala) {
    if(!confirm("Isso irá substituir seu Setlist atual. Deseja continuar?")) return;

    const user = firebase.auth().currentUser;
    firebase.database().ref(`usuarios/${user.uid}/escalas/${idEscala}`).once('value').then(snap => {
        const escala = snap.val();
        if(!escala) return;

        const updates = {};
        // Limpa setlist atual
        Object.keys(window.hinosData).forEach(hinoId => {
            updates[`usuarios/${user.uid}/repertorio/${hinoId}/setlist`] = false;
        });

        // Ativa músicas da escala
        if(escala.musicas) {
            escala.musicas.forEach(m => {
                if(window.hinosData[m.id]) {
                    updates[`usuarios/${user.uid}/repertorio/${m.id}/setlist`] = true;
                    updates[`usuarios/${user.uid}/repertorio/${m.id}/ordem`] = m.ordem;
                }
            });
        }

        firebase.database().ref().update(updates).then(() => {
            showToast(`Escala "${escala.nome}" carregada!`);
            document.getElementById('modal-historico').style.display = 'none';
            // Força ida para aba setlist (depende da UI)
            if(typeof filtrar === 'function') filtrar('setlist', document.querySelector("button[onclick=\"filtrar('setlist', this)\"]"));
        });
    });
}

function excluirEscalaDoHistorico(id) {
    if(confirm("Apagar este registro do histórico?")) {
        const user = firebase.auth().currentUser;
        firebase.database().ref(`usuarios/${user.uid}/escalas/${id}`).remove()
            .then(() => carregarListaHistorico()); // Recarrega lista na UI
    }
}

function limparSetlistNoFirebase() {
    if (confirm("Deseja remover TODAS as músicas do Setlist atual?")) {
        const user = firebase.auth().currentUser;
        const updates = {};
        Object.keys(window.hinosData).forEach(id => {
            if (window.hinosData[id].setlist) updates[`usuarios/${user.uid}/repertorio/${id}/setlist`] = false;
        });
        firebase.database().ref().update(updates).then(() => {
            toggleConfig();
            showToast("Setlist limpo!", "info");
        });
    }
}

// --- FUNÇÕES DE PLAYLIST/CATEGORIA ---

function criarPlaylistNoFirebase(nome) {
    const user = firebase.auth().currentUser;
    firebase.database().ref(`usuarios/${user.uid}/configuracoes/categorias/cat_${Date.now()}`).set({
        nome: nome,
        fixada: true
    }).then(() => {
        showToast("Playlist criada!");
        document.getElementById('nova-playlist-nome').value = ""; 
    });
}

function salvarOrdemNoFirebase(updates) {
    window.db.update(updates).then(() => {
        // Atualiza localmente para refletir rápido
        Object.keys(updates).forEach(path => {
            const [id, prop] = path.split('/');
            window.hinosData[id][prop] = updates[path];
        });
    });
}