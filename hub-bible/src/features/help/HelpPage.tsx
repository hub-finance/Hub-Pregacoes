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
      'O sermão é montado em blocos, como se monta no Word: Seção (o subtítulo com o filete), Parágrafo, Destaque (o quadro que chama a atenção), Citação bíblica e Lista.',
      'Todo sermão novo já abre com Introdução, Desenvolvimento, Conclusão e Aplicação prontas — apague, renomeie ou acrescente as suas.',
      'A barra no alto formata o trecho que você selecionou: negrito, itálico, sublinhado e cor. O botão de girar limpa a formatação.',
      'Cada bloco tem os seus botões: trocar o tipo, subir, descer, inserir outro abaixo e excluir. No fim da página, a barra acrescenta um bloco novo do tipo que você escolher.',
      'No bloco Citação bíblica, escreva a referência e toque em "Trazer texto": o versículo vem do próprio aplicativo, com a referência por baixo. O texto bíblico nunca é digitado pelo sistema.',
      'Enter abre um bloco novo; Shift+Enter quebra a linha dentro do mesmo bloco.',
      'No campo "Texto principal" digite a referência e o texto bíblico aparece embaixo, carregado do próprio aplicativo.',
      'O sermão salva sozinho enquanto você escreve — não existe botão de salvar.',
      'No menu "…" você exporta em Markdown, TXT ou PDF, compartilha, ou exclui. O PDF sai com o mesmo desenho da tela: título, filetes, destaques e citações.',
      'No Modo Pregação, cada Seção vira um passo, e o destaque continua destacado no púlpito.',
    ],
  },
  {
    icon: 'upload',
    title: 'Importar um sermão que já está pronto',
    steps: [
      'Serve para o sermão que você já escreveu em PDF ou no Word e não quer digitar de novo.',
      'Sermões › botão Importar › escolha o arquivo. O título vem do nome do arquivo e pode ser trocado.',
      'O documento é exibido exatamente como foi feito — fontes, negritos, títulos, tabelas e quebras de página. Nada é convertido para texto simples.',
      'Ele entra na sua lista de sermões como qualquer outro: recebe categoria, etiquetas, anotações, e aparece na Biblioteca Ministerial.',
      'No Modo Pregação, o documento ocupa a tela com o cronômetro por cima, e você ainda pode abrir a Bíblia ao lado.',
      'Formatos aceitos: PDF e Word .docx, até 35 MB. O .doc antigo não abre — no Word, use "Salvar como" para .docx ou PDF.',
      'O arquivo fica guardado no aparelho e funciona offline. Ao excluir o sermão, o arquivo vai junto.',
    ],
  },
  {
    icon: 'study',
    title: 'Rhema — estudos e apostilas',
    steps: [
      'A aba Rhema guarda duas coisas: os estudos que você escreve aqui dentro e as apostilas que você já tem prontas em PDF.',
      'Rhema › Importar › escolha o arquivo. Cada apostila entra como um item da lista, com categoria e etiquetas suas.',
      'A apostila é exibida exatamente como foi feita — fontes, imagens, quadros e quebras de página. Nada é convertido.',
      'O botão "Modo Aula" abre a apostila em tela cheia com a Bíblia à esquerda e o material à direita: é a tela para dar aula. O botão de dividir fecha a Bíblia quando você quiser só estudar.',
      'No Modo Aula há cronômetro, ajuste de letra e a tela não apaga sozinha, igual ao Modo Pregação.',
      'Você pode escrever suas observações, vincular versículos e criar anotações sobre a apostila — o material continua intacto, o que é seu fica separado.',
      'Formatos aceitos: PDF e Word .docx, até 35 MB cada. As páginas são desenhadas conforme você rola, então apostilas de 60 páginas abrem sem travar.',
    ],
  },
  {
    icon: 'preach',
    title: 'Modo Pregação',
    steps: [
      'Serve para pregar com o tablet na mão: tela cheia, letra grande, poucos elementos.',
      'Abra por um sermão preparado (o caminho completo) ou direto de um capítulo, para projetar a leitura.',
      'O cronômetro fica no alto: escolha 30, 40, 45 ou 50 minutos, ou tempo livre. Fica verde dentro do tempo, âmbar nos últimos cinco minutos e vermelho quando passa, mostrando quanto passou.',
      'Tela dividida: o botão de dividir coloca a Bíblia à esquerda e a mensagem à direita. O painel acompanha a referência do ponto e destaca o versículo. No tablet as duas colunas ficam lado a lado; só no celular a Bíblia vai para cima e a mensagem para baixo, porque não cabem lado a lado.',
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
