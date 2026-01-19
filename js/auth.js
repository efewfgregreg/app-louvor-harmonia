// js/auth.js - Gerencia Autenticação do Usuário

function monitorarAutenticacao() {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            // Se estiver logado, inicia o banco de dados e a interface
            console.log("Usuário logado:", user.uid);
            
            // Carrega tema salvo
            if(localStorage.getItem('tema_cor')) {
                mudarTema(localStorage.getItem('tema_cor'));
            }

            // Inicia o Banco de Dados (função estará no db.js)
            iniciarBancoDados(user);
            
        } else {
            // Se não estiver logado, chuta para o login
            window.location.href = 'login.html'; 
        }
    });
}

function sair() {
    firebase.auth().signOut().then(() => {
        window.location.href = 'login.html';
    });
}