import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui';
import { Icon, type IconName } from '../../components/Icon';

interface Topic {
  icon: IconName;
  title: string;
  steps: Array<string | { to: string; label: string; text: string }>;
}

/**
 * Ajuda — o manual dentro do próprio aplicativo.
 * Escrito em linguagem direta: o usuário está com o tablet na mão, não lendo
 * documentação técnica.
 */
const TOPICS: Topic[] = [
  {
    icon: 'download',
    title: 'Instalar no tablet ou no celular',
    steps: [
      'Abra o endereço do aplicativo no Chrome.',
      'Toque no menu do navegador (⋮) e escolha "Instalar aplicativo" ou "Adicionar à tela inicial".',
      'O Hub Bible passa a abrir em tela cheia, com ícone próprio, como um aplicativo comum.',
      'Depois de instalado, vá em Configurações › Traduções › "Baixar para uso offline". A partir daí a Bíblia inteira funciona sem internet.',
    ],
  },
  {
    icon: 'reset',
    title: 'Atualizar para a versão mais nova',
    steps: [
      'A atualização é automática: quando há versão nova, aparece um aviso "Nova versão disponível" no alto da tela. Toque em Atualizar.',
      'Se você ignorar o aviso, a atualização entra sozinha na próxima vez que abrir o aplicativo.',
      'Se quiser forçar: feche o aplicativo por completo (retire-o dos apps recentes) e abra de novo.',
      'Nada do que você criou se perde numa atualização — anotações, sermões e favoritos ficam no aparelho.',
    ],
  },
  {
    icon: 'book',
    title: 'Ler a Bíblia',
    steps: [
      'Toque na pílula com o nome do livro para trocar de livro ou capítulo.',
      'O botão ao lado troca a tradução; ali também se liga a comparação lado a lado com uma segunda versão.',
      'Use "Aa" para ajustar tamanho da letra, espaçamento, largura da coluna, tema e alinhamento.',
      'Toque em um versículo para selecioná-lo. Toque em outros para selecionar vários de uma vez.',
      'Com o versículo selecionado aparece a barra de ações: destacar, favoritar, anotar, compartilhar, copiar, ou criar um estudo e um sermão já a partir daquele texto.',
    ],
  },
  {
    icon: 'search',
    title: 'Buscar no texto',
    steps: [
      'Palavra solta: encontra todos os versículos que a contenham.',
      'Várias palavras: traz os versículos em que todas aparecem.',
      'Expressão exata: coloque entre aspas — "não temas" — ou ligue o filtro "Frase exata".',
      'Referência: digite "João 3:16", "1co 13" ou "Sl 23:1-6" e um atalho leva direto à passagem.',
      'Dá para restringir a busca ao Antigo Testamento, ao Novo, ou a um livro específico.',
    ],
  },
  {
    icon: 'highlighter',
    title: 'Marcações, favoritos e anotações',
    steps: [
      'Marcações são grifos coloridos por tema: Promessas, Fé, Cura, Liderança e outros. Você pode criar categorias suas em Configurações.',
      'Favoritos guardam o versículo com categoria e uma observação sua.',
      'Anotações podem nascer de um versículo ou ser livres, e ficam ligadas ao texto para sempre.',
      { to: '/favoritos', label: 'Abrir favoritos', text: 'Tudo o que você marcar aparece reunido nas telas próprias.' },
    ],
  },
  {
    icon: 'sermon',
    title: 'Preparar um sermão',
    steps: [
      'A estrutura é simples: título, introdução, desenvolvimento, conclusão e aplicação.',
      'No campo "Texto principal" digite a referência e o texto bíblico aparece embaixo, carregado do próprio aplicativo.',
      'O sermão salva sozinho enquanto você escreve — não existe botão de salvar.',
      'No menu "…" você exporta em Markdown, TXT ou PDF, compartilha, ou exclui.',
    ],
  },
  {
    icon: 'preach',
    title: 'Modo Pregação',
    steps: [
      'Serve para pregar com o tablet na mão: tela cheia, letra grande, poucos elementos.',
      'Abra por um sermão preparado (o caminho completo) ou direto de um capítulo, para projetar a leitura.',
      'O cronômetro fica no alto: escolha 30, 40, 45 ou 50 minutos, ou tempo livre. Fica verde dentro do tempo, âmbar nos últimos cinco minutos e vermelho quando passa, mostrando quanto passou.',
      'Tela dividida: quando você está pregando um sermão, o botão de dividir coloca a Bíblia à esquerda e a mensagem à direita. O painel acompanha a referência do ponto e destaca o versículo. Esse botão só aparece com um sermão aberto e em tela larga — no celular não há espaço.',
      'A- e A+ ajustam a letra só da pregação, sem mexer no tamanho do leitor.',
      'A tela não apaga sozinha enquanto o Modo Pregação estiver aberto.',
    ],
  },
  {
    icon: 'lock',
    title: 'Traduções e direitos autorais',
    steps: [
      'Vêm quatro traduções em português — Almeida, Bíblia Livre, Tradução Brasileira e Almeida 1911 — mais a King James em inglês. Todas em domínio público, livres para usar.',
      'ARA, NVI, NTLH, KJA, NAA e ACF têm direitos autorais e não acompanham o aplicativo. Aparecem no catálogo com um cadeado.',
      'Se você tem autorização da editora ou uma cópia licenciada, importe em Configurações › Traduções › Importar. O texto fica só no seu aparelho.',
      { to: '/config', label: 'Abrir configurações', text: 'A importação aceita arquivos JSON em três formatos diferentes.' },
    ],
  },
  {
    icon: 'download',
    title: 'Backup dos seus dados',
    steps: [
      'Tudo o que você cria fica gravado apenas no seu aparelho. Nada é enviado para servidor nenhum.',
      'Por isso o backup importa: Configurações › "Exportar meus dados" gera um arquivo com favoritos, anotações, sermões, estudos, devocionais e planos.',
      'Para restaurar em outro aparelho, ou depois de reinstalar: Configurações › "Restaurar backup".',
      'Se você limpar os dados do navegador sem ter backup, o conteúdo se perde. Exporte de tempos em tempos.',
    ],
  },
  {
    icon: 'share',
    title: 'Compartilhar o aplicativo',
    steps: [
      'Basta enviar o endereço do aplicativo para quem você quiser. Não há cadastro nem instalação de loja.',
      'Cada pessoa instala pelo Chrome e passa a ter o próprio conteúdo, separado do seu.',
      'Quando sair uma versão nova, todos recebem o aviso de atualização — não é preciso reenviar nada.',
      'As traduções livres podem ser distribuídas sem problema. Já uma tradução licenciada que você tenha importado vale só para você: não a repasse.',
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="page">
      <PageHeader
        title="Ajuda"
        lead="Como usar o Hub Bible no dia a dia e na hora de pregar."
      />

      <div className="stack">
        {TOPICS.map((topic) => (
          <details key={topic.title} className="card help-topic">
            <summary>
              <span className="help-topic-icon">
                <Icon name={topic.icon} size={20} />
              </span>
              <span className="card-title">{topic.title}</span>
              <Icon name="chevron-down" size={18} className="dim help-topic-caret" />
            </summary>
            <ol className="help-steps">
              {topic.steps.map((step, i) => (
                <li key={i}>
                  {typeof step === 'string' ? (
                    step
                  ) : (
                    <>
                      {step.text}{' '}
                      <Link to={step.to} style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>
                        {step.label}
                      </Link>
                    </>
                  )}
                </li>
              ))}
            </ol>
          </details>
        ))}
      </div>

      <div className="notice notice-accent" style={{ marginTop: 'var(--sp-5)' }}>
        <Icon name="info" size={20} style={{ flex: 'none' }} />
        <span>
          Não encontrou o que precisava? Tudo o que o aplicativo faz está descrito aqui e em{' '}
          <Link to="/config" style={{ fontWeight: 600 }}>
            Configurações
          </Link>
          .
        </span>
      </div>
    </div>
  );
}
