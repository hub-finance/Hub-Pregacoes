package app.hubbible.leitor;

import android.content.SharedPreferences;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

import java.io.File;

/**
 * Tela única do aplicativo.
 *
 * A única coisa que ela acrescenta ao Capacitor é limpar os caches da WebView
 * quando o aplicativo muda de versão — e isso precisa acontecer aqui, em Java,
 * porque é o único ponto que roda **antes** da WebView carregar qualquer coisa.
 */
public class MainActivity extends BridgeActivity {

    private static final String TAG = "HubBible";
    private static final String PREFS = "hub-bible";
    private static final String KEY_INSTALLED_AT = "webAssetsInstalledAt";

    /**
     * Pastas da WebView que guardam cópias dos arquivos do app.
     *
     * Tudo aqui é cópia de algo que já vem dentro do pacote — apagar não perde
     * nada, só obriga a WebView a ler de novo do lugar certo. O que **não** está
     * nesta lista é tão importante quanto o que está: `IndexedDB`, `Local
     * Storage` e `databases` ficam de fora de propósito, porque é lá que moram
     * os sermões, as anotações, os planos e as Bíblias importadas.
     */
    private static final String[] STALE_DIRS = {
        "Service Worker", "Default/Service Worker",
        "Cache", "Default/Cache",
        "Code Cache", "Default/Code Cache",
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        clearWebCachesOnUpgrade();
        super.onCreate(savedInstanceState);
    }

    /**
     * Apaga os caches da WebView quando a versão instalada muda.
     *
     * O conteúdo web vem dentro do pacote, mas um service worker registrado por
     * uma instalação anterior sobrevive à atualização — e passa a servir as
     * telas antigas por cima dos arquivos novos, sem nenhuma forma de o próprio
     * app se corrigir: o código que faria a limpeza também viria do cache.
     *
     * Apaga-se só o que é cópia. `IndexedDB` fica ao lado, e é onde moram os
     * sermões, as anotações e as Bíblias importadas — perder isso numa
     * atualização seria bem pior do que o problema que se está resolvendo.
     */
    private void clearWebCachesOnUpgrade() {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
            /* `lastUpdateTime` muda a cada instalação ou atualização do pacote, e
               existe desde as primeiras versões do Android — ao contrário de
               `getLongVersionCode()`, que só chegou na API 28 e derrubaria os
               aparelhos antigos que este app ainda atende (minSdk 23). */
            long installedAt = getPackageManager()
                    .getPackageInfo(getPackageName(), 0)
                    .lastUpdateTime;

            if (prefs.getLong(KEY_INSTALLED_AT, -1L) == installedAt) return;

            File webView = new File(getApplicationInfo().dataDir, "app_webview");
            for (String stale : STALE_DIRS) deleteRecursively(new File(webView, stale));
            emptyDirectory(getCacheDir());

            prefs.edit().putLong(KEY_INSTALLED_AT, installedAt).apply();
            Log.i(TAG, "Cache da WebView limpo na instalação de " + installedAt);
        } catch (Exception e) {
            // falhar aqui não pode impedir o app de abrir
            Log.w(TAG, "Não foi possível limpar o cache: " + e.getMessage());
        }
    }

    /** Esvazia a pasta sem apagá-la: o próprio Android espera que ela exista. */
    private void emptyDirectory(File dir) {
        if (dir == null) return;
        File[] children = dir.listFiles();
        if (children == null) return;
        for (File child : children) deleteRecursively(child);
    }

    private void deleteRecursively(File file) {
        if (file == null || !file.exists()) return;
        File[] children = file.listFiles();
        if (children != null) {
            for (File child : children) deleteRecursively(child);
        }
        // ignora o retorno de propósito: um arquivo preso não deve derrubar nada
        file.delete();
    }
}
