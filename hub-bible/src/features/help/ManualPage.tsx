import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui';
import { Icon } from '../../components/Icon';

/**
 * O manual completo aberto dentro do aplicativo.
 *
 * O manual é uma página HTML solta — feita para imprimir, salvar em PDF e
 * enviar a quem for usar o app junto. Aberta diretamente, ela substituía a tela
 * inteira, e no aplicativo empacotado não há barra de navegador: quem entrasse
 * ficava sem saída se o botão de voltar da própria página falhasse por qualquer
 * motivo.
 *
 * Aqui ela vem num quadro dentro do app. O menu lateral, a barra de baixo e o
 * botão de voltar desta tela continuam visíveis o tempo todo — não existe mais
 * um estado em que não há caminho de volta, independente de o quadro carregar a
 * versão certa do manual ou não.
 */
export default function ManualPage() {
  const src = `${import.meta.env.BASE_URL}manual.html`;

  return (
    <div className="page page-wide">
      {/* os botões vêm antes do título: num celular estreito o que importa ao
          entrar aqui é enxergar a saída, não ler o cabeçalho de novo */}
      <div className="row row-wrap" style={{ marginBottom: 'var(--sp-4)' }}>
        <Link className="btn btn-sm" to="/ajuda">
          <Icon name="chevron-left" size={16} />
          Voltar à Ajuda
        </Link>
        {/* alvo próprio: fora do aplicativo o navegador abre uma aba com os
            controles dele, que é onde imprimir e salvar em PDF funcionam */}
        <a className="btn btn-sm" href={src} target="_blank" rel="noreferrer">
          <Icon name="download" size={16} />
          Abrir para imprimir
        </a>
      </div>

      <PageHeader title="Manual completo" lead="Tudo o que o aplicativo faz, em uma página só." />

      <iframe className="manual-frame" src={src} title="Manual de uso do Hub Bible" />
    </div>
  );
}
