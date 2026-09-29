#!/usr/bin/env node

/**
 * Gera o dicionário teológico do Hub Bible e as famílias semânticas.
 *
 * Produz dois arquivos:
 *   public/reference/theological-dict.json — verbetes de conceitos bíblicos
 *   public/reference/semantic-groups.json  — agrupamento de Strong por família
 *
 * Tudo em português, baseado em fontes de domínio público. Os conceitos seguem
 * a tradição da Palavra da Fé com base na Escritura como autoridade primária.
 *
 * Uso: node scripts/build-theological-dict.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = join(__dirname, '..', 'public', 'reference');
mkdirSync(DIR, { recursive: true });

/* ═══════════════════════════════════════════════════════════════════════════
   DICIONÁRIO TEOLÓGICO
   ═══════════════════════════════════════════════════════════════════════════ */

const dicionario = [
  {
    id: 'justificacao',
    termo: 'Justificação',
    hebraico: { palavra: 'צדק', translit: 'tsadaq', strong: 'H6663' },
    grego: { palavra: 'δικαιόω', translit: 'dikaioō', strong: 'G1344' },
    definicao: 'Ato judicial de Deus pelo qual o pecador é declarado justo com base na obra de Cristo, recebida pela fé. Não é tornar justo (santificação), mas declarar justo — uma mudança de posição diante de Deus, não de condição interior.',
    distincao: 'Justificação é posição (declarada); santificação é processo (vivida); glorificação é destino (consumada).',
    textos: ['ROM.3.24', 'ROM.3.28', 'ROM.4.5', 'ROM.5.1', 'ROM.5.9', 'ROM.8.30', 'GAL.2.16', 'TIT.3.7'],
    relacionados: ['graca', 'fe', 'redencao', 'justica-de-deus'],
  },
  {
    id: 'justica-de-deus',
    termo: 'Justiça de Deus',
    hebraico: { palavra: 'צְדָקָה', translit: 'tsedaqah', strong: 'H6666' },
    grego: { palavra: 'δικαιοσύνη', translit: 'dikaiosynē', strong: 'G1343' },
    definicao: 'A justiça que procede de Deus e é concedida ao crente pela fé, distinta da justiça pela Lei. Em Cristo, o crente é feito "justiça de Deus" — não por mérito, mas por posição na Nova Aliança.',
    textos: ['ROM.1.17', 'ROM.3.21', 'ROM.3.22', 'ROM.10.3', '2CO.5.21', 'PHI.3.9'],
    relacionados: ['justificacao', 'fe', 'nova-alianca'],
  },
  {
    id: 'graca',
    termo: 'Graça',
    hebraico: { palavra: 'חֵן', translit: 'chen', strong: 'H2580' },
    grego: { palavra: 'χάρις', translit: 'charis', strong: 'G5485' },
    definicao: 'Favor imerecido de Deus concedido livremente. Não é apenas perdão, mas capacitação divina: a graça salva (Ef 2.8), ensina (Tt 2.12), fortalece (2Co 12.9) e sustenta toda a vida cristã. É o fundamento, não a exceção.',
    textos: ['EPH.2.8', 'EPH.2.9', 'ROM.3.24', 'ROM.5.17', 'ROM.5.20', 'ROM.6.14', '2CO.12.9', 'TIT.2.11', 'JHN.1.14', 'JHN.1.17'],
    relacionados: ['justificacao', 'fe', 'redencao', 'salvacao'],
  },
  {
    id: 'fe',
    termo: 'Fé',
    hebraico: { palavra: 'אֱמוּנָה', translit: 'emunah', strong: 'H530' },
    grego: { palavra: 'πίστις', translit: 'pistis', strong: 'G4102' },
    definicao: 'Convicção firme naquilo que se espera, certeza do que não se vê (Hb 11.1). No NT, é a resposta do homem à Palavra de Deus — não um sentimento, mas uma decisão de confiança que age. A fé vem pelo ouvir a Palavra (Rm 10.17) e opera pelo amor (Gl 5.6).',
    textos: ['HEB.11.1', 'HEB.11.6', 'ROM.10.17', 'ROM.1.17', 'GAL.2.16', 'GAL.5.6', 'MRK.11.22', 'MRK.11.23'],
    relacionados: ['justificacao', 'palavra', 'confissao', 'oracao'],
  },
  {
    id: 'redencao',
    termo: 'Redenção',
    hebraico: { palavra: 'גָּאַל', translit: "ga'al", strong: 'H1350' },
    grego: { palavra: 'ἀπολύτρωσις', translit: 'apolytrōsis', strong: 'G629' },
    definicao: 'Resgate mediante pagamento de preço. Cristo é o Redentor que comprou a libertação do crente com o próprio sangue (Ef 1.7). O conceito vem do go\'el hebraico — o parente que resgata. No NT, a redenção é completa: do pecado, da maldição da Lei, e de toda escravidão.',
    textos: ['EPH.1.7', 'COL.1.14', 'ROM.3.24', '1PE.1.18', '1PE.1.19', 'GAL.3.13', 'HEB.9.12', 'TIT.2.14'],
    relacionados: ['justificacao', 'graca', 'sangue', 'obra-consumada'],
  },
  {
    id: 'obra-consumada',
    termo: 'Obra consumada de Cristo',
    grego: { palavra: 'τετέλεσται', translit: 'tetelestai', strong: 'G5055' },
    definicao: '"Está consumado" (Jo 19.30) — o perfeito passivo de teleō: a obra foi completada e permanece completa. Cristo não precisa morrer de novo; o sacrifício é irrepetível (Hb 10.10,14). O crente descansa numa obra já feita, não numa obra por fazer.',
    textos: ['JHN.19.30', 'HEB.1.3', 'HEB.10.10', 'HEB.10.14', 'COL.2.14', 'COL.2.15', 'ROM.6.9', 'ROM.6.10'],
    relacionados: ['redencao', 'justificacao', 'sacerdocio'],
  },
  {
    id: 'nova-criacao',
    termo: 'Nova criação',
    grego: { palavra: 'καινὴ κτίσις', translit: 'kainē ktisis', strong: 'G2537+G2937' },
    definicao: 'Quem está em Cristo é nova criação: as coisas velhas passaram, tudo se fez novo (2Co 5.17). Não é reforma do velho homem, mas nascimento de um novo ser espiritual — com nova natureza, nova posição e nova identidade diante de Deus.',
    textos: ['2CO.5.17', 'GAL.6.15', 'EPH.2.10', 'EPH.4.24', 'COL.3.10', 'JHN.3.3', 'JHN.3.5', '1PE.1.23'],
    relacionados: ['identidade-em-cristo', 'santificacao', 'espirito-santo'],
  },
  {
    id: 'identidade-em-cristo',
    termo: 'Identidade em Cristo',
    grego: { palavra: 'ἐν Χριστῷ', translit: 'en Christō' },
    definicao: 'A expressão "em Cristo" (en Christō) aparece mais de 80 vezes no NT. Descreve a posição do crente: justificado, santificado, aceito, herdeiro, assentado nos lugares celestiais. Não é algo a conquistar — é algo a reconhecer pela fé.',
    textos: ['EPH.1.3', 'EPH.1.4', 'EPH.2.6', 'ROM.8.1', '1CO.1.30', '2CO.5.17', '2CO.5.21', 'COL.2.10', 'GAL.2.20'],
    relacionados: ['nova-criacao', 'justificacao', 'filiacao'],
  },
  {
    id: 'filiacao',
    termo: 'Filiação / Adoção',
    grego: { palavra: 'υἱοθεσία', translit: 'huiothesia', strong: 'G5206' },
    definicao: 'No mundo romano, a adoção conferia todos os direitos do filho natural. Paulo usa essa imagem: o crente recebe o Espírito de adoção e clama "Aba, Pai". Não é ser tratado como filho — é ser filho, com direito à herança.',
    textos: ['ROM.8.15', 'ROM.8.16', 'ROM.8.17', 'GAL.4.4', 'GAL.4.5', 'GAL.4.6', 'GAL.4.7', 'EPH.1.5'],
    relacionados: ['identidade-em-cristo', 'espirito-santo', 'heranca'],
  },
  {
    id: 'espirito-santo',
    termo: 'Espírito Santo',
    hebraico: { palavra: 'רוּחַ הַקֹּדֶשׁ', translit: 'ruach haqqodesh' },
    grego: { palavra: 'Πνεῦμα Ἅγιον', translit: 'Pneuma Hagion', strong: 'G4151+G40' },
    definicao: 'A terceira pessoa da Trindade, não uma força impessoal. Habita no crente (1Co 6.19), guia (Rm 8.14), ensina (Jo 14.26), convence (Jo 16.8), fortalece (At 1.8), distribui dons (1Co 12.11) e produz fruto (Gl 5.22). É a presença de Deus vivendo no crente.',
    textos: ['JHN.14.16', 'JHN.14.26', 'JHN.16.13', 'ACT.1.8', 'ACT.2.4', 'ROM.8.9', 'ROM.8.11', '1CO.6.19', 'GAL.5.22', 'EPH.1.13'],
    relacionados: ['dons', 'batismo-espirito', 'fruto-espirito'],
  },
  {
    id: 'dons',
    termo: 'Dons espirituais',
    grego: { palavra: 'χάρισμα', translit: 'charisma', strong: 'G5486' },
    definicao: 'Capacitações sobrenaturais concedidas pelo Espírito Santo para edificação da igreja. Incluem palavra de sabedoria, palavra de ciência, fé, dons de cura, operação de milagres, profecia, discernimento de espíritos, variedade de línguas e interpretação (1Co 12.8-10). São para hoje — não cessaram.',
    textos: ['1CO.12.4', '1CO.12.7', '1CO.12.8', '1CO.12.9', '1CO.12.10', '1CO.12.11', 'ROM.12.6', 'EPH.4.11'],
    relacionados: ['espirito-santo', 'autoridade', 'cura'],
  },
  {
    id: 'autoridade',
    termo: 'Autoridade do crente',
    grego: { palavra: 'ἐξουσία', translit: 'exousia', strong: 'G1849' },
    definicao: 'Direito delegado, não força própria. Cristo recebeu toda autoridade (Mt 28.18) e a delegou aos que creem (Lc 10.19). Exousia é o direito legal de agir; dynamis (G1411) é o poder para executar. O crente tem ambos — em nome de Jesus.',
    distincao: 'Exousia (G1849) = autoridade, direito delegado. Dynamis (G1411) = poder, capacidade. Kratos (G2904) = domínio, força exercida. Ischys (G2479) = vigor inerente.',
    textos: ['LUK.10.19', 'MAT.28.18', 'MRK.16.17', 'EPH.1.19', 'EPH.1.20', 'EPH.1.21', 'EPH.2.6', 'COL.2.10', 'COL.2.15', 'PHI.2.9', 'PHI.2.10'],
    relacionados: ['identidade-em-cristo', 'nome-de-jesus', 'espirito-santo'],
  },
  {
    id: 'cura',
    termo: 'Cura',
    hebraico: { palavra: 'רָפָא', translit: 'rapha', strong: 'H7495' },
    grego: { palavra: 'ἰάομαι', translit: 'iaomai', strong: 'G2390' },
    definicao: 'Restauração física, emocional ou espiritual pela intervenção de Deus. O ministério de cura de Jesus cumpre Isaías 53.4. Therapeuō (G2323) enfatiza o cuidado; iaomai enfatiza a cura instantânea; sōzō (G4982) abrange salvação integral. Os dons de cura continuam operando na igreja.',
    distincao: 'Rapha (H7495) = curar, restaurar. Therapeuō (G2323) = cuidar, tratar. Iaomai (G2390) = curar (instantâneo). Sōzō (G4982) = salvar, curar, libertar (integral).',
    textos: ['ISA.53.4', 'ISA.53.5', 'MAT.8.17', '1PE.2.24', 'PSA.103.3', 'EXO.15.26', 'MRK.16.18', 'JAS.5.14', 'JAS.5.15', 'ACT.10.38'],
    relacionados: ['obra-consumada', 'redencao', 'dons', 'oracao'],
  },
  {
    id: 'palavra',
    termo: 'Palavra de Deus',
    hebraico: { palavra: 'דָּבָר', translit: 'dabar', strong: 'H1697' },
    grego: { palavra: 'λόγος / ῥῆμα', translit: 'logos / rhēma', strong: 'G3056 / G4487' },
    definicao: 'Logos (G3056) é a Palavra eterna e total — o plano revelado de Deus, e o próprio Cristo (Jo 1.1). Rhēma (G4487) é a palavra falada, a porção da Escritura que o Espírito vivifica para uma situação concreta (Rm 10.17). A fé nasce do rhēma — a Palavra que se ouve.',
    distincao: 'Logos (G3056) = a Palavra como totalidade, o plano, a pessoa de Cristo. Rhēma (G4487) = a palavra falada, a porção viva e presente. Dabar (H1697) = no AT, palavra e acontecimento são a mesma coisa — a Palavra de Deus age.',
    textos: ['JHN.1.1', 'JHN.1.14', 'ROM.10.17', 'HEB.4.12', 'EPH.6.17', 'ISA.55.11', 'JER.1.12', 'PSA.119.105'],
    relacionados: ['fe', 'confissao', 'oracao'],
  },
  {
    id: 'confissao',
    termo: 'Confissão',
    grego: { palavra: 'ὁμολογέω', translit: 'homologeō', strong: 'G3670' },
    definicao: 'Literalmente "dizer a mesma coisa" (homo + logeō). Confessar é concordar com Deus — dizer sobre si o que a Palavra diz. Não é repetição mecânica, mas alinhamento do coração e da boca com a verdade revelada (Rm 10.9-10). A confissão de fé não cria realidade — reconhece o que Cristo já fez.',
    textos: ['ROM.10.9', 'ROM.10.10', 'HEB.3.1', 'HEB.4.14', 'HEB.10.23', '2CO.4.13', 'PRO.18.21'],
    relacionados: ['fe', 'palavra', 'oracao'],
  },
  {
    id: 'oracao',
    termo: 'Oração',
    hebraico: { palavra: 'תְּפִלָּה', translit: 'tephillah', strong: 'H8605' },
    grego: { palavra: 'προσευχή', translit: 'proseuchē', strong: 'G4335' },
    definicao: 'Comunhão com Deus — não um ritual, mas uma conversa. Inclui adoração, petição, intercessão, ação de graças e oração no Espírito. Jesus ensinou a orar com confiança, no nome dele (Jo 16.23-24). A oração da fé salva o doente (Tg 5.15) e produz muito em seus efeitos (Tg 5.16).',
    textos: ['JHN.16.23', 'JHN.16.24', 'PHI.4.6', 'MRK.11.24', '1JN.5.14', 'JAS.5.16', 'EPH.6.18', 'ROM.8.26', 'HEB.4.16'],
    relacionados: ['fe', 'confissao', 'espirito-santo', 'autoridade'],
  },
  {
    id: 'sangue',
    termo: 'Sangue de Cristo',
    grego: { palavra: 'αἷμα', translit: 'haima', strong: 'G129' },
    definicao: 'O sangue derramado na cruz é o preço da redenção (1Pe 1.19), o meio da justificação (Rm 5.9), a base da Nova Aliança (Lc 22.20), e a porta do acesso a Deus (Hb 10.19). "Sem derramamento de sangue não há remissão" (Hb 9.22) — e o sangue de Cristo foi oferecido uma vez por todas.',
    textos: ['ROM.5.9', 'EPH.1.7', 'HEB.9.12', 'HEB.9.22', 'HEB.10.19', '1PE.1.19', 'REV.12.11', '1JN.1.7', 'COL.1.20', 'LEV.17.11'],
    relacionados: ['redencao', 'obra-consumada', 'nova-alianca', 'justificacao'],
  },
  {
    id: 'santificacao',
    termo: 'Santificação',
    hebraico: { palavra: 'קָדַשׁ', translit: 'qadash', strong: 'H6942' },
    grego: { palavra: 'ἁγιασμός', translit: 'hagiasmos', strong: 'G38' },
    definicao: 'Separação para Deus e conformação progressiva à imagem de Cristo. Posicionalmente, o crente já foi santificado (1Co 6.11; Hb 10.10). Na prática, a santificação é vivida dia a dia, pelo Espírito (Gl 5.16), pela Palavra (Jo 17.17) e pela renovação da mente (Rm 12.2).',
    distincao: 'Justificação: Deus declara justo (posição). Santificação: Deus separa e transforma (processo). Glorificação: Deus completa a obra (destino).',
    textos: ['1TH.4.3', '1TH.5.23', 'HEB.12.14', 'ROM.6.11', 'ROM.6.13', 'ROM.12.1', 'ROM.12.2', 'JHN.17.17', '1CO.6.11', 'HEB.10.10'],
    relacionados: ['justificacao', 'nova-criacao', 'espirito-santo'],
  },
  {
    id: 'nova-alianca',
    termo: 'Nova Aliança',
    hebraico: { palavra: 'בְּרִית חֲדָשָׁה', translit: 'berit chadashah' },
    grego: { palavra: 'καινὴ διαθήκη', translit: 'kainē diathēkē', strong: 'G2537+G1242' },
    definicao: 'A aliança profetizada em Jeremias 31.31-34 e inaugurada pelo sangue de Cristo (Lc 22.20). Nela, a lei é escrita no coração, o conhecimento de Deus é direto, e os pecados são perdoados de uma vez. É melhor que a antiga em tudo (Hb 8.6) — e é eterna.',
    textos: ['JER.31.31', 'JER.31.33', 'JER.31.34', 'HEB.8.8', 'HEB.8.10', 'HEB.8.12', 'HEB.8.13', 'LUK.22.20', '2CO.3.6', 'HEB.12.24'],
    relacionados: ['sangue', 'obra-consumada', 'espirito-santo', 'justificacao'],
  },
  {
    id: 'provisao',
    termo: 'Provisão',
    hebraico: { palavra: 'בְּרָכָה', translit: 'berakah', strong: 'H1293' },
    grego: { palavra: 'εὐοδόω', translit: 'euodoō', strong: 'G2137' },
    definicao: 'Deus é provedor — Jeová-Jiré (Gn 22.14). A provisão bíblica abrange todas as necessidades (Fp 4.19), não apenas dinheiro. Inclui bênção no trabalho (Dt 28.8), generosidade que multiplica (2Co 9.6-11) e contentamento que liberta da ansiedade (Mt 6.33). Prosperidade não é o evangelho, mas é parte da bênção da aliança.',
    textos: ['PHI.4.19', '2CO.9.8', '2CO.9.10', '2CO.9.11', 'PSA.23.1', 'MAT.6.33', '3JN.1.2', 'DEU.28.8', 'PRO.10.22', 'MAL.3.10'],
    relacionados: ['graca', 'fe', 'nova-alianca'],
  },
  {
    id: 'salvacao',
    termo: 'Salvação',
    hebraico: { palavra: 'יְשׁוּעָה', translit: "yeshu'ah", strong: 'H3444' },
    grego: { palavra: 'σωτηρία', translit: 'sōtēria', strong: 'G4991' },
    definicao: 'Livramento completo: do pecado (justificação), do poder do pecado (santificação) e da presença do pecado (glorificação). O próprio nome de Jesus (Yeshua) significa salvação. É pela graça, mediante a fé (Ef 2.8), e não por obras — um dom de Deus.',
    textos: ['EPH.2.8', 'EPH.2.9', 'ROM.1.16', 'ROM.10.9', 'ROM.10.10', 'ACT.4.12', 'TIT.3.5', '2TI.1.9', 'HEB.2.3'],
    relacionados: ['graca', 'fe', 'justificacao', 'redencao'],
  },
  {
    id: 'sacerdocio',
    termo: 'Sacerdócio de Cristo',
    grego: { palavra: 'ἀρχιερεύς', translit: 'archiereus', strong: 'G749' },
    definicao: 'Cristo é sumo sacerdote segundo a ordem de Melquisedeque — superior ao sacerdócio levítico (Hb 7). Ofereceu a si mesmo uma vez por todas (Hb 10.12), entrou no santuário celestial (Hb 9.24), e vive para interceder pelos seus (Hb 7.25). Todo crente tem acesso direto a Deus por meio dele.',
    textos: ['HEB.4.14', 'HEB.4.15', 'HEB.4.16', 'HEB.7.17', 'HEB.7.25', 'HEB.9.12', 'HEB.9.24', 'HEB.10.12', 'HEB.10.19', 'PSA.110.4'],
    relacionados: ['obra-consumada', 'sangue', 'nova-alianca', 'oracao'],
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   FAMÍLIAS SEMÂNTICAS
   ═══════════════════════════════════════════════════════════════════════════ */

const familias = [
  {
    id: 'dik-',
    nome: 'Família δικ- (justiça)',
    descricao: 'Raiz grega ligada a justiça, justo, justificação.',
    termos: [
      { strong: 'G1342', lemma: 'δίκαιος', translit: 'dikaios', sentido: 'justo, reto' },
      { strong: 'G1343', lemma: 'δικαιοσύνη', translit: 'dikaiosynē', sentido: 'justiça, retidão' },
      { strong: 'G1344', lemma: 'δικαιόω', translit: 'dikaioō', sentido: 'justificar, declarar justo' },
      { strong: 'G1345', lemma: 'δικαίωμα', translit: 'dikaiōma', sentido: 'decreto justo, ordenança' },
      { strong: 'G1346', lemma: 'δικαίως', translit: 'dikaiōs', sentido: 'justamente' },
      { strong: 'G1347', lemma: 'δικαίωσις', translit: 'dikaiōsis', sentido: 'justificação (ato)' },
    ],
    dicionario: 'justificacao',
  },
  {
    id: 'pist-',
    nome: 'Família πιστ- (fé)',
    descricao: 'Raiz grega ligada a fé, fidelidade, crer.',
    termos: [
      { strong: 'G4100', lemma: 'πιστεύω', translit: 'pisteuō', sentido: 'crer, confiar' },
      { strong: 'G4102', lemma: 'πίστις', translit: 'pistis', sentido: 'fé, confiança, fidelidade' },
      { strong: 'G4103', lemma: 'πιστός', translit: 'pistos', sentido: 'fiel, digno de confiança' },
      { strong: 'G4104', lemma: 'πιστόω', translit: 'pistoō', sentido: 'assegurar, confirmar' },
      { strong: 'G570', lemma: 'ἀπιστία', translit: 'apistia', sentido: 'incredulidade' },
      { strong: 'G571', lemma: 'ἄπιστος', translit: 'apistos', sentido: 'incrédulo' },
    ],
    dicionario: 'fe',
  },
  {
    id: 'char-',
    nome: 'Família χαρ- (graça/alegria)',
    descricao: 'Raiz grega ligada a graça, dom, alegria, agradecimento.',
    termos: [
      { strong: 'G5485', lemma: 'χάρις', translit: 'charis', sentido: 'graça, favor' },
      { strong: 'G5486', lemma: 'χάρισμα', translit: 'charisma', sentido: 'dom gracioso' },
      { strong: 'G5483', lemma: 'χαρίζομαι', translit: 'charizomai', sentido: 'conceder livremente, perdoar' },
      { strong: 'G5463', lemma: 'χαίρω', translit: 'chairō', sentido: 'alegrar-se, regozijar-se' },
      { strong: 'G5479', lemma: 'χαρά', translit: 'chara', sentido: 'alegria, gozo' },
      { strong: 'G5487', lemma: 'χαριτόω', translit: 'charitoō', sentido: 'agraciar, tornar aceito' },
    ],
    dicionario: 'graca',
  },
  {
    id: 'sōz-',
    nome: 'Família σωζ- (salvação)',
    descricao: 'Raiz grega ligada a salvar, salvação, cura integral.',
    termos: [
      { strong: 'G4982', lemma: 'σώζω', translit: 'sōzō', sentido: 'salvar, curar, libertar' },
      { strong: 'G4991', lemma: 'σωτηρία', translit: 'sōtēria', sentido: 'salvação, livramento' },
      { strong: 'G4990', lemma: 'σωτήρ', translit: 'sōtēr', sentido: 'salvador, libertador' },
      { strong: 'G4992', lemma: 'σωτήριον', translit: 'sōtērion', sentido: 'salvação (adjetivo substantivado)' },
    ],
    dicionario: 'salvacao',
  },
  {
    id: 'hagi-',
    nome: 'Família ἁγ- (santo)',
    descricao: 'Raiz grega ligada a santo, santificação, separação.',
    termos: [
      { strong: 'G40', lemma: 'ἅγιος', translit: 'hagios', sentido: 'santo, separado, consagrado' },
      { strong: 'G37', lemma: 'ἁγιάζω', translit: 'hagiazō', sentido: 'santificar, consagrar' },
      { strong: 'G38', lemma: 'ἁγιασμός', translit: 'hagiasmos', sentido: 'santificação' },
      { strong: 'G41', lemma: 'ἁγιότης', translit: 'hagiotēs', sentido: 'santidade' },
      { strong: 'G42', lemma: 'ἁγιωσύνη', translit: 'hagiōsynē', sentido: 'santidade (qualidade)' },
    ],
    dicionario: 'santificacao',
  },
  {
    id: 'dynam-',
    nome: 'Família δυναμ- (poder)',
    descricao: 'Raiz grega ligada a poder, capacidade, milagre.',
    termos: [
      { strong: 'G1411', lemma: 'δύναμις', translit: 'dynamis', sentido: 'poder, capacidade, milagre' },
      { strong: 'G1410', lemma: 'δύναμαι', translit: 'dynamai', sentido: 'ser capaz, ter poder' },
      { strong: 'G1412', lemma: 'δυναμόω', translit: 'dynamoō', sentido: 'fortalecer' },
      { strong: 'G1743', lemma: 'ἐνδυναμόω', translit: 'endynamoō', sentido: 'fortalecer interiormente' },
      { strong: 'G1415', lemma: 'δυνατός', translit: 'dynatos', sentido: 'poderoso, possível' },
    ],
    dicionario: 'autoridade',
  },
  {
    id: 'lytr-',
    nome: 'Família λυτρ- (redenção)',
    descricao: 'Raiz grega ligada a resgate, redenção, preço.',
    termos: [
      { strong: 'G3083', lemma: 'λύτρον', translit: 'lytron', sentido: 'preço de resgate' },
      { strong: 'G3084', lemma: 'λυτρόω', translit: 'lytroō', sentido: 'redimir, resgatar' },
      { strong: 'G3085', lemma: 'λύτρωσις', translit: 'lytrōsis', sentido: 'redenção, resgate' },
      { strong: 'G629', lemma: 'ἀπολύτρωσις', translit: 'apolytrōsis', sentido: 'redenção plena' },
    ],
    dicionario: 'redencao',
  },
  {
    id: 'tsedek',
    nome: 'Família צדק (justiça — hebraico)',
    descricao: 'Raiz hebraica ligada a justiça, retidão, justo.',
    termos: [
      { strong: 'H6663', lemma: 'צָדַק', translit: 'tsadaq', sentido: 'ser justo, ser justificado' },
      { strong: 'H6664', lemma: 'צֶדֶק', translit: 'tsedeq', sentido: 'justiça, retidão' },
      { strong: 'H6666', lemma: 'צְדָקָה', translit: 'tsedaqah', sentido: 'justiça, retidão (abstrato)' },
      { strong: 'H6662', lemma: 'צַדִּיק', translit: 'tsaddiq', sentido: 'justo, reto' },
    ],
    dicionario: 'justica-de-deus',
  },
  {
    id: 'rapha',
    nome: 'Família רפא (cura — hebraico)',
    descricao: 'Raiz hebraica ligada a curar, sarar, restaurar.',
    termos: [
      { strong: 'H7495', lemma: 'רָפָא', translit: "rapha'", sentido: 'curar, sarar' },
      { strong: 'H7499', lemma: 'רְפוּאָה', translit: "rephu'ah", sentido: 'cura, remédio' },
      { strong: 'H4832', lemma: 'מַרְפֵּא', translit: "marpe'", sentido: 'cura, saúde' },
    ],
    dicionario: 'cura',
  },
  {
    id: 'emun',
    nome: 'Família אמן (fé/fidelidade — hebraico)',
    descricao: 'Raiz hebraica ligada a fé, fidelidade, firmeza, amém.',
    termos: [
      { strong: 'H539', lemma: 'אָמַן', translit: 'aman', sentido: 'ser firme, crer, confiar' },
      { strong: 'H530', lemma: 'אֱמוּנָה', translit: 'emunah', sentido: 'fidelidade, firmeza, fé' },
      { strong: 'H571', lemma: 'אֶמֶת', translit: 'emet', sentido: 'verdade, fidelidade' },
      { strong: 'H543', lemma: 'אָמֵן', translit: 'amen', sentido: 'amém, assim seja, firme' },
    ],
    dicionario: 'fe',
  },
];

// Grava os arquivos
writeFileSync(join(DIR, 'theological-dict.json'), JSON.stringify(dicionario));
writeFileSync(join(DIR, 'semantic-groups.json'), JSON.stringify(familias));

console.log(`Dicionário teológico: ${dicionario.length} verbetes.`);
console.log(`Famílias semânticas: ${familias.length} grupos, ${familias.reduce((s, f) => s + f.termos.length, 0)} termos.`);
console.log(`Gravados em ${DIR}/`);
