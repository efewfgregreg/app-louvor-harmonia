// js/player.js - Gerencia Áudio, YouTube e Ferramentas de Músico

// Variáveis Globais
window.player = null;
window.playlistAtual = [];
window.indexAtual = 0;
window.isShuffle = false;
window.isRepeat = false;

// Variáveis de Ensaio
let loopStart = null;
let loopEnd = null;
let isLooping = false;

// --- INICIALIZAÇÃO DO YOUTUBE ---
function onYouTubeIframeAPIReady() {
    window.player = new YT.Player('yt-api-container', {
        height: '100%',
        width: '100%',
        playerVars: {
            'origin': window.location.origin, // Corrige o erro de postMessage
            'rel': 0,
            'showinfo': 0,
            'controls': 0
        },
        events: { 'onStateChange': onPlayerStateChange }
    });
}

function onPlayerStateChange(event) {
    const icon = document.getElementById('sp-play-icon');
    if (!icon) return; // Segurança

    if (event.data == YT.PlayerState.PLAYING) {
        icon.className = "fas fa-pause";
        setInterval(() => {
            if (!window.player || !window.player.getCurrentTime) return;
            const cur = window.player.getCurrentTime();
            const dur = window.player.getDuration();
            checkLoop(cur);
            atualizarBarraProgresso(cur, dur);
        }, 500);
    } else {
        icon.className = "fas fa-play";
        if (event.data == YT.PlayerState.ENDED && !isLooping) proximaMusica();
    }
}

// --- CONTROLES DE PLAYBACK ---

function tocarNoPlayer(id) {
    // 1. Verificações de Segurança (Evita o erro "Cannot set properties of null")
    const elNome = document.getElementById('sp-name');
    const elArtista = document.getElementById('sp-artist');
    const elTom = document.getElementById('sp-tom');
    const elArt = document.getElementById('player-art-container');
    const elAudio = document.getElementById('main-audio-player');
    
    if (!elNome || !elAudio) {
        console.warn("Player ainda não renderizado. Tentando novamente...");
        return; 
    }

    limparLoop(true); 
    
    const hino = window.hinosData[id];
    if(!hino) return;

    window.indexAtual = window.playlistAtual.findIndex(m => m.id === id);
    
    // Salva estado
    localStorage.setItem('hino_atual', JSON.stringify({...hino, id}));

    // Atualiza Visual
    elNome.innerText = hino.nome;
    elArtista.innerText = hino.artista || "Artista";
    elTom.innerText = hino.tom || "--";
    
    if(typeof atualizarDisplayBPM === 'function') atualizarDisplayBPM({...hino, id});

    // Capa
    if (hino.videoID) elArt.innerHTML = `<img src="https://img.youtube.com/vi/${hino.videoID}/mqdefault.jpg" style="width:100%; height:100%; object-fit:cover;">`;
    else elArt.innerHTML = `<i class="fas fa-music" style="color: #555;"></i>`;

    // Reseta players
    elAudio.pause();
    if (window.player && typeof window.player.stopVideo === 'function') window.player.stopVideo();

    // Toca
    if (hino.audioUrl) {
        elAudio.src = hino.audioUrl;
        // Tratamento do erro de Autoplay (AbortError)
        const playPromise = elAudio.play();
        if (playPromise !== undefined) {
            playPromise.then(_ => {
                // Play iniciou com sucesso
                const icon = document.getElementById('sp-play-icon');
                if(icon) icon.className = "fas fa-pause";
                iniciarProgressoAudio();
            }).catch(error => {
                console.log("Autoplay impedido pelo navegador (normal):", error);
                // Opcional: Mostrar um toast pedindo para clicar no play
            });
        }
    } else if (hino.videoID) {
        if (window.player && typeof window.player.loadVideoById === 'function') {
            window.player.loadVideoById(hino.videoID);
            window.player.playVideo();
        } else {
            showToast("Carregando YouTube...", "info");
            // Retry seguro
            setTimeout(() => { 
                if(window.player && typeof window.player.loadVideoById === 'function') { 
                    window.player.loadVideoById(hino.videoID); 
                    window.player.playVideo(); 
                }
            }, 1500);
        }
    }

    sincronizarAoVivo(hino, id);
}

