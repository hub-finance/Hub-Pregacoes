import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui';
import { Icon, type IconName } from '../../components/Icon';
import { isNativeApp } from '../../core/platform';

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
    title: 'Instalar no tablet ou no celular (Android)',
    steps: [
      'Abra o endereço do aplicativo no Chrome.',
      'Toque no menu do navegador (⋮) e escolha "Instalar aplicativo" ou "Adicionar à tela inicial".',
      'O Hub Bible passa a abrir em tela cheia, com ícone próprio, como um aplicativo comum.',
      'Depois de instalado, vá em Configurações › Traduções › "Baixar para uso offline". A partir daí a Bíblia inteira funciona sem internet.',
    ],
  },
  {
    icon: 'download',
    title: 'Usar no iPhone ou no iPad',
    steps: [
      'Abra o endereço do aplicativo no Safari. No iPhone e no iPad é o Safari que instala aplicativos na tela de início.',
      'Toque no botão Compartilhar (o quadrado com a seta para cima) e escolha "Adicionar à Tela de Início". Confirme em Adicionar.',
      'Abra pelo ícone que apareceu na tela de início — e não mais pelo Safari. É essa a diferença que faz o iPhone tratar o Hub Bible como aplicativo: tela cheia, e os seus dados protegidos da limpeza que o Safari faz em sites sem uso.',
      'Logo depois de instalar, vá em Configurações › Traduções › "Baixar para uso offline". Sem isso a Bíblia precisa de internet.',
      'Faça o backup de vez em quando: Configurações › "Exportar meus dados". O arquivo vai para o app Arquivos. É a garantia contra perder sermões e anotações.',
      'Para importar apostilas e sermões, tenha os arquivos no app Arquivos ou no iCloud Drive; o botão Importar abre direto neles.',
      'Se a exportação em PDF não abrir, é o bloqueio de pop-up do Safari: Ajustes › Safari › desligue "Bloquear Pop-ups", ou use Markdown/TXT.',
      'Em iPad com iOS anterior ao 16.4, a tela pode apagar durante a pregação. Ajustes › Tela e Brilho › Bloqueio Automático › Nunca, enquanto estiver pregando.',
      'O aplicativo ainda não foi testado em aparelho da Apple — foi feito e verificado no Android. Se algo se comportar diferente, é bom avisar.',
    ],
  },
  {
    icon: 'download',
    title: 'Aplicativo Android (APK) — independente do navegador',
    steps: [
      'Além da instalação pelo navegador, existe o APK: o mesmo aplicativo, mas com armazenamento próprio. Limpar os dados do Chrome não afeta nada dentro dele.',
      'O APK é gerado no GitHub, na aba Actions: abra a execução mais recente de "APK Android" e baixe o arquivo em Artifacts › hub-bible-apk.',
      'Baixe no tablet e toque no arquivo para instalar. O Android vai pedir permissão para instalar de fora da loja — é normal, porque não passa pela Play Store.',
      'Atenção: as duas instalações NÃO compartilham dados. Um sermão escrito no aplicativo não aparece na versão do navegador, e vice-versa. Para levar de uma para a outra, exporte a cópia de um lado e restaure do outro.',
      'Em Configurações › Backup o app diz em qual das duas você está.',
      'No APK a atualização deixa de ser automática: atualizar é baixar e instalar a versão nova. É o preço de não depender do navegador.',
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
      'Isso vale para a instalação pelo navegador. No aplicativo Android (APK) não há aviso de versão nova: lá, atualizar é baixar e instalar o APK mais recente.',
    ],
  },
  {
    icon: 'book',
    title: 'Ler a Bíblia',
    steps: [
      'Toque na pílula com o nome do livro para trocar de livro ou capítulo. Ela acompanha a rolagem, e a mesma pílula está no fim do capítulo — não é preciso voltar ao topo.',
      'A escolha tem três passos: livro, capítulo e versículo. No terceiro, "Abrir o capítulo inteiro" é o primeiro botão — escolher o versículo é opcional, e serve para começar a leitura já nele, com liberdade de subir e descer dali.',
      'Quem já sabe o endereço pula os três passos: escreva a referência inteira no campo de filtrar — "Jo 3:16", "Sl 23:1", "1co 13:4" — e toque no atalho "Ir para".',
      'O botão ao lado troca a tradução; ali também se liga a comparação lado a lado com uma segunda versão.',
      'Use "Aa" para ajustar tamanho da letra, espaçamento, largura da coluna, tema e alinhamento.',
      'São quatro temas: Claro, Sépia, Escuro e Noite azul. O botão de tema, no alto, passa por eles em ordem — do papel ao mais escuro. O Escuro é cinza-noite, e não preto: contra texto claro, o preto puro cansa a vista numa leitura longa.',
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
      'Ao compartilhar um versículo como imagem, escolha a cor do fundo logo abaixo da prévia: Noite, Papel, Sépia, Azul, Oliveira, Púrpura ou Vinho. A escolha fica guardada para as próximas.',
      'Anotações podem nascer de um versículo ou ser livres, e ficam ligadas ao texto para sempre.',
      { to: '/favoritos', label: 'Abrir favoritos', text: 'Tudo o que você marcar aparece reunido nas telas próprias.' },
    ],
  },
  {
    icon: 'sermon',
    title: 'Preparar um sermão',
    steps: [
      'O sermão é montado em blocos, como se monta no Word: Seção (o subtítulo com o filete), Parágrafo, Destaque (o quadro que chama a atenção), Citação bíblica e Lista.',
      'O sermão novo abre em branco. Toque em "Acrescentar" e escolha o que vai usar: Texto principal, Introdução, Desenvolvimento, Aplicações, Conclusão, Apelo — ou um bloco solto. Nada vem pronto na tela, e o sermão que não tem introdução não fica com uma caixa vazia.',
      'A barra no alto formata o trecho que você selecionou: negrito, itálico, sublinhado e cor. O botão de girar limpa a formatação.',
      'Cada bloco tem os seus botões: trocar o tipo, subir, descer, inserir outro abaixo e excluir. No fim da página, a barra acrescenta um bloco novo do tipo que você escolher.',
      'No bloco Citação bíblica, escreva a referência e toque em "Trazer texto": o versículo vem do próprio aplicativo, com a referência por baixo. O texto bíblico nunca é digitado pelo sistema.',
      'Enter abre um bloco novo; Shift+Enter quebra a linha dentro do mesmo bloco.',
      'O "Texto principal" também vive dentro do painel: escolha-o no "Acrescentar", escreva a referência e toque em "Trazer texto". É essa primeira citação que aparece como subtítulo do sermão na lista e na abertura do Modo Pregação.',
      'O sermão inteiro vive nesse painel único: não há mais campo separado de Texto principal nem de Observações. O que você quiser comentar entra como um bloco, no lugar onde faz sentido. O que já estava escrito nesses campos foi trazido para dentro do sermão.',
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
      'Ele entra na sua lista de sermões como qualquer outro: recebe categoria, etiquetas, e aparece na Biblioteca Ministerial.',
      'Abaixo do documento fica o painel de blocos, em branco: é ali que você escreve o que quer acrescentar ao material importado.',
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
      'O estudo escrito aqui é montado em seções, num painel só. Toque em "Acrescentar seção" e escolha o que quer usar: Texto principal, Introdução, Desenvolvimento, Aplicações, Conclusão ou uma Seção livre com o título que você der. Use quantas quiser, na ordem que quiser, e mova ou apague cada uma pelas setas e pelo × do cabeçalho dela.',
      'Os estudos escritos antes desta mudança abrem com o mesmo conteúdo, já convertido em seções — inclusive o que estava em "Comentários", que vira uma seção com esse nome.',
      'Rhema › Importar › escolha o arquivo. Cada apostila entra como um item da lista, com categoria e etiquetas suas.',
      'A apostila é exibida exatamente como foi feita — fontes, imagens, quadros e quebras de página. Nada é convertido.',
      'O botão "Modo Aula" abre a apostila em tela cheia com a Bíblia à esquerda e o material à direita: é a tela para dar aula. O botão de dividir fecha a Bíblia quando você quiser só estudar.',
      'A linha entre as duas colunas é arrastável: puxe para o lado para dar mais espaço à apostila ou à Bíblia. A posição fica gravada para as próximas vezes.',
      'A Bíblia ao lado é a Bíblia inteira, não um resumo: abre onde você parou de ler, troca de livro pelo nome no alto do painel, troca de tradução no botão da sigla, mostra as suas marcações e deixa marcar, favoritar e copiar versículo ali mesmo — o que você faz ali aparece no leitor, e o que fez no leitor aparece ali.',
      'Os botões A- e A+ da barra de baixo aumentam a página da apostila; os do lado da Bíblia mudam só a letra dela. Cada lado tem o seu, e os dois ficam gravados.',
      'O botão de esquadro apara as margens brancas da folha: como a apostila é A4 e quase um quarto da largura é margem, a letra fica cerca de 25% maior sem precisar ampliar nada. Se alguma página aparecer cortada, toque nele de novo para ver a folha inteira.',
      'A barra de baixo se recolhe sozinha depois de três segundos parada, e some na hora quando você começa a rolar o material. Um toque no documento traz de volta; outro toque recolhe. Recolhida, fica um risquinho no rodapé — toque nele e ela volta.',
      'No Modo Aula há cronômetro e a tela não apaga sozinha, igual ao Modo Pregação.',
      'Você pode escrever suas observações, vincular versículos e criar anotações sobre a apostila — o material continua intacto, o que é seu fica separado.',
      'Formatos aceitos: PDF e Word .docx, até 35 MB cada. As páginas são desenhadas conforme você rola, então apostilas de 60 páginas abrem sem travar.',
    ],
  },
  {
    icon: 'library',
    title: 'Cursos — o material das aulas',
    steps: [
      'A aba Cursos funciona como o Rhema, para o material de aula que você já tem pronto: importe e ensine a partir dele, com a Bíblia ao lado.',
      'Cursos › Importar › escolha o arquivo. Aceita PDF, Word (.docx) e apresentação do PowerPoint (.pptx), até 35 MB cada.',
      'Com o material aberto, a lupa na barra do arquivo procura dentro dele. Numa apostila de sessenta páginas, ela lista os trechos com o número da página — toque num deles e a apostila salta até lá. Acentos não atrapalham: "oracao" acha "oração".',
      'O botão "Modo Aula" abre o material em tela cheia com a Bíblia à esquerda — a mesma tela do Rhema, com cronômetro, divisão arrastável e a tela que não apaga.',
      'Sobre as apresentações: o PDF e o Word saem idênticos ao original. O .pptx é reconstruído pelo aplicativo e chega perto, mas pode escorregar em algum detalhe de desenho. Se algum slide sair diferente, salve a apresentação como PDF no PowerPoint — sai igualzinho.',
      'Os devocionais que você já tinha continuam aqui, com os mesmos campos de sempre: nada se perdeu, a aba só mudou de nome.',
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
      'A- e A+ ajustam a letra só da pregação, sem mexer no tamanho do leitor. Com a Bíblia ao lado, ela tem o próprio A- e A+, e a linha do meio pode ser arrastada para dar mais espaço a um dos lados.',
      'A tela não apaga sozinha enquanto o Modo Pregação estiver aberto.',
    ],
  },
  {
    icon: 'lock',
    title: 'Traduções e direitos autorais',
    steps: [
      'Vêm quatro traduções em português — Almeida, Bíblia Livre, Tradução Brasileira e Almeida 1911 — mais a King James em inglês. Todas em domínio público, livres para usar.',
      'ARA, ARC, NVI, NAA, NTLH, NVT, ACF, KJA, KJF, AS21, NBV, O Livro, A Mensagem e outras têm direitos autorais e não acompanham o aplicativo — mas estão no catálogo esperando a sua cópia.',
      'Tendo o arquivo da tradução, importe por Configurações › Traduções, ou pelo próprio botão da sigla enquanto lê. O texto é gravado só neste aparelho: não sobe para lugar nenhum e não vai junto para quem instalar o app depois.',
      'Se o arquivo tiver o nome da sigla (ARA.json, NVI.json…), o app reconhece sozinho a qual tradução ele pertence — basta escolher o arquivo.',
      'Módulos do MyBible (arquivos .SQLite3) também entram, do jeito que estão. É por aí que vem uma Bíblia com números Strong, como a Bíblia+: os números são guardados junto com o texto. No Android os módulos ficam na pasta MyBible da memória interna.',
      { to: '/config', label: 'Abrir configurações', text: 'A importação aceita arquivos JSON em três formatos diferentes.' },
    ],
  },
  {
    icon: 'search',
    title: 'Palavras no original — números de Strong',
    steps: [
      'Os números de Strong dão um código a cada palavra do hebraico e do grego (H430 para "elohim", G26 para "agapē"). Com eles dá para ver qual palavra original está por trás da tradução.',
      'O léxico de Strong já vem no aplicativo: 8.674 verbetes do hebraico e 5.523 do grego, com o termo original, a transliteração, a pronúncia e a definição. Funciona offline, sem importar nada.',
      'Ele é em inglês — é o único com licença que permite distribuir junto. Se você tiver um léxico em português, importe o módulo (.dictionary.SQLite3) e ele passa a aparecer primeiro, antes do que vem no app.',
      'O que ainda precisa vir de fora é a Bíblia com números Strong: as traduções que acompanham o aplicativo não os trazem, porque essa marcação é trabalho editorial e não existe livre em português.',
      'Ela entra tanto como módulo do MyBible (.SQLite3) quanto como JSON — se o texto do JSON trouxer a marcação <S>430</S> depois da palavra, o app reconhece sozinho. E um JSON sem marcação nenhuma continua entrando como sempre.',
      'Bíblias e dicionários entram pelo mesmo botão, em Configurações › Traduções: o próprio arquivo diz o que é.',
      'Para consultar: toque no versículo e escolha "No original" na barra de ações. O versículo aparece palavra por palavra; toque numa palavra para ver a definição.',
      'A ação "No original" só aparece quando a tradução aberta tem números Strong.',
      { to: '/config', label: 'Abrir configurações', text: 'Os dicionários importados ficam listados junto com as traduções.' },
    ],
  },
  {
    icon: 'download',
    title: 'Backup dos seus dados',
    steps: [
      'Tudo o que você cria fica gravado apenas no seu aparelho. Nada é enviado para servidor nenhum.',
      'Em Configurações › Backup e privacidade o app mostra há quanto tempo você guardou uma cópia fora do aparelho. Enquanto não houver nenhuma, o aviso fica vermelho.',
      'O app também pede ao navegador que não descarte seus dados para liberar espaço — é a linha "Armazenamento protegido". Num app instalado o Chrome costuma conceder sozinho. Isso impede o Android de apagar por conta própria, mas não impede você de limpar os dados do navegador.',
      '"Salvar no Google Drive" abre a folha de compartilhamento do aparelho — escolha Drive, e-mail ou o que preferir. É a cópia que salva de verdade, porque sai do aparelho.',
      '"Baixar o arquivo" guarda no próprio aparelho: no navegador vai para a pasta Download; no aplicativo Android vai para a pasta Documentos, e o aviso na tela diz onde ficou.',
      'O app também guarda sozinho as últimas seis cópias, uma a cada poucos dias. Elas servem para desfazer um engano — apagar um sermão sem querer — e ficam dentro do próprio app: no navegador somem se você limpar os dados dele; no aplicativo Android somem se você desinstalar. Nenhuma das duas substitui a cópia no Drive.',
      'Para restaurar: pelo botão Restaurar de uma cópia da lista, ou em "Restaurar de um arquivo". Nos dois casos o estado atual é gravado antes, para haver caminho de volta.',
      'Marque "Levar também as Bíblias que importei" para que um arquivo só carregue seus sermões e as Bíblias importadas. É assim que se leva tudo do navegador para o aplicativo Android, sem reimportar tradução nenhuma — o arquivo fica bem maior, mas a instalação nova nasce completa.',
      'As apostilas e cursos em PDF, Word e apresentação continuam de fora: não cabem num arquivo de backup. Guarde os originais e importe de novo.',
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

      {/* O mesmo conteúdo em uma página só, para imprimir ou enviar a quem vai
          usar o aplicativo junto. Vive em `public/manual.html`.

          Dentro do aplicativo esse cartão não traz botão nenhum, de propósito.
          Ali não há aba nem barra de endereço: qualquer coisa que substitua a
          tela é um lugar de onde se pode não conseguir voltar, e não vale o
          risco — o conteúdo do manual é o mesmo que está logo abaixo, nos
          tópicos. Imprimir só faz sentido no computador, de qualquer forma. */}
      <div className="card row" style={{ marginBottom: 'var(--sp-4)', gap: 'var(--sp-3)' }}>
        <Icon name="download" size={22} style={{ flex: 'none', color: 'var(--accent-strong)' }} />
        <span className="list-body" style={{ flex: 1, minWidth: 0 }}>
          <span className="list-title">Manual completo</span>
          <span className="list-meta">
            {isNativeApp()
              ? 'Para imprimir ou enviar a alguém, abra o Hub Bible no navegador e use a Ajuda de lá. Aqui, tudo está nos tópicos abaixo.'
              : 'Tudo em uma página só — para imprimir, salvar em PDF ou enviar a quem for usar com você.'}
          </span>
        </span>
        {!isNativeApp() && (
          <a
            className="btn btn-sm"
            href={`${import.meta.env.BASE_URL}manual.html`}
            target="_blank"
            rel="noreferrer"
            style={{ flex: 'none' }}
          >
            Abrir
          </a>
        )}
      </div>

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
