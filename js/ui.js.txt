// js/ui.js - Gerencia Interface, Modais e Renderização

// --- TOASTS ---
function showToast(msg, tipo = "success") {
    let bg = "#00bcd4";
    if (tipo === "error") bg = "#ff4444";
    if (tipo === "info") bg = "#333";
    Toastify({
        text: msg, duration: 3000, close: true, gravity: "top", position: "center", 
        backgroundColor: bg, stopOnFocus: true, style: { borderRadius: "8px", fontWeight: "bold" }
    }).showToast();
}

// --- RENDERIZAÇÃO ---
function renderizarSkeleton() {
    const lista = document.getElementById('songList'); if (!lista) return;
    let html = '';
    for (let i = 0; i < 6; i++) {
        html += `<div class="song-card skeleton"><div class="song-info"><div class="play-circle"></div><div class="song-details"><h3>...</h3><p>...</p></div></div></div>`;
    }
    lista.innerHTML = html;
}

function renderizarHinos(filtro = 'todos') {
    const lista = document.getElementById('songList'); if (!lista) return;
    lista.innerHTML = '';
    window.playlistAtual = []; // Reseta playlist local

    // Converte objeto em array e ordena
    let arrayHinos = Object.keys(window.hinosData).map(id => ({ ...window.hinosData[id], id }));
    arrayHinos.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

    arrayHinos.forEach(h => {
        if (filtro === 'todos' || filtro === h.categoria || (filtro === 'setlist' && h.setlist)) {
            window.playlistAtual.push(h); // Adiciona à playlist "tocável"
            
            let handleHTML = filtro === 'setlist' ? `<div class="drag-handle"><i class="fas fa-grip-vertical"></i></div>` : '';
            
            lista.innerHTML += `
                <div class="song-card" data-id="${h.id}" onclick="tocarNoPlayer('${h.id}')" title="Clique para ouvir">
                    ${handleHTML}
                    <div class="song-info">
                        <div class="play-circle"><i class="fas fa-play"></i></div>
                        <div class="song-details">
                            <h3>${h.nome}</h3>
                            <p>${h.artista} • <span>${h.tom || '--'}</span></p>
                        </div>
                    </div>
                    <div class="song-actions">
                        <button class="action-btn btn-view" onclick="event.stopPropagation(); abrirTelaCheia('${h.id}')" title="Telão"><i class="fas fa-expand-alt"></i></button>
                        <button class="action-btn btn-edit" onclick="event.stopPropagation(); prepararEdicao('${h.id}')" title="Editar"><i class="fas fa-pen"></i></button>
                        <button class="action-btn btn-delete" onclick="event.stopPropagation(); excluirHino('${h.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;
        }
    });

    // Reativa o Drag & Drop se estiver no Setlist
    if (filtro === 'setlist') {
        new Sortable(lista, {
            animation: 150, handle: '.drag-handle', ghostClass: 'sortable-ghost',
            onEnd: function () {
                const updates = {};
                Array.from(lista.children).forEach((card, index) => {
                    updates[card.getAttribute('data-id') + '/ordem'] = index;
                });
                salvarOrdemNoFirebase(updates); // Chama função do db.js
            }
        });
    }
}

function renderizarAbas() {
    const container = document.getElementById('category-tabs');
    container.innerHTML = `<button class="cat-btn active" onclick="filtrar('todos', this)">TODOS</button>`;
    Object.keys(window.categoriasUsuario).forEach(id => {
        if (window.categoriasUsuario[id].fixada) {
            container.innerHTML += `<button class="cat-btn" onclick="filtrar('${id}', this)">${window.categoriasUsuario[id].nome}</button>`;
        }
    });
    container.innerHTML += `<button class="cat-btn" onclick="filtrar('setlist', this)">SETLIST</button>`;
}

function filtrar(cat, btn) {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderizarHinos(cat);
}

function buscar() {
    const term = document.getElementById('searchInput').value.toLowerCase();
    document.querySelectorAll('.song-card').forEach(card => {
        card.style.display = card.innerText.toLowerCase().includes(term) ? "flex" : "none";
    });
}

// --- MODAIS ---

function abrirModal() { switchTab('tab-dados'); document.getElementById('modal-cadastro').style.display = 'flex'; }
function fecharModal() { document.getElementById('modal-cadastro').style.display = 'none'; window.idEdicao = null; }

function prepararEdicao(id) {
    window.idEdicao = id; 
    const h = window.hinosData[id];
    document.getElementById('novo-nome').value = h.nome;
    document.getElementById('novo-artista').value = h.artista;
    document.getElementById('novo-tom').value = h.tom;
    document.getElementById('novo-bpm').value = h.bpm || "";
    document.getElementById('nova-categoria').value = h.categoria;
    document.getElementById('novo-video').value = h.videoID || "";
    document.getElementById('nova-letra').value = h.letra;
    document.getElementById('check-setlist').checked = h.setlist;
    abrirModal();
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    // Ativa botão correspondente
    if (tabId === 'tab-dados') document.querySelectorAll('.tab-btn')[0].classList.add('active');
    else document.querySelectorAll('.tab-btn')[1].classList.add('active');
}

// --- TEMA E CONFIGURAÇÃO ---

function toggleConfig() {
    const p = document.getElementById('config-panel');
    p.style.display = p.style.display === 'block' ? 'none' : 'block';
}

function mudarTema(cor) {
    document.documentElement.style.setProperty('--primary-color', cor);
    localStorage.setItem('tema_cor', cor);
}

// --- UPLOAD E SALVAMENTO ---

async function salvarHino() {
    const btn = document.getElementById('btn-salvar-hino');
    const audioFile = document.getElementById('novo-audio').files[0];
    const nome = document.getElementById('novo-nome').value;

    if (!nome) return showToast("Nome da música é obrigatório!", "error");

    btn.disabled = true; btn.innerText = "PROCESSANDO...";

    try {
        let audioUrl = "";
        // Se houver arquivo, faz upload (Lógica do Cloudinary)
        if (audioFile) {
            const formData = new FormData();
            formData.append('file', audioFile);
            formData.append('upload_preset', 'ml_default'); // Seu preset
            showToast("Enviando áudio...", "info");
            
            // ATENÇÃO: Substitua pelo seu Cloud Name se necessário, ou use variável global
            const CLOUD_NAME = "duezqryny"; 
            const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`, { method: 'POST', body: formData });
            const data = await resp.json();
            audioUrl = data.secure_url;
        }

        const hino = {
            nome: nome.toUpperCase(),
            artista: document.getElementById('novo-artista').value,
            tom: document.getElementById('novo-tom').value.toUpperCase(),
            bpm: document.getElementById('novo-bpm').value,
            categoria: document.getElementById('nova-categoria').value,
            videoID: extrairID(document.getElementById('novo-video').value),
            audioUrl: audioUrl || (window.idEdicao && window.hinosData[window.idEdicao].audioUrl ? window.hinosData[window.idEdicao].audioUrl : ""),
            letra: document.getElementById('nova-letra').value,
            setlist: document.getElementById('check-setlist').checked
        };

        // Chama função do db.js para salvar
        await salvarHinoNoFirebase(hino, window.idEdicao);
        fecharModal();

    } catch (error) {
        showToast("Erro: " + error.message, "error");
    } finally {
        btn.disabled = false; btn.innerText = "SALVAR MÚSICA";
    }
}