function sincronizarAoVivo(hino, id) {
    const user = firebase.auth().currentUser;
    if(user) {
        firebase.database().ref(`usuarios/${user.uid}/aoVivo`).set({
            hino: { ...hino, id: id },
            timestamp: Date.now()
        });
    }
}

function togglePlayPause() {
    const hino = JSON.parse(localStorage.getItem('hino_atual'));
    const audioTag = document.getElementById('main-audio-player');
    const icon = document.getElementById('sp-play-icon');

    if (hino && hino.audioUrl) {
        if (audioTag.paused) { audioTag.play(); icon.className = "fas fa-pause"; }
        else { audioTag.pause(); icon.className = "fas fa-play"; }
    } else if (window.player && typeof window.player.getPlayerState === 'function') {
        window.player.getPlayerState() == 1 ? window.player.pauseVideo() : window.player.playVideo();
    }
}

function proximaMusica() {
    if(window.playlistAtual.length === 0) return;
    window.indexAtual = window.isShuffle 
        ? Math.floor(Math.random() * window.playlistAtual.length) 
        : (window.indexAtual + 1) % window.playlistAtual.length;
    
    // Verifica se o ID existe antes de tocar
    if(window.playlistAtual[window.indexAtual]) {
        tocarNoPlayer(window.playlistAtual[window.indexAtual].id);
    }
}

function musicaAnterior() {
    if(window.playlistAtual.length === 0) return;
    window.indexAtual = (window.indexAtual - 1 + window.playlistAtual.length) % window.playlistAtual.length;
    
    if(window.playlistAtual[window.indexAtual]) {
        tocarNoPlayer(window.playlistAtual[window.indexAtual].id);
    }
}

// --- FERRAMENTAS DE ÁUDIO ---

function toggleEnsaioPanel() {
    const p = document.getElementById('ensaio-panel');
    const btn = document.getElementById('btn-ensaio');
    if(!p || !btn) return;
    
    if (p.style.display === 'block') { p.style.display = 'none'; btn.style.color = '#888'; }
    else { p.style.display = 'block'; btn.style.color = 'var(--primary-color)'; }
}

function marcarLoop(ponto) {
    const aud = document.getElementById('main-audio-player');
    let t = 0;
    if (aud && !aud.paused) t = aud.currentTime;
    else if (window.player && typeof window.player.getCurrentTime === 'function') t = window.player.getCurrentTime();

    const m_a = document.getElementById('marker-a');
    const m_b = document.getElementById('marker-b');
    const btn_a = document.getElementById('btn-loop-a');
    const btn_b = document.getElementById('btn-loop-b');
    const fill = document.getElementById('loop-range-fill');

    if (ponto === 'A') {
        loopStart = t;
        if(m_a) { m_a.style.display = 'block'; m_a.style.left = (t / getDuration() * 100) + "%"; }
        if(btn_a) btn_a.classList.add('active');
        showToast("Ponto A marcado!");
    } else if (ponto === 'B') {
        if (loopStart === null) return showToast("Marque o ponto A primeiro!", "error");
        if (t <= loopStart) return showToast("Ponto B deve ser depois do A!", "error");
        
        loopEnd = t;
        isLooping = true;
        if(m_b) { m_b.style.display = 'block'; m_b.style.left = (t / getDuration() * 100) + "%"; }
        if(btn_b) btn_b.classList.add('active');
        
        if(fill) {
            const pA = (loopStart / getDuration() * 100);
            const pB = (loopEnd / getDuration() * 100);
            fill.style.display = 'block'; fill.style.left = pA + "%"; fill.style.width = (pB - pA) + "%";
        }
        
        seekToTime(loopStart);
        showToast("Loop Iniciado!");
    }
}

