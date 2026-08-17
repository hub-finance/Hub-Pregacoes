import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Empacotamento como aplicativo Android.
 *
 * O motivo de existir não é a loja: é o **armazenamento**. Instalado pelo
 * navegador, o Hub Bible guarda tudo na área do Chrome — e limpar os dados do
 * navegador leva anos de sermões junto. Dentro do Capacitor, a WebView tem
 * armazenamento próprio, na pasta do aplicativo: limpar o Chrome não toca em
 * nada aqui. Só desinstalar o app, ou limpar os dados **dele**, apaga.
 *
 * Por isso Capacitor e não TWA/Bubblewrap: o TWA é mais simples de montar, mas
 * quem roda por baixo é o próprio Chrome, com o armazenamento do Chrome — o
 * problema que motivou tudo isto continuaria de pé.
 *
 * A versão instalada pelo navegador continua existindo e é a recomendada para
 * quem só quer usar. As duas convivem, cada uma com seus dados.
 */
const config: CapacitorConfig = {
  appId: 'app.hubbible.leitor',
  appName: 'Hub Bible',
  webDir: 'dist',

  android: {
    /* O texto bíblico e os arquivos importados vivem no IndexedDB da WebView.
       `webContentsDebuggingEnabled` fica desligado: é build de uso, não de
       depuração. */
    webContentsDebuggingEnabled: false,
    /* Sem isto, um erro de rede numa fonte externa derrubaria a tela inteira —
       e o app é offline por natureza, então falha de rede é normal aqui. */
    allowMixedContent: false,
  },

  server: {
    /* `androidScheme: 'https'` faz a WebView servir o app como origem segura.
       É o que mantém IndexedDB, service worker e a API de armazenamento
       persistente funcionando exatamente como funcionam na web. */
    androidScheme: 'https',
  },
};

export default config;
