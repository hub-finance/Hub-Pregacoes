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
    definicao: 'Quando você aceita Cristo, Deus te declara justo — como se você nunca tivesse pecado. Não é porque você melhorou, é porque Cristo pagou. É uma decisão de Deus a seu favor, não um processo de mudança. A mudança vem depois (santificação).',
    distincao: 'Justificação: Deus te declara justo (acontece de uma vez). Santificação: Deus te transforma no dia a dia (é um processo). Glorificação: Deus completa tudo na eternidade (é o destino final).',
    textos: ['ROM.3.24', 'ROM.3.28', 'ROM.4.5', 'ROM.5.1', 'ROM.5.9', 'ROM.8.30', 'GAL.2.16', 'TIT.3.7'],
    relacionados: ['graca', 'fe', 'redencao', 'justica-de-deus'],
  },
  {
    id: 'justica-de-deus',
    termo: 'Justiça de Deus',
    hebraico: { palavra: 'צְדָקָה', translit: 'tsedaqah', strong: 'H6666' },
    grego: { palavra: 'δικαιοσύνη', translit: 'dikaiosynē', strong: 'G1343' },
    definicao: 'Não é a justiça que você conquista cumprindo regras — é a justiça que Deus te dá de presente pela fé. Em Cristo, você é feito "justiça de Deus" (2Co 5.21). Não é mérito seu, é posição que Cristo comprou para você.',
    textos: ['ROM.1.17', 'ROM.3.21', 'ROM.3.22', 'ROM.10.3', '2CO.5.21', 'PHI.3.9'],
    relacionados: ['justificacao', 'fe', 'nova-alianca'],
  },
  {
    id: 'graca',
    termo: 'Graça',
    hebraico: { palavra: 'חֵן', translit: 'chen', strong: 'H2580' },
    grego: { palavra: 'χάρις', translit: 'charis', strong: 'G5485' },
    definicao: 'É Deus fazendo por você o que você não consegue fazer por si mesmo — de graça, sem você merecer. A graça não é só o perdão: ela salva (Ef 2.8), ensina a viver (Tt 2.12), dá forças na fraqueza (2Co 12.9) e sustenta o crente todos os dias.',
    textos: ['EPH.2.8', 'EPH.2.9', 'ROM.3.24', 'ROM.5.17', 'ROM.5.20', 'ROM.6.14', '2CO.12.9', 'TIT.2.11', 'JHN.1.14', 'JHN.1.17'],
    relacionados: ['justificacao', 'fe', 'redencao', 'salvacao'],
  },
  {
    id: 'fe',
    termo: 'Fé',
    hebraico: { palavra: 'אֱמוּנָה', translit: 'emunah', strong: 'H530' },
    grego: { palavra: 'πίστις', translit: 'pistis', strong: 'G4102' },
    definicao: 'É a certeza do que Deus prometeu, mesmo sem ver ainda (Hb 11.1). Não é um sentimento — é uma decisão de confiar na Palavra de Deus e agir de acordo. A fé nasce quando você ouve a Palavra (Rm 10.17) e funciona pelo amor (Gl 5.6).',
    textos: ['HEB.11.1', 'HEB.11.6', 'ROM.10.17', 'ROM.1.17', 'GAL.2.16', 'GAL.5.6', 'MRK.11.22', 'MRK.11.23'],
    relacionados: ['justificacao', 'palavra', 'confissao', 'oracao'],
  },
  {
    id: 'redencao',
    termo: 'Redenção',
    hebraico: { palavra: 'גָּאַל', translit: "ga'al", strong: 'H1350' },
    grego: { palavra: 'ἀπολύτρωσις', translit: 'apolytrōsis', strong: 'G629' },
    definicao: 'É ser comprado de volta. Cristo pagou com o próprio sangue para te tirar da escravidão do pecado (Ef 1.7). No AT, o "go\'el" era o parente que pagava a dívida da família para libertar o devedor. Jesus é esse parente — Ele pagou o preço completo.',
    textos: ['EPH.1.7', 'COL.1.14', 'ROM.3.24', '1PE.1.18', '1PE.1.19', 'GAL.3.13', 'HEB.9.12', 'TIT.2.14'],
    relacionados: ['justificacao', 'graca', 'sangue', 'obra-consumada'],
  },
  {
    id: 'obra-consumada',
    termo: 'Obra consumada de Cristo',
    grego: { palavra: 'τετέλεσται', translit: 'tetelestai', strong: 'G5055' },
    definicao: 'Na cruz, Jesus disse: "Está consumado" (Jo 19.30). Significa: está pago, está feito, está completo. Ele não precisa morrer de novo. O sacrifício foi único e definitivo (Hb 10.10,14). Você descansa numa obra já feita — não precisa completar nada.',
    textos: ['JHN.19.30', 'HEB.1.3', 'HEB.10.10', 'HEB.10.14', 'COL.2.14', 'COL.2.15', 'ROM.6.9', 'ROM.6.10'],
    relacionados: ['redencao', 'justificacao', 'sacerdocio'],
  },
  {
    id: 'nova-criacao',
    termo: 'Nova criação',
    grego: { palavra: 'καινὴ κτίσις', translit: 'kainē ktisis', strong: 'G2537+G2937' },
    definicao: 'Quando você nasce de novo, Deus não reforma o que você era — Ele cria algo novo (2Co 5.17). Você recebe uma nova natureza, uma nova identidade. O velho ficou para trás. É como nascer de novo por dentro: novo espírito, nova vida.',
    textos: ['2CO.5.17', 'GAL.6.15', 'EPH.2.10', 'EPH.4.24', 'COL.3.10', 'JHN.3.3', 'JHN.3.5', '1PE.1.23'],
    relacionados: ['identidade-em-cristo', 'santificacao', 'espirito-santo'],
  },
  {
    id: 'identidade-em-cristo',
    termo: 'Identidade em Cristo',
    grego: { palavra: 'ἐν Χριστῷ', translit: 'en Christō' },
    definicao: 'Paulo usa "em Cristo" mais de 80 vezes no NT. É quem você é agora: justo, aceito, herdeiro, assentado com Cristo nos céus (Ef 2.6). Não é algo que você precisa conquistar — já é seu. Você precisa saber e crer.',
    textos: ['EPH.1.3', 'EPH.1.4', 'EPH.2.6', 'ROM.8.1', '1CO.1.30', '2CO.5.17', '2CO.5.21', 'COL.2.10', 'GAL.2.20'],
    relacionados: ['nova-criacao', 'justificacao', 'filiacao'],
  },
  {
    id: 'filiacao',
    termo: 'Filiação / Adoção',
    grego: { palavra: 'υἱοθεσία', translit: 'huiothesia', strong: 'G5206' },
    definicao: 'Você não é um empregado de Deus — é filho. Na época de Paulo, o filho adotado tinha os mesmos direitos do filho de sangue. O Espírito dentro de você clama "Aba, Pai" (que é como dizer "Papai" — Rm 8.15). Se é filho, também é herdeiro (Rm 8.17).',
    textos: ['ROM.8.15', 'ROM.8.16', 'ROM.8.17', 'GAL.4.4', 'GAL.4.5', 'GAL.4.6', 'GAL.4.7', 'EPH.1.5'],
    relacionados: ['identidade-em-cristo', 'espirito-santo', 'heranca'],
  },
  {
    id: 'espirito-santo',
    termo: 'Espírito Santo',
    hebraico: { palavra: 'רוּחַ הַקֹּדֶשׁ', translit: 'ruach haqqodesh' },
    grego: { palavra: 'Πνεῦμα Ἅγιον', translit: 'Pneuma Hagion', strong: 'G4151+G40' },
    definicao: 'Não é uma força — é uma pessoa. É o próprio Deus morando dentro de você (1Co 6.19). Ele guia, ensina, convence, fortalece, distribui dons e produz fruto na sua vida. Desde o dia em que você creu, o Espírito Santo vive em você.',
    textos: ['JHN.14.16', 'JHN.14.26', 'JHN.16.13', 'ACT.1.8', 'ACT.2.4', 'ROM.8.9', 'ROM.8.11', '1CO.6.19', 'GAL.5.22', 'EPH.1.13'],
    relacionados: ['dons', 'batismo-espirito', 'fruto-espirito'],
  },
  {
    id: 'dons',
    termo: 'Dons espirituais',
    grego: { palavra: 'χάρισμα', translit: 'charisma', strong: 'G5486' },
    definicao: 'São habilidades sobrenaturais que o Espírito Santo dá para servir na igreja: sabedoria, ciência, fé, cura, milagres, profecia, discernimento, línguas e interpretação (1Co 12.8-10). Não são para exibição — são para edificar os outros. São para hoje, não cessaram.',
    textos: ['1CO.12.4', '1CO.12.7', '1CO.12.8', '1CO.12.9', '1CO.12.10', '1CO.12.11', 'ROM.12.6', 'EPH.4.11'],
    relacionados: ['espirito-santo', 'autoridade', 'cura'],
  },
  {
    id: 'autoridade',
    termo: 'Autoridade do crente',
    grego: { palavra: 'ἐξουσία', translit: 'exousia', strong: 'G1849' },
    definicao: 'Jesus recebeu toda autoridade e passou para quem crê (Lc 10.19, Mt 28.18). É como uma procuração: você age em nome dEle. No grego, exousia é o direito de agir; dynamis é a força para fazer. Você tem os dois — no nome de Jesus.',
    distincao: 'Exousia = o direito, a autorização (como uma procuração). Dynamis = a força, o poder para executar. Kratos = o domínio, a força em ação. Ischys = a capacidade interior.',
    textos: ['LUK.10.19', 'MAT.28.18', 'MRK.16.17', 'EPH.1.19', 'EPH.1.20', 'EPH.1.21', 'EPH.2.6', 'COL.2.10', 'COL.2.15', 'PHI.2.9', 'PHI.2.10'],
    relacionados: ['identidade-em-cristo', 'nome-de-jesus', 'espirito-santo'],
  },
  {
    id: 'cura',
    termo: 'Cura',
    hebraico: { palavra: 'רָפָא', translit: 'rapha', strong: 'H7495' },
    grego: { palavra: 'ἰάομαι', translit: 'iaomai', strong: 'G2390' },
    definicao: 'Deus cura — o corpo, as emoções e o espírito. Jesus cumpriu Isaías 53.4: "Ele tomou sobre si as nossas enfermidades." No grego, a Bíblia usa palavras diferentes para tipos de cura: o cuidado passo a passo, a cura instantânea, e a salvação completa que restaura tudo.',
    distincao: 'Rapha (hebraico) = curar, restaurar. Therapeuō = cuidar, tratar (como um médico). Iaomai = cura instantânea, de uma vez. Sōzō = salvar de tudo: pecado, doença, destruição.',
    textos: ['ISA.53.4', 'ISA.53.5', 'MAT.8.17', '1PE.2.24', 'PSA.103.3', 'EXO.15.26', 'MRK.16.18', 'JAS.5.14', 'JAS.5.15', 'ACT.10.38'],
    relacionados: ['obra-consumada', 'redencao', 'dons', 'oracao'],
  },
  {
    id: 'palavra',
    termo: 'Palavra de Deus',
    hebraico: { palavra: 'דָּבָר', translit: 'dabar', strong: 'H1697' },
    grego: { palavra: 'λόγος / ῥῆμα', translit: 'logos / rhēma', strong: 'G3056 / G4487' },
    definicao: 'Logos é a Palavra completa de Deus — tudo o que Ele revelou, e o próprio Cristo (Jo 1.1). Rhēma é quando um versículo "acende" no seu coração para uma situação — a Palavra viva e presente. A fé nasce do rhēma: você ouve, crê e age (Rm 10.17).',
    distincao: 'Logos = a Bíblia como um todo, o plano de Deus, Cristo. Rhēma = o versículo que o Espírito traz vivo ao seu coração agora. Dabar (hebraico) = no AT, a Palavra de Deus e o acontecimento são a mesma coisa — quando Deus fala, acontece.',
    textos: ['JHN.1.1', 'JHN.1.14', 'ROM.10.17', 'HEB.4.12', 'EPH.6.17', 'ISA.55.11', 'JER.1.12', 'PSA.119.105'],
    relacionados: ['fe', 'confissao', 'oracao'],
  },
  {
    id: 'confissao',
    termo: 'Confissão',
    grego: { palavra: 'ὁμολογέω', translit: 'homologeō', strong: 'G3670' },
    definicao: 'No grego, "confessar" é "dizer a mesma coisa que Deus diz". Não é repetir palavras como fórmula mágica — é concordar com a Palavra de coração e de boca (Rm 10.9-10). Quando você confessa o que Cristo fez, não está criando nada — está reconhecendo o que já é verdade.',
    textos: ['ROM.10.9', 'ROM.10.10', 'HEB.3.1', 'HEB.4.14', 'HEB.10.23', '2CO.4.13', 'PRO.18.21'],
    relacionados: ['fe', 'palavra', 'oracao'],
  },
  {
    id: 'oracao',
    termo: 'Oração',
    hebraico: { palavra: 'תְּפִלָּה', translit: 'tephillah', strong: 'H8605' },
    grego: { palavra: 'προσευχή', translit: 'proseuchē', strong: 'G4335' },
    definicao: 'É conversar com Deus — não um ritual formal. Inclui adorar, pedir, interceder, agradecer e orar no Espírito. Jesus disse: peçam no meu nome e receberão (Jo 16.23-24). A oração da fé cura o doente (Tg 5.15). Deus ouve quando você ora com confiança.',
    textos: ['JHN.16.23', 'JHN.16.24', 'PHI.4.6', 'MRK.11.24', '1JN.5.14', 'JAS.5.16', 'EPH.6.18', 'ROM.8.26', 'HEB.4.16'],
    relacionados: ['fe', 'confissao', 'espirito-santo', 'autoridade'],
  },
  {
    id: 'sangue',
    termo: 'Sangue de Cristo',
    grego: { palavra: 'αἷμα', translit: 'haima', strong: 'G129' },
    definicao: 'O sangue de Jesus é o preço que nos comprou de volta (1Pe 1.19), nos declarou justos (Rm 5.9), selou a Nova Aliança (Lc 22.20) e abriu o caminho para chegarmos a Deus (Hb 10.19). "Sem sangue não há perdão" (Hb 9.22) — e o sangue de Cristo foi derramado uma vez, para sempre.',
    textos: ['ROM.5.9', 'EPH.1.7', 'HEB.9.12', 'HEB.9.22', 'HEB.10.19', '1PE.1.19', 'REV.12.11', '1JN.1.7', 'COL.1.20', 'LEV.17.11'],
    relacionados: ['redencao', 'obra-consumada', 'nova-alianca', 'justificacao'],
  },
  {
    id: 'santificacao',
    termo: 'Santificação',
    hebraico: { palavra: 'קָדַשׁ', translit: 'qadash', strong: 'H6942' },
    grego: { palavra: 'ἁγιασμός', translit: 'hagiasmos', strong: 'G38' },
    definicao: 'É ser separado para Deus e ir se parecendo cada vez mais com Cristo. Quando você creu, Deus já te separou (1Co 6.11). No dia a dia, essa separação acontece pelo Espírito (Gl 5.16), pela Palavra (Jo 17.17) e por renovar a sua mente (Rm 12.2).',
    distincao: 'Justificação: Deus te declara justo (acontece de uma vez). Santificação: Deus te transforma no dia a dia (é caminhada). Glorificação: Deus completa tudo quando você estiver com Ele.',
    textos: ['1TH.4.3', '1TH.5.23', 'HEB.12.14', 'ROM.6.11', 'ROM.6.13', 'ROM.12.1', 'ROM.12.2', 'JHN.17.17', '1CO.6.11', 'HEB.10.10'],
    relacionados: ['justificacao', 'nova-criacao', 'espirito-santo'],
  },
  {
    id: 'nova-alianca',
    termo: 'Nova Aliança',
    hebraico: { palavra: 'בְּרִית חֲדָשָׁה', translit: 'berit chadashah' },
    grego: { palavra: 'καινὴ διαθήκη', translit: 'kainē diathēkē', strong: 'G2537+G1242' },
    definicao: 'É o novo pacto que Deus fez com a gente por meio de Jesus. Jeremias já tinha profetizado (Jr 31.31-34): nessa aliança, a lei é escrita no coração, todo mundo pode conhecer Deus diretamente, e os pecados são perdoados de vez. Jesus selou com o sangue dEle na última ceia (Lc 22.20).',
    textos: ['JER.31.31', 'JER.31.33', 'JER.31.34', 'HEB.8.8', 'HEB.8.10', 'HEB.8.12', 'HEB.8.13', 'LUK.22.20', '2CO.3.6', 'HEB.12.24'],
    relacionados: ['sangue', 'obra-consumada', 'espirito-santo', 'justificacao'],
  },
  {
    id: 'provisao',
    termo: 'Provisão',
    hebraico: { palavra: 'בְּרָכָה', translit: 'berakah', strong: 'H1293' },
    grego: { palavra: 'εὐοδόω', translit: 'euodoō', strong: 'G2137' },
    definicao: 'Deus cuida de todas as suas necessidades (Fp 4.19) — não só de dinheiro. Inclui bênção no trabalho (Dt 28.8), a generosidade que volta multiplicada (2Co 9.6-11) e a paz de quem busca primeiro o Reino (Mt 6.33). Prosperidade não é o evangelho inteiro, mas faz parte da bênção da aliança.',
    textos: ['PHI.4.19', '2CO.9.8', '2CO.9.10', '2CO.9.11', 'PSA.23.1', 'MAT.6.33', '3JN.1.2', 'DEU.28.8', 'PRO.10.22', 'MAL.3.10'],
    relacionados: ['graca', 'fe', 'nova-alianca'],
  },
  {
    id: 'salvacao',
    termo: 'Salvação',
    hebraico: { palavra: 'יְשׁוּעָה', translit: "yeshu'ah", strong: 'H3444' },
    grego: { palavra: 'σωτηρία', translit: 'sōtēria', strong: 'G4991' },
    definicao: 'É ser salvo de tudo: da culpa do pecado (justificação), do poder do pecado no dia a dia (santificação) e, no futuro, da presença do pecado (glorificação). O nome de Jesus vem de Yeshua, que significa "Deus salva". É pela graça, pela fé — presente de Deus, não esforço seu (Ef 2.8).',
    textos: ['EPH.2.8', 'EPH.2.9', 'ROM.1.16', 'ROM.10.9', 'ROM.10.10', 'ACT.4.12', 'TIT.3.5', '2TI.1.9', 'HEB.2.3'],
    relacionados: ['graca', 'fe', 'justificacao', 'redencao'],
  },
  {
    id: 'sacerdocio',
    termo: 'Sacerdócio de Cristo',
    grego: { palavra: 'ἀρχιερεύς', translit: 'archiereus', strong: 'G749' },
    definicao: 'No AT, só o sacerdote podia chegar perto de Deus pelo povo. Jesus é o nosso sumo sacerdote para sempre (Hb 7). Ele se ofereceu uma vez só (Hb 10.12), entrou no céu por nós (Hb 9.24) e vive intercedendo — orando — por nós o tempo todo (Hb 7.25). Por causa dEle, você pode chegar direto a Deus.',
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

/* ═══════════════════════════════════════════════════════════════════════════
   TIPOLOGIA AT → NT
   ═══════════════════════════════════════════════════════════════════════════ */

const tipologia = [
  {
    id: 'adao-cristo',
    titulo: 'Adão → Cristo',
    at: {
      nome: 'Adão — cabeça da velha criação',
      textos: ['GEN.2.7', 'GEN.3.6', 'GEN.3.17', 'GEN.3.19'],
    },
    nt: {
      nome: 'Cristo — cabeça da nova criação',
      textos: ['ROM.5.14', 'ROM.5.15', 'ROM.5.17', 'ROM.5.19', '1CO.15.22', '1CO.15.45'],
    },
    explicacao: 'Paulo declara que Adão "é tipo daquele que havia de vir" (Rm 5.14). Onde Adão trouxe pecado e morte, Cristo trouxe justiça e vida.',
    textosChave: ['ROM.5.14', '1CO.15.45'],
  },
  {
    id: 'sacrificios-cristo',
    titulo: 'Sacrifícios → Sacrifício de Cristo',
    at: {
      nome: 'Sacrifícios levíticos — sangue de animais',
      textos: ['LEV.1.4', 'LEV.4.20', 'LEV.16.15', 'LEV.16.16', 'LEV.17.11'],
    },
    nt: {
      nome: 'Cristo — o Cordeiro de Deus, oferecido uma vez',
      textos: ['HEB.9.12', 'HEB.9.26', 'HEB.10.10', 'HEB.10.12', 'HEB.10.14', 'JHN.1.29', '1PE.1.19'],
    },
    explicacao: '"Porque é impossível que o sangue de touros e bodes tire pecados" (Hb 10.4). Os sacrifícios apontavam para o sacrifício perfeito e irrepetível de Cristo.',
    textosChave: ['HEB.10.1', 'HEB.10.4'],
  },
  {
    id: 'sacerdocio-levita-cristo',
    titulo: 'Sacerdócio levítico → Sacerdócio de Cristo',
    at: {
      nome: 'Sacerdócio de Arão — mediação temporária',
      textos: ['EXO.28.1', 'LEV.9.7', 'LEV.16.6', 'NUM.18.7'],
    },
    nt: {
      nome: 'Cristo — sumo sacerdote segundo Melquisedeque',
      textos: ['HEB.5.6', 'HEB.7.17', 'HEB.7.24', 'HEB.7.25', 'HEB.7.26', 'HEB.7.27', 'HEB.9.24', 'PSA.110.4'],
    },
    explicacao: 'O sacerdócio levítico era limitado pela morte e pela necessidade de repetição. Cristo vive para sempre e intercede continuamente (Hb 7.25).',
    textosChave: ['HEB.7.23', 'HEB.7.24', 'HEB.7.25'],
  },
  {
    id: 'templo-espirito',
    titulo: 'Templo → Habitação do Espírito',
    at: {
      nome: 'Tabernáculo/Templo — presença localizada de Deus',
      textos: ['EXO.25.8', 'EXO.40.34', '1KI.8.10', '1KI.8.11', '2CH.7.1'],
    },
    nt: {
      nome: 'O crente como templo do Espírito Santo',
      textos: ['1CO.3.16', '1CO.6.19', '2CO.6.16', 'EPH.2.21', 'EPH.2.22', 'JHN.2.19', 'JHN.2.21'],
    },
    explicacao: 'Deus não habita mais em templos feitos por mãos humanas. O corpo do crente é o templo — a presença de Deus é pessoal e permanente.',
    textosChave: ['1CO.6.19', 'JHN.2.19'],
  },
  {
    id: 'lei-graca',
    titulo: 'Lei → Graça',
    at: {
      nome: 'Lei de Moisés — aliança do Sinai',
      textos: ['EXO.20.1', 'EXO.24.12', 'DEU.5.1', 'DEU.27.26'],
    },
    nt: {
      nome: 'Graça e verdade por Jesus Cristo',
      textos: ['JHN.1.17', 'ROM.6.14', 'ROM.10.4', 'GAL.3.24', 'GAL.3.25', 'GAL.5.18', '2CO.3.6'],
    },
    explicacao: '"A lei foi dada por meio de Moisés; a graça e a verdade vieram por meio de Jesus Cristo" (Jo 1.17). A lei foi o aio que conduziu a Cristo (Gl 3.24).',
    textosChave: ['JHN.1.17', 'GAL.3.24'],
  },
  {
    id: 'justica-lei-fe',
    titulo: 'Justiça da Lei → Justiça pela fé',
    at: {
      nome: 'Justiça pelas obras da lei',
      textos: ['DEU.6.25', 'LEV.18.5', 'ROM.10.5'],
    },
    nt: {
      nome: 'Justiça pela fé em Cristo',
      textos: ['ROM.1.17', 'ROM.3.21', 'ROM.3.22', 'ROM.3.28', 'ROM.10.6', 'GAL.2.16', 'PHI.3.9'],
    },
    explicacao: 'Paulo distingue a justiça que procede da lei da justiça que vem pela fé. Em Filipenses 3.9 ele escolhe: "não tendo a minha justiça que vem da lei, mas a que vem pela fé em Cristo".',
    textosChave: ['ROM.3.21', 'PHI.3.9'],
  },
  {
    id: 'sombra-realidade',
    titulo: 'Sombra → Realidade',
    at: {
      nome: 'Festas, sábados e cerimônias — sombra do que viria',
      textos: ['LEV.23.5', 'LEV.23.24', 'LEV.23.34', 'NUM.28.11'],
    },
    nt: {
      nome: 'Cristo — o corpo que projeta a sombra',
      textos: ['COL.2.16', 'COL.2.17', 'HEB.8.5', 'HEB.10.1'],
    },
    explicacao: '"Tudo isso tem sido sombra das coisas que haviam de vir; porém o corpo é de Cristo" (Cl 2.17). O AT projetava a sombra; Cristo é a realidade.',
    textosChave: ['COL.2.17', 'HEB.10.1'],
  },
  {
    id: 'profecia-cumprimento',
    titulo: 'Profecia → Cumprimento',
    at: {
      nome: 'Profecias messiânicas',
      textos: ['ISA.7.14', 'ISA.9.6', 'ISA.53.5', 'MIC.5.2', 'PSA.22.16', 'PSA.22.18', 'ZEC.9.9', 'ZEC.12.10'],
    },
    nt: {
      nome: 'Cumprimento em Jesus Cristo',
      textos: ['MAT.1.22', 'MAT.1.23', 'MAT.2.6', 'MAT.21.5', 'LUK.4.21', 'JHN.19.24', 'JHN.19.37', 'ACT.3.18'],
    },
    explicacao: '"Para que se cumprisse o que fora dito pelo profeta" — fórmula que Mateus repete dez vezes. Jesus disse: "É necessário que se cumpra tudo o que de mim está escrito na Lei, nos Profetas e nos Salmos" (Lc 24.44).',
    textosChave: ['LUK.24.44', 'MAT.1.22'],
  },
  {
    id: 'pascoa-cristo',
    titulo: 'Páscoa → Cristo, nossa Páscoa',
    at: {
      nome: 'Cordeiro pascal — sangue na porta',
      textos: ['EXO.12.3', 'EXO.12.5', 'EXO.12.7', 'EXO.12.13', 'EXO.12.46'],
    },
    nt: {
      nome: 'Cristo, o Cordeiro pascal',
      textos: ['1CO.5.7', 'JHN.1.29', 'JHN.19.36', '1PE.1.19', 'REV.5.6'],
    },
    explicacao: '"Cristo, nossa Páscoa, foi imolado" (1Co 5.7). O cordeiro sem defeito, cujos ossos não eram quebrados, apontava para Cristo.',
    textosChave: ['1CO.5.7', 'JHN.1.29'],
  },
  {
    id: 'alianca-antiga-nova',
    titulo: 'Antiga aliança → Nova aliança',
    at: {
      nome: 'Aliança do Sinai — tábuas de pedra',
      textos: ['EXO.24.7', 'EXO.24.8', 'EXO.34.28', 'DEU.5.2', 'JER.31.31', 'JER.31.32'],
    },
    nt: {
      nome: 'Nova aliança — lei no coração',
      textos: ['JER.31.33', 'JER.31.34', 'HEB.8.8', 'HEB.8.10', 'HEB.8.13', 'LUK.22.20', '2CO.3.6', '2CO.3.7', '2CO.3.8'],
    },
    explicacao: 'Jeremias profetizou uma aliança onde a lei seria escrita no coração (Jr 31.33). Jesus disse: "Este cálice é a nova aliança no meu sangue" (Lc 22.20). Hebreus 8.13: "Ao dizer Nova, tornou antiquada a primeira".',
    textosChave: ['JER.31.33', 'HEB.8.13'],
  },
  {
    id: 'melquisedeque-cristo',
    titulo: 'Melquisedeque → Cristo',
    at: {
      nome: 'Melquisedeque — rei-sacerdote de Salém',
      textos: ['GEN.14.18', 'GEN.14.19', 'GEN.14.20', 'PSA.110.4'],
    },
    nt: {
      nome: 'Cristo — sacerdote segundo a ordem de Melquisedeque',
      textos: ['HEB.5.6', 'HEB.5.10', 'HEB.6.20', 'HEB.7.1', 'HEB.7.2', 'HEB.7.3', 'HEB.7.15', 'HEB.7.17'],
    },
    explicacao: 'Melquisedeque foi rei e sacerdote ao mesmo tempo — sem genealogia registrada, "feito semelhante ao Filho de Deus" (Hb 7.3). Cristo cumpre esse sacerdócio eterno.',
    textosChave: ['PSA.110.4', 'HEB.7.3'],
  },
  {
    id: 'serpente-bronze-cruz',
    titulo: 'Serpente de bronze → Cruz de Cristo',
    at: {
      nome: 'Moisés levanta a serpente no deserto',
      textos: ['NUM.21.8', 'NUM.21.9'],
    },
    nt: {
      nome: 'Jesus levantado na cruz',
      textos: ['JHN.3.14', 'JHN.3.15', 'JHN.12.32'],
    },
    explicacao: 'Jesus usou esta tipologia diretamente: "Assim como Moisés levantou a serpente no deserto, assim importa que o Filho do Homem seja levantado" (Jo 3.14).',
    textosChave: ['JHN.3.14'],
  },
];

// Grava os arquivos
writeFileSync(join(DIR, 'theological-dict.json'), JSON.stringify(dicionario));
writeFileSync(join(DIR, 'semantic-groups.json'), JSON.stringify(familias));
writeFileSync(join(DIR, 'typology.json'), JSON.stringify(tipologia));

console.log(`Dicionário teológico: ${dicionario.length} verbetes.`);
console.log(`Famílias semânticas: ${familias.length} grupos, ${familias.reduce((s, f) => s + f.termos.length, 0)} termos.`);
console.log(`Tipologia AT → NT: ${tipologia.length} pares.`);
console.log(`Gravados em ${DIR}/`);