function limparLoop(silencioso = false) {
    loopStart = null; loopEnd = null; isLooping = false;
    
    const els = ['marker-a', 'marker-b', 'loop-range-fill'];
    els.forEach(id => { const el = document.getElementById(id); if(el) el.style.display = 'none'; });
    
    const btns = ['btn-loop-a', 'btn-loop-b'];
    btns.forEach(id => { const el = document.getElementById(id); if(el) el.classList.remove('active'); });

    mudarVelocidade(1);
    const rateEl = document.getElementById('playback-rate');
    if(rateEl) rateEl.value = "1";
    
    if (!silencioso) showToast("Loop desativado.");
}

function checkLoop(t) {
    if (isLooping && loopEnd && t >= loopEnd) { seekToTime(loopStart); }
}

function mudarVelocidade(rate) {
    const r = parseFloat(rate);
    const aud = document.getElementById('main-audio-player');
    if (aud) aud.playbackRate = r;
    if (window.player && typeof window.player.setPlaybackRate === 'function') window.player.setPlaybackRate(r);
}

// --- UTILITÁRIOS ---

function getDuration() {
    const aud = document.getElementById('main-audio-player');
    if (aud && aud.src && !aud.paused) return aud.duration;
    if (window.player && typeof window.player.getDuration === 'function') return window.player.getDuration();
    return 1;
}

function seekToTime(t) {
    const aud = document.getElementById('main-audio-player');
    if (aud && aud.src && !aud.paused) aud.currentTime = t;
    else if (window.player && typeof window.player.seekTo === 'function') window.player.seekTo(t);
}

function seek(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const p = (e.clientX - rect.left) / rect.width;
    seekToTime(p * getDuration());
}

function iniciarProgressoAudio() {
    const aud = document.getElementById('main-audio-player');
    if(!aud) return;
    aud.ontimeupdate = () => {
        checkLoop(aud.currentTime);
        atualizarBarraProgresso(aud.currentTime, aud.duration);
        if (aud.ended && !isLooping) proximaMusica();
    };
}

function atualizarBarraProgresso(cur, dur) {
    if(!dur || isNaN(dur)) return;
    const bar = document.getElementById('progress-bar-fill');
    const tCur = document.getElementById('time-current');
    const tTot = document.getElementById('time-total');
    
    if(bar) bar.style.width = (cur / dur * 100) + "%";
    if(tCur) tCur.innerText = formatTime(cur);
    if(tTot) tTot.innerText = formatTime(dur);
}

function formatTime(s) {
    const m = Math.floor(s / 60);
    const g = Math.floor(s % 60);
    return m + ":" + (g < 10 ? "0" + g : g);
}

function ajustarVolume(val) {
    const at = document.getElementById('main-audio-player');
    if (at) at.volume = val / 100;
    if (window.player && typeof window.player.setVolume === 'function') window.player.setVolume(val);
}

// --- METRÔNOMO ---
let metronomoInterval, metronomoAtivo = false;
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playClick() {
    const o = audioContext.createOscillator();
    const g = audioContext.createGain();
    o.connect(g); g.connect(audioContext.destination);
    o.frequency.value = 1000; g.gain.value = 1;
    o.start(); g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
    o.stop(audioContext.currentTime + 0.1);
}

function toggleMetronomo() {
    const h = JSON.parse(localStorage.getItem('hino_atual'));
    if (!h || !h.bpm) { showToast("Sem BPM cadastrado!", "info"); return; }
    
    const btn = document.getElementById('btn-metronomo');
    const bpm = parseInt(h.bpm);
    
    if (metronomoAtivo) {
        clearInterval(metronomoInterval);
        metronomoAtivo = false;
        btn.style.color = "#888";
        btn.classList.remove('fa-spin');
    } else {
        if (audioContext.state === 'suspended') audioContext.resume();
        playClick();
        metronomoInterval = setInterval(playClick, 60000 / bpm);
        metronomoAtivo = true;
        btn.style.color = "var(--primary-color)";
        showToast(`Metrônomo: ${bpm} BPM`);
    }
}

function atualizarDisplayBPM(h) {
    if (metronomoAtivo) toggleMetronomo();
    const d = document.getElementById('display-bpm');
    if (d) {
        if (h && h.bpm) d.innerText = h.bpm + " BPM";
        else d.innerText = "-- BPM";
    }
}