function extrairID(url) {
    if (!url) return "";
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?)\??v?=?([^#&?]*)).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : url;
}

// --- TRANSPOSIÇÃO NO EDITOR ---
function transporEditor(semitons) {
    const notas = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const txt = document.getElementById('nova-letra');
    let texto = txt.value.replace(/\[([A-G][#b]?)(.*?)\]/g, (match, nota, comp) => {
        let idx = notas.indexOf(nota.toUpperCase());
        if (idx === -1) return match;
        let nIdx = (idx + semitons + 12) % 12;
        return `[${notas[nIdx]}${comp}]`;
    });
    txt.value = texto;
    
    // Atualiza campo TOM
    const campo = document.getElementById('novo-tom');
    if(campo.value) {
        let idx = notas.indexOf(campo.value.toUpperCase().trim());
        if(idx !== -1) campo.value = notas[(idx + semitons + 12) % 12];
    }
    showToast(`Transposto ${semitons > 0 ? '+' : ''}${semitons/2} Tom`);
}

// Funções de UI para Escalas e Playlists
function abrirHistoricoEscalas() { toggleConfig(); document.getElementById('modal-historico').style.display = 'flex'; buscarHistoricoEscalas(renderizarListaHistorico); }
function renderizarListaHistorico(dados) {
    const container = document.getElementById('lista-historico');
    if(!dados) { container.innerHTML = '<p style="text-align:center">Vazio</p>'; return; }
    let html = '';
    Object.keys(dados).map(k=>({...dados[k], id:k})).reverse().forEach(e => {
        html += `<div class="historico-item"><div class="historico-info"><h4>${e.nome}</h4><small>${new Date(e.data).toLocaleDateString()}</small></div><div><button onclick="carregarEscalaDoHistorico('${e.id}')" class="btn-save-main">USAR</button><button onclick="excluirEscalaDoHistorico('${e.id}')" style="background:none;border:none;color:red"><i class="fas fa-trash"></i></button></div></div>`;
    });
    container.innerHTML = html;
}

function abrirGerenciadorPlaylists() { document.getElementById('modal-playlists').style.display='flex'; }
function fecharGerenciador() { document.getElementById('modal-playlists').style.display='none'; }
function atualizarSelectCategorias() { 
    const s = document.getElementById('nova-categoria'); s.innerHTML=''; 
    Object.keys(window.categoriasUsuario).forEach(k => s.innerHTML += `<option value="${k}">${window.categoriasUsuario[k].nome}</option>`); 
}