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

  /* ─── 4 referências que existiam como "relacionados" sem verbete ─── */

  {
    id: 'batismo-espirito',
    termo: 'Batismo no Espírito Santo',
    grego: { palavra: 'βαπτίζω ἐν Πνεύματι', translit: 'baptizō en Pneumati' },
    definicao: 'É ser mergulhado no poder do Espírito Santo, uma experiência distinta do novo nascimento. Jesus prometeu: "Recebereis poder ao descer sobre vós o Espírito Santo" (At 1.8). No dia de Pentecostes veio com línguas de fogo e outras línguas (At 2.4). Não é salvação — é capacitação para servir com poder.',
    distincao: 'Nascer do Espírito (Jo 3.5) = salvação, acontece uma vez. Batismo no Espírito = revestimento de poder, com evidência de línguas. Ser cheio do Espírito = pode se repetir, para momentos específicos (At 4.31).',
    textos: ['ACT.1.5', 'ACT.1.8', 'ACT.2.4', 'ACT.2.38', 'ACT.10.44', 'ACT.10.46', 'ACT.19.6', '1CO.12.13', 'LUK.24.49'],
    relacionados: ['espirito-santo', 'dons', 'linguas'],
  },
  {
    id: 'fruto-espirito',
    termo: 'Fruto do Espírito',
    grego: { palavra: 'καρπὸς τοῦ Πνεύματος', translit: 'karpos tou Pneumatos' },
    definicao: 'É o caráter de Cristo produzido em você pelo Espírito Santo: amor, alegria, paz, paciência, bondade, benignidade, fidelidade, mansidão, domínio próprio (Gl 5.22-23). Não é esforço seu — é fruto, cresce naturalmente quando você anda no Espírito.',
    distincao: 'Dons do Espírito = habilidades sobrenaturais para servir (1Co 12). Fruto do Espírito = caráter transformado para viver (Gl 5.22). Os dons vêm de uma vez; o fruto amadurece com o tempo.',
    textos: ['GAL.5.22', 'GAL.5.23', 'GAL.5.16', 'GAL.5.25', 'JHN.15.4', 'JHN.15.5', 'JHN.15.8', 'COL.3.12', '2PE.1.5', '2PE.1.8'],
    relacionados: ['espirito-santo', 'santificacao', 'nova-criacao'],
  },
  {
    id: 'heranca',
    termo: 'Herança',
    hebraico: { palavra: 'נַחֲלָה', translit: 'nachalah', strong: 'H5159' },
    grego: { palavra: 'κληρονομία', translit: 'klēronomia', strong: 'G2817' },
    definicao: 'Se você é filho de Deus, é herdeiro — co-herdeiro com Cristo (Rm 8.17). A herança não é só o céu: inclui as promessas da aliança para agora — vida, saúde, paz, provisão. O Espírito Santo é o "sinal" que garante a herança (Ef 1.14).',
    textos: ['ROM.8.17', 'GAL.3.29', 'GAL.4.7', 'EPH.1.11', 'EPH.1.14', 'EPH.1.18', 'COL.1.12', 'HEB.9.15', '1PE.1.4', 'DEU.32.9'],
    relacionados: ['filiacao', 'identidade-em-cristo', 'nova-alianca', 'promessa'],
  },
  {
    id: 'nome-de-jesus',
    termo: 'Nome de Jesus',
    grego: { palavra: 'τὸ ὄνομα Ἰησοῦ', translit: 'to onoma Iēsou' },
    definicao: 'O nome não é uma fórmula mágica — representa a pessoa, a autoridade e a obra completa de Cristo. Quando você ora ou age "no nome de Jesus", está usando a procuração que Ele mesmo deu (Jo 14.13-14). É diante desse nome que todo joelho se dobra (Fp 2.10).',
    textos: ['PHI.2.9', 'PHI.2.10', 'PHI.2.11', 'ACT.3.6', 'ACT.3.16', 'ACT.4.12', 'JHN.14.13', 'JHN.14.14', 'JHN.16.24', 'MRK.16.17', 'COL.3.17'],
    relacionados: ['autoridade', 'oracao', 'fe'],
  },

  /* ─── Conceitos soteriológicos ─── */

  {
    id: 'reconciliacao',
    termo: 'Reconciliação',
    grego: { palavra: 'καταλλαγή', translit: 'katallagē', strong: 'G2643' },
    definicao: 'É Deus restaurando o relacionamento que o pecado quebrou. Não foi você que procurou Deus — Ele que te reconciliou consigo por meio de Cristo (2Co 5.18). E agora você recebeu o "ministério da reconciliação": levar essa paz a outros (2Co 5.19-20).',
    textos: ['ROM.5.10', 'ROM.5.11', '2CO.5.18', '2CO.5.19', '2CO.5.20', '2CO.5.21', 'COL.1.20', 'COL.1.21', 'COL.1.22', 'EPH.2.16'],
    relacionados: ['justificacao', 'obra-consumada', 'sangue'],
  },
  {
    id: 'propiciacao',
    termo: 'Propiciação',
    grego: { palavra: 'ἱλασμός', translit: 'hilasmos', strong: 'G2434' },
    definicao: 'É o sacrifício que satisfez a justiça de Deus. A ira de Deus contra o pecado era real — Cristo a absorveu por completo na cruz (1Jo 2.2). Não é que Deus precisasse ser convencido a te amar; é que o amor de Deus providenciou o meio justo de perdoar sem ignorar o pecado.',
    textos: ['ROM.3.25', '1JN.2.2', '1JN.4.10', 'HEB.2.17', 'HEB.9.5'],
    relacionados: ['obra-consumada', 'sangue', 'justificacao', 'expiacao'],
  },
  {
    id: 'expiacao',
    termo: 'Expiação',
    hebraico: { palavra: 'כָּפַר', translit: 'kaphar', strong: 'H3722' },
    definicao: 'Significa "cobrir", "limpar". No AT, o sangue do animal cobria o pecado (Lv 17.11). Na cruz, Cristo não apenas cobriu — removeu de vez (Hb 9.26). O Dia da Expiação (Yom Kippur) era quando o sumo sacerdote entrava uma vez por ano no lugar santíssimo; Cristo entrou uma vez, para sempre (Hb 9.12).',
    textos: ['LEV.16.15', 'LEV.16.16', 'LEV.16.30', 'LEV.17.11', 'HEB.9.7', 'HEB.9.12', 'HEB.9.22', 'HEB.9.26', 'HEB.10.4', 'ISA.53.10'],
    relacionados: ['propiciacao', 'sangue', 'obra-consumada', 'sacerdocio'],
  },
  {
    id: 'glorificacao',
    termo: 'Glorificação',
    grego: { palavra: 'δοξάζω', translit: 'doxazō', strong: 'G1392' },
    definicao: 'É o destino final: quando Cristo voltar, seu corpo será transformado para ser como o dEle (Fp 3.21). Não haverá mais pecado, dor, fraqueza. É o último passo da salvação — e Paulo fala como se já estivesse feito: "a estes também glorificou" (Rm 8.30). Para Deus, é certeza.',
    distincao: 'Justificação: Deus te declara justo (passado). Santificação: Deus te transforma (presente). Glorificação: Deus completa tudo (futuro — mas já garantido).',
    textos: ['ROM.8.17', 'ROM.8.18', 'ROM.8.30', 'PHI.3.20', 'PHI.3.21', '1CO.15.43', '1CO.15.49', '1CO.15.53', '2CO.3.18', '1JN.3.2', 'COL.3.4'],
    relacionados: ['justificacao', 'santificacao', 'ressurreicao', 'segunda-vinda'],
  },
  {
    id: 'eleicao',
    termo: 'Eleição',
    grego: { palavra: 'ἐκλογή', translit: 'eklogē', strong: 'G1589' },
    definicao: 'Deus te escolheu — antes de você existir (Ef 1.4). Não é destino cego: é o amor de Deus decidindo incluir você no plano dEle. Eleição não é rejeição dos outros — é a iniciativa de Deus, que sempre vem antes da resposta humana. Você não veio a Cristo sozinho; o Pai te atraiu (Jo 6.44).',
    textos: ['EPH.1.4', 'EPH.1.5', 'EPH.1.11', 'ROM.8.29', 'ROM.8.33', '1PE.1.2', '2TH.2.13', 'JHN.15.16', '1PE.2.9', 'DEU.7.6'],
    relacionados: ['graca', 'predestinacao', 'filiacao'],
  },
  {
    id: 'predestinacao',
    termo: 'Predestinação',
    grego: { palavra: 'προορίζω', translit: 'proorizō', strong: 'G4309' },
    definicao: 'Deus traçou de antemão o destino de quem crê: ser conformado à imagem de Cristo (Rm 8.29). Não é fatalismo — é o plano de Deus para os que Ele escolheu. O alvo da predestinação é a filiação (Ef 1.5) e a herança (Ef 1.11). Deus não predestinou ninguém para perder-se; predestinou o caminho de quem crê.',
    textos: ['ROM.8.29', 'ROM.8.30', 'EPH.1.5', 'EPH.1.11', 'ACT.4.28', '1CO.2.7'],
    relacionados: ['eleicao', 'glorificacao', 'filiacao'],
  },
  {
    id: 'arrependimento',
    termo: 'Arrependimento',
    hebraico: { palavra: 'שׁוּב', translit: 'shuv', strong: 'H7725' },
    grego: { palavra: 'μετάνοια', translit: 'metanoia', strong: 'G3341' },
    definicao: 'No grego, "mudar de mente" — não é remorso, é uma virada de direção. No hebraico, "voltar" (shuv): deixar o caminho errado e voltar para Deus. Não é só sentir culpa — é decidir mudar e agir diferente. É a porta de entrada para o Reino (Mc 1.15) e o convite do Espírito em todas as épocas.',
    textos: ['ACT.2.38', 'ACT.3.19', 'ACT.17.30', 'MRK.1.15', 'LUK.15.7', '2CO.7.10', 'ROM.2.4', '2PE.3.9', 'REV.2.5', 'ISA.55.7'],
    relacionados: ['salvacao', 'graca', 'fe'],
  },
  {
    id: 'batismo',
    termo: 'Batismo',
    grego: { palavra: 'βάπτισμα', translit: 'baptisma', strong: 'G908' },
    definicao: 'É ser mergulhado na água como testemunho público de que você morreu com Cristo e ressuscitou para uma vida nova (Rm 6.4). Não é o batismo que salva — a salvação é pela fé (Ef 2.8). Mas Jesus mandou batizar (Mt 28.19) e Ele mesmo foi batizado (Mt 3.16). É obediência, declaração, identificação.',
    distincao: 'Batismo nas águas = testemunho público, identificação com a morte e ressurreição de Cristo. Batismo no Espírito Santo = revestimento de poder para servir (At 1.8). São experiências distintas, complementares.',
    textos: ['MAT.28.19', 'MAT.3.16', 'ROM.6.3', 'ROM.6.4', 'ACT.2.38', 'ACT.2.41', 'ACT.8.36', 'ACT.8.38', 'GAL.3.27', 'COL.2.12'],
    relacionados: ['arrependimento', 'salvacao', 'batismo-espirito'],
  },
  {
    id: 'ressurreicao',
    termo: 'Ressurreição',
    grego: { palavra: 'ἀνάστασις', translit: 'anastasis', strong: 'G386' },
    definicao: 'Jesus morreu e ressuscitou fisicamente ao terceiro dia — e essa é a base de tudo (1Co 15.14). Se Ele não ressuscitou, a fé é vazia. Mas ressuscitou, e por isso quem crê também ressuscitará: corpo novo, glorioso, eterno (1Co 15.42-44). A ressurreição prova que a morte foi vencida.',
    textos: ['1CO.15.3', '1CO.15.4', '1CO.15.14', '1CO.15.17', '1CO.15.20', '1CO.15.42', '1CO.15.44', 'ROM.6.5', 'ROM.6.9', 'PHI.3.10', 'JHN.11.25'],
    relacionados: ['glorificacao', 'segunda-vinda', 'obra-consumada'],
  },
  {
    id: 'segunda-vinda',
    termo: 'Segunda vinda de Cristo',
    grego: { palavra: 'παρουσία', translit: 'parousia', strong: 'G3952' },
    definicao: 'Jesus prometeu: "Virei outra vez" (Jo 14.3). Quando vier, os mortos em Cristo ressuscitam, os vivos são transformados e se encontram com Ele nos ares (1Ts 4.16-17). Não é fantasia — é a esperança bendita (Tt 2.13) que move o crente a viver com propósito e urgência.',
    distincao: 'Parousia = presença, vinda, chegada. Apokalypsis = revelação, desvelamento. Epiphaneia = aparição, manifestação visível. São ângulos diferentes do mesmo evento — Cristo voltando em glória.',
    textos: ['1TH.4.16', '1TH.4.17', 'ACT.1.11', 'JHN.14.3', 'MAT.24.30', 'TIT.2.13', 'HEB.9.28', '1CO.15.52', '2PE.3.10', 'REV.1.7', 'REV.22.20'],
    relacionados: ['ressurreicao', 'glorificacao', 'reino-de-deus'],
  },
  {
    id: 'reino-de-deus',
    termo: 'Reino de Deus',
    grego: { palavra: 'βασιλεία τοῦ Θεοῦ', translit: 'basileia tou Theou', strong: 'G932' },
    definicao: 'É o governo de Deus em ação — não um lugar, mas um reinado. Jesus disse: "O Reino de Deus está entre vós" (Lc 17.21). Já começou com a vinda de Cristo, mas será completo quando Ele voltar. É justiça, paz e alegria no Espírito Santo (Rm 14.17). Você entra pelo novo nascimento (Jo 3.3).',
    textos: ['MRK.1.15', 'MAT.6.33', 'LUK.17.21', 'ROM.14.17', 'JHN.3.3', 'JHN.3.5', 'MAT.12.28', 'COL.1.13', '1CO.4.20', '1CO.15.24', 'REV.11.15'],
    relacionados: ['segunda-vinda', 'salvacao', 'espirito-santo'],
  },

  /* ─── Natureza e atributos de Deus ─── */

  {
    id: 'amor-de-deus',
    termo: 'Amor de Deus',
    grego: { palavra: 'ἀγάπη', translit: 'agapē', strong: 'G26' },
    definicao: 'O amor de Deus não é sentimento que vai e volta — é decisão, compromisso, entrega. Agapē é o amor que dá sem esperar nada de volta (Jo 3.16). Nada pode separar você desse amor (Rm 8.38-39). Ele te amou primeiro, antes de você fazer qualquer coisa boa (1Jo 4.19).',
    distincao: 'Agapē = amor incondicional, que se doa. Philia = amor de amizade, afeição mútua. Storgē = amor familiar. Eros = amor romântico. Agapē é o que Deus é (1Jo 4.8).',
    textos: ['JHN.3.16', 'ROM.5.8', 'ROM.8.38', 'ROM.8.39', '1JN.4.8', '1JN.4.10', '1JN.4.19', 'EPH.2.4', 'EPH.3.18', 'EPH.3.19', 'JER.31.3'],
    relacionados: ['graca', 'reconciliacao', 'fruto-espirito'],
  },
  {
    id: 'fidelidade-de-deus',
    termo: 'Fidelidade de Deus',
    hebraico: { palavra: 'אֱמֶת', translit: 'emet', strong: 'H571' },
    grego: { palavra: 'πιστός', translit: 'pistos', strong: 'G4103' },
    definicao: 'Deus não muda de ideia, não falha e não esquece uma promessa. "Fiel é o que vos chama, o qual também o fará" (1Ts 5.24). Mesmo quando você falha, Ele permanece fiel — porque não pode negar a si mesmo (2Tm 2.13). A fidelidade dEle é a base da sua confiança.',
    textos: ['LAM.3.22', 'LAM.3.23', '1CO.1.9', '1CO.10.13', '1TH.5.24', '2TI.2.13', 'HEB.10.23', 'PSA.36.5', 'PSA.89.8', 'DEU.7.9', 'NUM.23.19'],
    relacionados: ['promessa', 'nova-alianca', 'graca'],
  },
  {
    id: 'soberania',
    termo: 'Soberania de Deus',
    hebraico: { palavra: 'אֲדֹנָי', translit: 'Adonai', strong: 'H136' },
    definicao: 'Deus governa sobre tudo — nada acontece fora do alcance dEle. Mas soberania não é tirania: Ele trabalha todas as coisas para o bem de quem o ama (Rm 8.28). Mesmo o que parece caos, nas mãos dEle tem propósito. "Os céus são os céus do Senhor" (Sl 115.16), e Ele deu a terra aos filhos dos homens — parceria, não controle robótico.',
    textos: ['PSA.115.3', 'ISA.46.10', 'ROM.8.28', 'EPH.1.11', 'DAN.4.35', 'PSA.103.19', 'PRO.19.21', 'ISA.55.8', 'ISA.55.9', 'JOB.42.2'],
    relacionados: ['eleicao', 'predestinacao', 'fe'],
  },
  {
    id: 'gloria',
    termo: 'Glória de Deus',
    hebraico: { palavra: 'כָּבוֹד', translit: 'kavod', strong: 'H3519' },
    grego: { palavra: 'δόξα', translit: 'doxa', strong: 'G1391' },
    definicao: 'Kavod vem de "peso" — a glória é o peso da presença de Deus, a manifestação visível de quem Ele é. No AT, encheu o tabernáculo como nuvem (Êx 40.34). No NT, brilhou no rosto de Cristo (2Co 4.6). E a promessa é que veremos essa glória e seremos transformados por ela (2Co 3.18).',
    textos: ['EXO.33.18', 'EXO.40.34', 'ISA.6.3', 'JHN.1.14', 'JHN.17.22', '2CO.3.18', '2CO.4.6', 'ROM.3.23', 'ROM.8.18', 'PSA.19.1', 'HAB.2.14'],
    relacionados: ['glorificacao', 'espirito-santo', 'adoracao'],
  },
  {
    id: 'santidade',
    termo: 'Santidade de Deus',
    hebraico: { palavra: 'קָדוֹשׁ', translit: 'qadosh', strong: 'H6918' },
    grego: { palavra: 'ἅγιος', translit: 'hagios', strong: 'G40' },
    definicao: 'Santo significa "separado, único, diferente de tudo". Deus é completamente outro — puro, sem mancha, sem pecado. Os serafins proclamam "Santo, santo, santo" (Is 6.3) — a repetição tripla é o superlativo máximo do hebraico. A santidade não é só moral; é a natureza de quem Deus é.',
    textos: ['ISA.6.3', 'REV.4.8', 'LEV.19.2', '1PE.1.15', '1PE.1.16', 'PSA.99.9', 'HAB.1.13', 'ISA.57.15', 'EXO.15.11', 'HEB.12.14'],
    relacionados: ['santificacao', 'gloria', 'temor-do-senhor'],
  },

  /* ─── Vida cristã prática ─── */

  {
    id: 'adoracao',
    termo: 'Adoração',
    hebraico: { palavra: 'שָׁחָה', translit: 'shachah', strong: 'H7812' },
    grego: { palavra: 'προσκυνέω', translit: 'proskyneō', strong: 'G4352' },
    definicao: 'No hebraico, "prostrar-se"; no grego, "beijar em direção a". Não é só cantar — é render-se, reconhecer quem Deus é e entregar a vida a Ele. Jesus disse: os verdadeiros adoradores adoram "em espírito e em verdade" (Jo 4.23). Adoração é estilo de vida, não momento do culto.',
    textos: ['JHN.4.23', 'JHN.4.24', 'ROM.12.1', 'PSA.95.6', 'PSA.100.2', 'HEB.13.15', 'REV.4.10', 'REV.4.11', 'PSA.29.2', 'PHI.3.3'],
    relacionados: ['gloria', 'espirito-santo', 'oracao'],
  },
  {
    id: 'obediencia',
    termo: 'Obediência',
    hebraico: { palavra: 'שָׁמַע', translit: 'shama', strong: 'H8085' },
    grego: { palavra: 'ὑπακοή', translit: 'hypakoē', strong: 'G5218' },
    definicao: 'Shama é "ouvir" e "obedecer" ao mesmo tempo — em hebraico, ouvir de verdade já é fazer. A obediência não é legalismo; é a resposta natural de quem ama (Jo 14.15). Jesus mesmo "aprendeu a obediência pelo que sofreu" (Hb 5.8), e a obediência dEle nos justificou (Rm 5.19).',
    textos: ['JHN.14.15', 'JHN.14.21', 'ROM.5.19', 'HEB.5.8', '1SA.15.22', 'ACT.5.29', 'JAS.1.22', '1JN.5.3', 'PHI.2.8', 'DEU.28.1'],
    relacionados: ['fe', 'palavra', 'santificacao'],
  },
  {
    id: 'servico',
    termo: 'Serviço / Ministério',
    grego: { palavra: 'διακονία', translit: 'diakonia', strong: 'G1248' },
    definicao: 'Diakonia é servir — não é posição, é ação. Jesus disse: "Eu vim para servir" (Mc 10.45). Todo crente tem um ministério: o de reconciliação (2Co 5.18). Os cinco ministérios de Efésios 4.11 (apóstolo, profeta, evangelista, pastor, mestre) existem para equipar os santos — não para substituí-los.',
    textos: ['MRK.10.45', '2CO.5.18', 'EPH.4.11', 'EPH.4.12', '1PE.4.10', 'ROM.12.6', 'ROM.12.7', '1CO.12.5', 'ACT.6.4', 'COL.4.17'],
    relacionados: ['dons', 'espirito-santo', 'igreja'],
  },
  {
    id: 'igreja',
    termo: 'Igreja',
    grego: { palavra: 'ἐκκλησία', translit: 'ekklēsia', strong: 'G1577' },
    definicao: 'Ekklēsia significa "os chamados para fora" — não é um prédio, é gente. São todos os que creram em Cristo, em todo lugar e em todo tempo. Jesus disse: "Edificarei a minha igreja" (Mt 16.18). Ela é o corpo de Cristo (Ef 1.22-23), a noiva que Ele amou e por quem se entregou (Ef 5.25).',
    textos: ['MAT.16.18', 'EPH.1.22', 'EPH.1.23', 'EPH.5.25', 'EPH.5.27', '1CO.12.27', 'COL.1.18', 'COL.1.24', 'ACT.2.42', 'ACT.2.47', 'HEB.10.25'],
    relacionados: ['identidade-em-cristo', 'servico', 'dons'],
  },
  {
    id: 'discipulado',
    termo: 'Discipulado',
    grego: { palavra: 'μαθητής', translit: 'mathētēs', strong: 'G3101' },
    definicao: 'Discípulo é aluno, seguidor — alguém que aprende fazendo, ao lado do mestre. Jesus não chamou apenas para crer, mas para seguir (Mt 4.19). Discipulado é a vida inteira aprendendo dEle: negando a si mesmo, tomando a cruz e andando com Ele (Lc 9.23). Não é curso; é caminhada.',
    textos: ['MAT.4.19', 'MAT.28.19', 'MAT.28.20', 'LUK.9.23', 'LUK.14.27', 'LUK.14.33', 'JHN.8.31', 'JHN.8.32', 'JHN.13.35', 'JHN.15.8'],
    relacionados: ['obediencia', 'santificacao', 'palavra'],
  },
  {
    id: 'evangelismo',
    termo: 'Evangelismo / Pregação',
    grego: { palavra: 'εὐαγγελίζω', translit: 'euangelizō', strong: 'G2097' },
    definicao: 'É anunciar boas novas — o evangelho. Não é empurrar religião; é contar o que Cristo fez. Paulo disse: "Ai de mim se não pregar o evangelho" (1Co 9.16). A Grande Comissão é para todos (Mt 28.19), não só para pastores. A fé nasce quando alguém ouve a Palavra (Rm 10.14-17).',
    textos: ['ROM.10.14', 'ROM.10.15', 'ROM.10.17', 'MAT.28.19', 'MRK.16.15', 'ACT.1.8', '1CO.9.16', '2TI.4.2', 'ROM.1.16', 'ISA.52.7'],
    relacionados: ['palavra', 'espirito-santo', 'salvacao'],
  },

  /* ─── Termos da Palavra e confissão (§11) ─── */

  {
    id: 'logos',
    termo: 'Logos — a Palavra eterna',
    grego: { palavra: 'λόγος', translit: 'logos', strong: 'G3056' },
    definicao: 'Logos é a razão, a expressão, o plano. No Evangelho de João, é o próprio Cristo: "No princípio era o Verbo, e o Verbo estava com Deus, e o Verbo era Deus" (Jo 1.1). É também a Escritura como um todo — o conselho completo de Deus revelado. Jesus é a Palavra viva; a Bíblia, a Palavra escrita.',
    textos: ['JHN.1.1', 'JHN.1.14', 'HEB.4.12', 'REV.19.13', '2TI.3.16', 'ACT.20.32', '1PE.1.23', 'COL.3.16', 'PSA.119.89'],
    relacionados: ['palavra', 'rhema', 'fe'],
  },
  {
    id: 'rhema',
    termo: 'Rhema — a Palavra viva',
    grego: { palavra: 'ῥῆμα', translit: 'rhēma', strong: 'G4487' },
    definicao: 'Enquanto logos é a Palavra escrita como um todo, rhema é a Palavra que "acende" — o versículo que o Espírito traz vivo ao seu coração para aquele momento. A fé vem por ouvir, e ouvir a rhema de Deus (Rm 10.17). A espada do Espírito é a rhema (Ef 6.17). É pessoal, é agora, é para você.',
    textos: ['ROM.10.17', 'EPH.6.17', 'MAT.4.4', 'LUK.1.38', 'LUK.5.5', 'JHN.6.63', 'JHN.6.68', 'HEB.1.3', 'HEB.11.3'],
    relacionados: ['palavra', 'logos', 'fe', 'confissao'],
  },
  {
    id: 'verdade',
    termo: 'Verdade',
    hebraico: { palavra: 'אֱמֶת', translit: 'emet', strong: 'H571' },
    grego: { palavra: 'ἀλήθεια', translit: 'alētheia', strong: 'G225' },
    definicao: 'Jesus disse: "Eu sou a verdade" (Jo 14.6) — verdade não é um conceito abstrato, é uma pessoa. E a verdade liberta (Jo 8.32). A Palavra de Deus é verdade (Jo 17.17). A verdade se opõe à mentira do inimigo, e você a conhece não por acúmulo de informação, mas por relacionamento com Cristo.',
    textos: ['JHN.14.6', 'JHN.8.32', 'JHN.17.17', 'JHN.1.14', 'JHN.16.13', 'EPH.4.15', 'EPH.6.14', '2TI.2.15', 'PSA.119.160', '3JN.1.4'],
    relacionados: ['palavra', 'espirito-santo', 'fe'],
  },

  /* ─── Termos de provisão e prosperidade (§13) ─── */

  {
    id: 'generosidade',
    termo: 'Generosidade / Semeadura',
    grego: { palavra: 'εὐλογία', translit: 'eulogia', strong: 'G2129' },
    definicao: 'Quem semeia com fartura, com fartura colhe (2Co 9.6). Generosidade não é dar o que sobra — é semear com fé, confiando que Deus multiplica. Deus ama quem dá com alegria (2Co 9.7). E a promessa é clara: "Poderoso é Deus para fazer abundar em vós toda graça" (2Co 9.8).',
    textos: ['2CO.9.6', '2CO.9.7', '2CO.9.8', '2CO.9.10', '2CO.9.11', 'LUK.6.38', 'PRO.11.24', 'PRO.11.25', 'ACT.20.35', 'MAL.3.10'],
    relacionados: ['provisao', 'fe', 'graca'],
  },
  {
    id: 'mordomia',
    termo: 'Mordomia cristã',
    grego: { palavra: 'οἰκονόμος', translit: 'oikonomos', strong: 'G3623' },
    definicao: 'Mordomo é administrador — cuida do que é do dono. Tudo o que você tem é de Deus; você administra. Isso inclui dinheiro, tempo, talentos, corpo, relacionamentos. O mordomo fiel ouve: "Muito bem, servo bom e fiel" (Mt 25.21). Não é culpa por ter; é responsabilidade com o que recebeu.',
    textos: ['MAT.25.21', 'MAT.25.23', 'LUK.16.10', 'LUK.16.11', '1CO.4.2', '1PE.4.10', 'HAG.2.8', 'PSA.24.1', '1CH.29.14', 'MAL.3.10'],
    relacionados: ['provisao', 'generosidade', 'obediencia'],
  },

  /* ─── Termos de autoridade (§14) ─── */

  {
    id: 'dynamis',
    termo: 'Dynamis — poder',
    grego: { palavra: 'δύναμις', translit: 'dynamis', strong: 'G1411' },
    definicao: 'É a força explosiva de Deus — de onde vem "dinamite". É o poder que opera milagres (At 1.8), que ressuscitou Cristo (Ef 1.19-20) e que age em você (Ef 3.20). Não é seu esforço; é o poder de Deus trabalhando por dentro. "Tudo posso naquele que me fortalece" (Fp 4.13).',
    textos: ['ACT.1.8', 'EPH.1.19', 'EPH.3.20', 'PHI.4.13', '2CO.12.9', 'ROM.1.16', '1CO.1.18', '1CO.2.4', '2TI.1.7', 'COL.1.29'],
    relacionados: ['autoridade', 'espirito-santo', 'dons'],
  },
  {
    id: 'kratos',
    termo: 'Kratos — domínio',
    grego: { palavra: 'κράτος', translit: 'kratos', strong: 'G2904' },
    definicao: 'É a força em ação, o domínio exercido. Aparece nas doxologias: "a Ele o domínio pelos séculos" (1Pe 5.11). Enquanto dynamis é a capacidade, kratos é a força sendo exercida — o braço estendido. Deus reina com kratos, e esse mesmo domínio sustenta quem crê.',
    textos: ['EPH.1.19', 'EPH.6.10', 'COL.1.11', '1PE.5.11', '1TI.6.16', 'HEB.2.14', 'REV.1.6', 'REV.5.13'],
    relacionados: ['autoridade', 'dynamis', 'soberania'],
  },
  {
    id: 'linguas',
    termo: 'Línguas / Glossolalia',
    grego: { palavra: 'γλῶσσα', translit: 'glōssa', strong: 'G1100' },
    definicao: 'É falar em uma língua que você não aprendeu, pelo Espírito Santo. Em Pentecostes foram línguas humanas conhecidas (At 2.6-8). Em Corinto, Paulo fala de uma "língua dos anjos" (1Co 13.1) e de orar no Espírito (1Co 14.2). Pode ser sinal (At 2), oração pessoal (1Co 14.4) ou mensagem na igreja, se houver intérprete (1Co 14.27-28).',
    textos: ['ACT.2.4', 'ACT.2.6', 'ACT.10.46', 'ACT.19.6', '1CO.12.10', '1CO.12.28', '1CO.14.2', '1CO.14.4', '1CO.14.14', '1CO.14.27', '1CO.13.1'],
    relacionados: ['batismo-espirito', 'dons', 'espirito-santo'],
  },
  {
    id: 'guerra-espiritual',
    termo: 'Guerra espiritual',
    grego: { palavra: 'πάλη', translit: 'palē', strong: 'G3823' },
    definicao: 'Sua luta não é contra pessoas — é contra principados e potestades (Ef 6.12). A armadura de Deus não é opcional: verdade, justiça, evangelho, fé, salvação, Palavra e oração (Ef 6.13-18). As armas não são humanas — têm poder divino para destruir fortalezas (2Co 10.4). A vitória já foi conquistada na cruz (Cl 2.15).',
    textos: ['EPH.6.10', 'EPH.6.11', 'EPH.6.12', 'EPH.6.13', 'EPH.6.17', 'EPH.6.18', '2CO.10.3', '2CO.10.4', 'COL.2.15', 'JAS.4.7', '1PE.5.8', 'REV.12.11'],
    relacionados: ['autoridade', 'nome-de-jesus', 'palavra', 'fe'],
  },

  /* ─── Pessoa e obra de Cristo ─── */

  {
    id: 'encarnacao',
    termo: 'Encarnação',
    grego: { palavra: 'σὰρξ ἐγένετο', translit: 'sarx egeneto' },
    definicao: '"O Verbo se fez carne e habitou entre nós" (Jo 1.14). Deus se tornou homem sem deixar de ser Deus. Jesus é plenamente Deus e plenamente homem (Cl 2.9). Sem a encarnação, Ele não poderia morrer por nós; sem ser Deus, Sua morte não bastaria. É o mistério central da fé cristã.',
    textos: ['JHN.1.14', 'PHI.2.6', 'PHI.2.7', 'PHI.2.8', 'COL.2.9', '1TI.3.16', 'HEB.2.14', 'HEB.2.17', 'GAL.4.4', 'ISA.7.14', 'MAT.1.23'],
    relacionados: ['obra-consumada', 'sacerdocio', 'salvacao'],
  },
  {
    id: 'mediador',
    termo: 'Mediador',
    grego: { palavra: 'μεσίτης', translit: 'mesitēs', strong: 'G3316' },
    definicao: 'Um mediador fica entre duas partes. "Há um só Deus e um só mediador entre Deus e os homens: Cristo Jesus, homem" (1Tm 2.5). Ele nos representa diante de Deus e traz Deus até nós. É o único caminho (Jo 14.6) — não um dos caminhos.',
    textos: ['1TI.2.5', 'HEB.8.6', 'HEB.9.15', 'HEB.12.24', 'JHN.14.6', 'ROM.8.34', '1JN.2.1'],
    relacionados: ['sacerdocio', 'nova-alianca', 'obra-consumada'],
  },
  {
    id: 'cordeiro',
    termo: 'Cordeiro de Deus',
    grego: { palavra: 'ἀμνὸς τοῦ Θεοῦ', translit: 'amnos tou Theou', strong: 'G286' },
    definicao: 'João Batista viu Jesus e disse: "Eis o Cordeiro de Deus, que tira o pecado do mundo" (Jo 1.29). Desde a Páscoa do Êxodo, o cordeiro sem defeito apontava para Cristo. No Apocalipse, o Cordeiro que foi morto é adorado no trono (Ap 5.12). É sacrifício e é Rei.',
    textos: ['JHN.1.29', 'JHN.1.36', '1PE.1.19', 'REV.5.6', 'REV.5.12', 'REV.7.17', 'REV.21.23', 'ISA.53.7', 'EXO.12.5', 'EXO.12.13'],
    relacionados: ['sangue', 'expiacao', 'propiciacao', 'obra-consumada'],
  },
  {
    id: 'intercessao',
    termo: 'Intercessão',
    grego: { palavra: 'ἔντευξις', translit: 'enteuxis', strong: 'G1783' },
    definicao: 'Interceder é se colocar entre Deus e uma necessidade — é orar pelo outro. Cristo vive intercedendo por nós (Hb 7.25, Rm 8.34). O Espírito Santo intercede quando não sabemos orar (Rm 8.26). E Deus convida você a interceder: "Se alguém vir pecando o irmão… peça" (1Jo 5.16).',
    textos: ['ROM.8.26', 'ROM.8.27', 'ROM.8.34', 'HEB.7.25', '1TI.2.1', 'EZE.22.30', 'ISA.53.12', 'JHN.17.9', 'JHN.17.20', 'JAS.5.16'],
    relacionados: ['oracao', 'sacerdocio', 'espirito-santo'],
  },

  /* ─── Pecado e libertação ─── */

  {
    id: 'pecado',
    termo: 'Pecado',
    hebraico: { palavra: 'חַטָּאת', translit: 'chattat', strong: 'H2403' },
    grego: { palavra: 'ἁμαρτία', translit: 'hamartia', strong: 'G266' },
    definicao: 'Hamartia significa "errar o alvo". Pecado não é só fazer coisas ruins — é viver desalinhado do propósito de Deus. Todos pecaram (Rm 3.23). Mas em Cristo o pecado perdeu o domínio: "O pecado não terá domínio sobre vós, porque não estais debaixo da lei, mas da graça" (Rm 6.14).',
    textos: ['ROM.3.23', 'ROM.5.12', 'ROM.6.14', 'ROM.6.23', '1JN.1.8', '1JN.1.9', 'ISA.59.2', 'PSA.51.5', 'JAS.1.15', 'GAL.5.19'],
    relacionados: ['justificacao', 'redencao', 'arrependimento', 'perdao'],
  },
  {
    id: 'perdao',
    termo: 'Perdão',
    hebraico: { palavra: 'סָלַח', translit: 'salach', strong: 'H5545' },
    grego: { palavra: 'ἄφεσις', translit: 'aphesis', strong: 'G859' },
    definicao: 'Aphesis é "soltar, deixar ir" — Deus solta o seu pecado como quem abre a mão de uma dívida. Em Cristo, o perdão é completo: "Tão longe quanto o oriente do ocidente, assim afastou de nós as nossas transgressões" (Sl 103.12). E quem foi perdoado é chamado a perdoar (Ef 4.32).',
    textos: ['EPH.1.7', 'EPH.4.32', 'COL.1.14', '1JN.1.9', 'PSA.103.12', 'MIC.7.18', 'MIC.7.19', 'ISA.43.25', 'MAT.6.14', 'MAT.6.15', 'MRK.11.25'],
    relacionados: ['redencao', 'graca', 'sangue', 'reconciliacao'],
  },
  {
    id: 'libertacao',
    termo: 'Libertação',
    grego: { palavra: 'ἐλευθερία', translit: 'eleutheria', strong: 'G1657' },
    definicao: 'Cristo te libertou — não para fazer o que quiser, mas para viver livre do pecado, do medo e da escravidão (Gl 5.1). A verdade liberta (Jo 8.32). O Espírito do Senhor traz liberdade (2Co 3.17). Onde o mundo oferece vício, medo e prisão interior, Cristo oferece liberdade real.',
    textos: ['JHN.8.32', 'JHN.8.36', 'GAL.5.1', '2CO.3.17', 'ROM.6.18', 'ROM.6.22', 'ROM.8.2', 'ROM.8.21', 'ISA.61.1', 'LUK.4.18'],
    relacionados: ['redencao', 'obra-consumada', 'espirito-santo', 'autoridade'],
  },

  /* ─── Virtudes e caráter cristão ─── */

  {
    id: 'esperanca',
    termo: 'Esperança',
    grego: { palavra: 'ἐλπίς', translit: 'elpis', strong: 'G1680' },
    definicao: 'Não é "tomara que dê certo" — é certeza confiante do que Deus prometeu. A esperança bíblica é âncora da alma (Hb 6.19). É esperança viva, baseada na ressurreição de Cristo (1Pe 1.3). Junto com a fé e o amor, é uma das três coisas que permanecem (1Co 13.13).',
    textos: ['ROM.5.5', 'ROM.8.24', 'ROM.15.13', 'HEB.6.19', '1PE.1.3', '1CO.13.13', 'TIT.2.13', 'COL.1.27', 'JER.29.11', 'PSA.42.11'],
    relacionados: ['fe', 'segunda-vinda', 'ressurreicao'],
  },
  {
    id: 'paz',
    termo: 'Paz',
    hebraico: { palavra: 'שָׁלוֹם', translit: 'shalom', strong: 'H7965' },
    grego: { palavra: 'εἰρήνη', translit: 'eirēnē', strong: 'G1515' },
    definicao: 'Shalom não é só ausência de conflito — é plenitude, inteireza, tudo funcionando como Deus planejou. Jesus é a nossa paz (Ef 2.14). E a paz de Deus "excede todo entendimento" (Fp 4.7) — guarda seu coração mesmo quando a situação não guarda.',
    textos: ['JHN.14.27', 'JHN.16.33', 'PHI.4.6', 'PHI.4.7', 'ROM.5.1', 'EPH.2.14', 'ISA.26.3', 'ISA.53.5', 'COL.3.15', 'PSA.29.11', '2TH.3.16'],
    relacionados: ['fruto-espirito', 'justificacao', 'fe'],
  },
  {
    id: 'alegria',
    termo: 'Alegria / Gozo',
    grego: { palavra: 'χαρά', translit: 'chara', strong: 'G5479' },
    definicao: 'Não depende das circunstâncias — depende de quem está com você. Paulo escreveu Filipenses, a carta da alegria, de dentro da prisão. "Alegrai-vos sempre no Senhor; outra vez digo: alegrai-vos" (Fp 4.4). O gozo do Senhor é a sua força (Ne 8.10). É fruto do Espírito, não produção humana.',
    textos: ['PHI.4.4', 'NEH.8.10', 'PSA.16.11', 'JHN.15.11', 'JHN.16.22', 'JHN.16.24', 'ROM.14.17', 'GAL.5.22', '1PE.1.8', 'HAB.3.18'],
    relacionados: ['fruto-espirito', 'espirito-santo', 'adoracao'],
  },
  {
    id: 'humildade',
    termo: 'Humildade',
    grego: { palavra: 'ταπεινοφροσύνη', translit: 'tapeinophrosynē', strong: 'G5012' },
    definicao: 'Não é se achar inútil — é se achar no lugar certo diante de Deus. Jesus, sendo Deus, se humilhou (Fp 2.5-8). Pedro diz: "Deus resiste ao soberbo, mas dá graça ao humilde" (1Pe 5.5). Humildade é a postura que abre espaço para Deus agir.',
    textos: ['PHI.2.3', 'PHI.2.5', 'PHI.2.8', '1PE.5.5', '1PE.5.6', 'JAM.4.6', 'JAM.4.10', 'MAT.23.12', 'MIC.6.8', 'PRO.22.4', 'COL.3.12'],
    relacionados: ['obediencia', 'servico', 'graca'],
  },
  {
    id: 'paciencia',
    termo: 'Paciência / Perseverança',
    grego: { palavra: 'ὑπομονή', translit: 'hypomonē', strong: 'G5281' },
    definicao: 'Hypomonē é "ficar debaixo" — aguentar firme sem ceder. Não é passividade; é resistência ativa. A tribulação produz perseverança, e a perseverança produz experiência, e a experiência, esperança (Rm 5.3-4). Hebreus 12.1 diz: "Corramos com perseverança a carreira que nos está proposta".',
    textos: ['ROM.5.3', 'ROM.5.4', 'HEB.10.36', 'HEB.12.1', 'JAS.1.3', 'JAS.1.4', 'JAS.5.11', 'LUK.21.19', '2PE.1.6', 'REV.2.2', 'GAL.6.9'],
    relacionados: ['fe', 'esperanca', 'fruto-espirito'],
  },

  /* ─── Relacionamento com Deus ─── */

  {
    id: 'temor-do-senhor',
    termo: 'Temor do Senhor',
    hebraico: { palavra: 'יִרְאַת יהוה', translit: "yir'at YHWH", strong: 'H3374' },
    definicao: 'Não é medo de castigo — é reverência diante de quem Deus é. É saber que Ele é santo e levá-lo a sério. "O temor do Senhor é o princípio da sabedoria" (Pv 9.10). Quem teme ao Senhor não vive com medo; vive com consciência de que está diante de alguém grandioso.',
    textos: ['PRO.1.7', 'PRO.9.10', 'PSA.111.10', 'PSA.34.9', 'PSA.19.9', 'ACT.9.31', '2CO.7.1', 'ISA.11.2', 'DEU.10.12', 'MAL.3.16'],
    relacionados: ['santidade', 'sabedoria', 'obediencia'],
  },
  {
    id: 'sabedoria',
    termo: 'Sabedoria',
    hebraico: { palavra: 'חָכְמָה', translit: 'chokmah', strong: 'H2451' },
    grego: { palavra: 'σοφία', translit: 'sophia', strong: 'G4678' },
    definicao: 'Não é acúmulo de conhecimento — é saber viver bem diante de Deus. Cristo "se tornou para nós sabedoria da parte de Deus" (1Co 1.30). Se você precisa, "peça a Deus, que a todos dá liberalmente" (Tg 1.5). A sabedoria de cima é pura, pacífica, indulgente (Tg 3.17).',
    textos: ['PRO.1.7', 'PRO.4.7', 'PRO.9.10', 'JAS.1.5', 'JAS.3.17', '1CO.1.30', '1CO.2.7', 'COL.2.3', 'EPH.1.17', 'PSA.111.10'],
    relacionados: ['temor-do-senhor', 'palavra', 'espirito-santo'],
  },
  {
    id: 'comunhao',
    termo: 'Comunhão',
    grego: { palavra: 'κοινωνία', translit: 'koinōnia', strong: 'G2842' },
    definicao: 'É compartilhar a vida — com Deus e com os irmãos. Não é só ir ao culto; é participar, contribuir, partilhar. A primeira igreja "perseverava na comunhão" (At 2.42). Comunhão com Deus é andar na luz (1Jo 1.7). Com os irmãos, é carregar o fardo uns dos outros (Gl 6.2).',
    textos: ['ACT.2.42', '1JN.1.3', '1JN.1.7', '1CO.1.9', '2CO.13.13', 'PHI.2.1', 'GAL.6.2', 'HEB.10.24', 'HEB.10.25', '1CO.10.16'],
    relacionados: ['igreja', 'amor-de-deus', 'espirito-santo'],
  },

  /* ─── Aliança e promessa ─── */

  {
    id: 'alianca',
    termo: 'Aliança / Pacto',
    hebraico: { palavra: 'בְּרִית', translit: 'berit', strong: 'H1285' },
    grego: { palavra: 'διαθήκη', translit: 'diathēkē', strong: 'G1242' },
    definicao: 'Berit é um acordo selado com sangue. Deus fez aliança com Noé (arco-íris), com Abraão (descendência e terra), com Moisés (lei e obediência), com Davi (trono eterno). Todas apontam para a Nova Aliança em Cristo (Lc 22.20). Aliança não é contrato — é compromisso de vida.',
    textos: ['GEN.9.12', 'GEN.15.18', 'GEN.17.7', 'EXO.24.7', '2SA.7.12', '2SA.7.16', 'JER.31.31', 'LUK.22.20', 'HEB.8.6', 'HEB.13.20'],
    relacionados: ['nova-alianca', 'sangue', 'promessa'],
  },
  {
    id: 'promessa',
    termo: 'Promessas de Deus',
    grego: { palavra: 'ἐπαγγελία', translit: 'epangelia', strong: 'G1860' },
    definicao: 'São mais de 7.000 promessas na Bíblia — e "todas quantas são as promessas de Deus, nEle está o sim" (2Co 1.20). As promessas são herdadas pela fé e pela paciência (Hb 6.12). Não são cheques em branco — cada uma tem contexto, condição e cumprimento. Mas Deus é fiel para cumprir (Hb 10.23).',
    textos: ['2CO.1.20', 'HEB.6.12', 'HEB.10.23', '2PE.1.4', 'ROM.4.20', 'ROM.4.21', 'GAL.3.16', 'GAL.3.29', 'HEB.11.33', 'JOS.21.45'],
    relacionados: ['fe', 'alianca', 'fidelidade-de-deus'],
  },

  /* ─── Termos do AT fundamentais ─── */

  {
    id: 'lei',
    termo: 'Lei / Torá',
    hebraico: { palavra: 'תּוֹרָה', translit: 'torah', strong: 'H8451' },
    definicao: 'Torá não é só "lei" — é "instrução", "ensino". Os cinco livros de Moisés são a Torá. A lei revelou o pecado (Rm 3.20) e foi o tutor que conduziu a Cristo (Gl 3.24). Cristo não aboliu a lei — cumpriu (Mt 5.17). Nele, a exigência da lei foi satisfeita (Rm 8.4). O cristão vive pela lei do Espírito (Rm 8.2), não pela letra que mata (2Co 3.6).',
    textos: ['MAT.5.17', 'ROM.3.20', 'ROM.7.7', 'ROM.8.2', 'ROM.8.4', 'ROM.10.4', 'GAL.3.24', 'GAL.3.25', '2CO.3.6', 'PSA.19.7', 'PSA.119.97'],
    relacionados: ['nova-alianca', 'graca', 'justificacao'],
  },
  {
    id: 'profecia',
    termo: 'Profecia',
    hebraico: { palavra: 'נָבִיא', translit: 'navi', strong: 'H5030' },
    grego: { palavra: 'προφητεία', translit: 'prophēteia', strong: 'G4394' },
    definicao: 'Profeta é "boca de Deus" — fala o que Deus manda. No AT, os profetas anunciaram o Messias e chamaram o povo de volta à aliança. No NT, profecia é dom do Espírito para edificação, exortação e consolação (1Co 14.3). Não substituiu a Escritura — toda profecia precisa ser julgada (1Co 14.29, 1Ts 5.20-21).',
    textos: ['1CO.14.3', '1CO.14.29', '1TH.5.20', '1TH.5.21', 'AMO.3.7', '2PE.1.21', 'REV.19.10', 'ACT.2.17', 'JOE.2.28', 'NUM.12.6'],
    relacionados: ['dons', 'espirito-santo', 'palavra'],
  },
  {
    id: 'messias',
    termo: 'Messias / Cristo',
    hebraico: { palavra: 'מָשִׁיחַ', translit: 'mashiach', strong: 'H4899' },
    grego: { palavra: 'Χριστός', translit: 'Christos', strong: 'G5547' },
    definicao: 'Mashiach (hebraico) e Christos (grego) significam "ungido". O Messias é o Rei prometido a Israel que Deus enviaria para libertar, reinar e restaurar. Jesus é o Cristo — o Ungido de Deus, cumprindo mais de 300 profecias do AT. "Tu és o Cristo, o Filho do Deus vivo" (Mt 16.16).',
    textos: ['MAT.16.16', 'JHN.1.41', 'JHN.4.25', 'JHN.4.26', 'ACT.2.36', 'DAN.9.25', 'DAN.9.26', 'ISA.61.1', 'LUK.2.11', 'LUK.4.18', 'PSA.2.2'],
    relacionados: ['encarnacao', 'sacerdocio', 'reino-de-deus', 'obra-consumada'],
  },
  {
    id: 'uncao',
    termo: 'Unção',
    hebraico: { palavra: 'מָשַׁח', translit: 'mashach', strong: 'H4886' },
    grego: { palavra: 'χρῖσμα', translit: 'chrisma', strong: 'G5545' },
    definicao: 'No AT, reis, sacerdotes e profetas eram ungidos com óleo — separados e capacitados para o serviço. Jesus é o Ungido supremo. E "vós tendes a unção que vem do Santo e sabeis todas as coisas" (1Jo 2.20). A unção é o Espírito de Deus capacitando para fazer o que Ele chama a fazer.',
    textos: ['1JN.2.20', '1JN.2.27', 'ISA.61.1', 'LUK.4.18', 'ACT.10.38', '2CO.1.21', 'PSA.23.5', 'PSA.133.2', '1SA.16.13', 'EXO.30.25'],
    relacionados: ['espirito-santo', 'messias', 'dons'],
  },

  /* ─── Escatologia e destino eterno ─── */

  {
    id: 'juizo',
    termo: 'Juízo / Julgamento',
    hebraico: { palavra: 'מִשְׁפָּט', translit: 'mishpat', strong: 'H4941' },
    grego: { palavra: 'κρίσις', translit: 'krisis', strong: 'G2920' },
    definicao: 'Deus é justo, e haverá juízo. Para o crente, o juízo do pecado já caiu sobre Cristo (Rm 8.1). Mas há o tribunal de Cristo, onde o crente prestará contas do que fez com o que recebeu (2Co 5.10) — não para condenação, mas para recompensa. Para quem rejeitou Cristo, haverá juízo final (Ap 20.12).',
    textos: ['ROM.8.1', '2CO.5.10', 'ROM.14.10', 'HEB.9.27', 'JHN.5.22', 'JHN.5.24', 'ACT.17.31', 'REV.20.11', 'REV.20.12', 'MAT.25.31', 'MAT.25.46'],
    relacionados: ['justificacao', 'obra-consumada', 'segunda-vinda'],
  },
  {
    id: 'vida-eterna',
    termo: 'Vida eterna',
    grego: { palavra: 'ζωὴ αἰώνιος', translit: 'zōē aiōnios', strong: 'G2222+G166' },
    definicao: 'Não é só "viver para sempre" — é a qualidade de vida que Deus tem, dada a você agora (Jo 17.3). Começa no momento em que você crê (Jo 5.24). É conhecer a Deus e a Jesus Cristo (Jo 17.3). A vida eterna é presente, não só futuro — você já passou da morte para a vida (1Jo 3.14).',
    textos: ['JHN.3.16', 'JHN.5.24', 'JHN.17.3', 'JHN.10.28', 'ROM.6.23', '1JN.5.11', '1JN.5.13', 'TIT.1.2', 'MAT.25.46', 'JHN.6.47'],
    relacionados: ['salvacao', 'nova-criacao', 'ressurreicao'],
  },
  {
    id: 'ceu',
    termo: 'Céu / Morada eterna',
    grego: { palavra: 'οὐρανός', translit: 'ouranos', strong: 'G3772' },
    definicao: 'O céu é onde Deus habita — e onde o crente estará com Ele para sempre. Jesus disse: "Na casa de meu Pai há muitas moradas; vou preparar-vos lugar" (Jo 14.2). Mas a esperança final é mais que "ir para o céu": é o novo céu e a nova terra (Ap 21.1), onde Deus habitará com os homens (Ap 21.3).',
    textos: ['JHN.14.2', 'JHN.14.3', '2CO.5.1', 'PHI.3.20', 'HEB.11.16', 'REV.21.1', 'REV.21.2', 'REV.21.3', 'REV.21.4', '1PE.1.4', 'COL.1.5'],
    relacionados: ['vida-eterna', 'glorificacao', 'segunda-vinda'],
  },

  /* ─── Temas pastorais e ministeriais ─── */

  {
    id: 'pastoreio',
    termo: 'Pastoreio',
    grego: { palavra: 'ποιμήν', translit: 'poimēn', strong: 'G4166' },
    definicao: 'O pastor cuida, alimenta, protege e conduz. Jesus é o Bom Pastor que dá a vida pelas ovelhas (Jo 10.11). Pedro recebeu o encargo: "Apascenta as minhas ovelhas" (Jo 21.16). Pastorear não é dominar — é servir (1Pe 5.2-3). O Sumo Pastor voltará e dará a coroa da glória (1Pe 5.4).',
    textos: ['JHN.10.11', 'JHN.10.14', 'JHN.21.16', 'PSA.23.1', '1PE.5.2', '1PE.5.3', '1PE.5.4', 'EPH.4.11', 'HEB.13.20', 'EZE.34.15', 'ACT.20.28'],
    relacionados: ['servico', 'igreja', 'discipulado'],
  },
  {
    id: 'pregacao',
    termo: 'Pregação / Kerygma',
    grego: { palavra: 'κήρυγμα', translit: 'kērygma', strong: 'G2782' },
    definicao: 'Kērygma é a proclamação pública do arauto — a mensagem central do evangelho. Não é palestra nem entretenimento; é anúncio com autoridade. O conteúdo do kerygma apostólico: Cristo morreu, ressuscitou, e quem crê é salvo (1Co 15.1-4). "Agradou a Deus salvar os que creem pela loucura da pregação" (1Co 1.21).',
    textos: ['1CO.1.21', '1CO.2.4', '1CO.15.1', '1CO.15.3', '1CO.15.4', 'ROM.10.14', 'ROM.10.15', '2TI.4.2', 'ACT.2.14', 'ACT.2.36', 'TIT.1.3'],
    relacionados: ['evangelismo', 'palavra', 'espirito-santo'],
  },
  {
    id: 'uno',
    termo: 'Unidade da igreja',
    grego: { palavra: 'ἑνότης', translit: 'henotēs', strong: 'G1775' },
    definicao: 'Jesus orou: "Para que todos sejam um, como Tu, Pai, és em mim e eu em Ti" (Jo 17.21). A unidade não é uniformidade — é harmonia na diversidade. "Há um só corpo, um só Espírito, uma só esperança, um só Senhor, uma só fé, um só batismo" (Ef 4.4-5). A unidade é obra do Espírito; a divisão, da carne.',
    textos: ['JHN.17.21', 'JHN.17.23', 'EPH.4.3', 'EPH.4.4', 'EPH.4.5', 'EPH.4.13', '1CO.1.10', '1CO.12.12', '1CO.12.13', 'PSA.133.1', 'COL.3.14'],
    relacionados: ['igreja', 'espirito-santo', 'comunhao'],
  },
  {
    id: 'santa-ceia',
    termo: 'Santa Ceia / Eucaristia',
    grego: { palavra: 'εὐχαριστία', translit: 'eucharistia', strong: 'G2169' },
    definicao: 'Jesus partiu o pão e disse: "Isto é o meu corpo" (Lc 22.19). Tomou o cálice: "Este cálice é a nova aliança no meu sangue" (Lc 22.20). A ceia é memorial — não repetição do sacrifício, que foi único (Hb 10.10). É proclamar a morte do Senhor até que Ele venha (1Co 11.26).',
    textos: ['LUK.22.19', 'LUK.22.20', '1CO.11.23', '1CO.11.24', '1CO.11.25', '1CO.11.26', 'MAT.26.26', 'MAT.26.28', '1CO.10.16', 'ACT.2.42'],
    relacionados: ['nova-alianca', 'sangue', 'comunhao'],
  },
  {
    id: 'jejum',
    termo: 'Jejum',
    hebraico: { palavra: 'צוֹם', translit: 'tsom', strong: 'H6685' },
    grego: { palavra: 'νηστεία', translit: 'nēsteia', strong: 'G3521' },
    definicao: 'Não é dieta espiritual — é abrir mão do corpo para buscar a Deus com todo o ser. Jesus jejuou 40 dias e enfrentou a tentação com a Palavra (Mt 4.2-4). Isaías 58 mostra o jejum que Deus quer: não ritual vazio, mas soltar as cadeias, repartir o pão, buscar justiça. Jesus disse "quando jejuardes", não "se" (Mt 6.16).',
    textos: ['MAT.4.2', 'MAT.6.16', 'MAT.6.17', 'MAT.6.18', 'ISA.58.6', 'ISA.58.7', 'ACT.13.2', 'ACT.13.3', 'ACT.14.23', 'JOE.2.12', 'DAN.9.3'],
    relacionados: ['oracao', 'obediencia', 'espirito-santo'],
  },

  /* ─── Termos adicionais de cura (§12) ─── */

  {
    id: 'therapeuo',
    termo: 'Therapeuō — cuidado e cura',
    grego: { palavra: 'θεραπεύω', translit: 'therapeuō', strong: 'G2323' },
    definicao: 'De onde vem "terapia". No NT, descreve o cuidado de Jesus com os doentes — não só a cura instantânea, mas o processo, a atenção, o restaurar. Jesus "percorria todas as cidades… curando (therapeuōn) toda sorte de doenças" (Mt 9.35). É cura com compaixão, não mecânica.',
    textos: ['MAT.4.23', 'MAT.9.35', 'MAT.10.8', 'MAT.12.15', 'LUK.4.40', 'LUK.9.1', 'LUK.9.6', 'ACT.5.16', 'ACT.28.9'],
    relacionados: ['cura', 'dons', 'autoridade'],
  },
  {
    id: 'sozo',
    termo: 'Sōzō — salvação integral',
    grego: { palavra: 'σῴζω', translit: 'sōzō', strong: 'G4982' },
    definicao: 'Sōzō é a palavra mais completa do NT: salvar, curar, libertar, preservar. A mulher com fluxo de sangue "foi salva" (sōzō) — curou do corpo e da alma (Mc 5.34). O mesmo verbo é usado para salvação eterna (Rm 10.9) e para cura física (Tg 5.15). Em Cristo, salvação é restauração total.',
    textos: ['MRK.5.34', 'ROM.10.9', 'JAS.5.15', 'LUK.7.50', 'LUK.8.48', 'ACT.2.21', 'ACT.4.12', 'ACT.16.31', 'EPH.2.8', 'MAT.1.21'],
    relacionados: ['salvacao', 'cura', 'redencao'],
  },

  /* ─── Conceitos de identidade (§15) ─── */

  {
    id: 'corpo-de-cristo',
    termo: 'Corpo de Cristo',
    grego: { palavra: 'σῶμα Χριστοῦ', translit: 'sōma Christou' },
    definicao: 'A igreja não é uma organização — é um organismo, um corpo (1Co 12.27). Cristo é a cabeça; os crentes são os membros. Cada um tem uma função. O olho não pode dizer à mão "não preciso de ti" (1Co 12.21). A diversidade de dons não divide — unifica, quando cada um faz a sua parte (Ef 4.16).',
    textos: ['1CO.12.12', '1CO.12.13', '1CO.12.27', 'EPH.1.22', 'EPH.1.23', 'EPH.4.15', 'EPH.4.16', 'ROM.12.4', 'ROM.12.5', 'COL.1.18', 'COL.2.19'],
    relacionados: ['igreja', 'dons', 'comunhao', 'uno'],
  },
  {
    id: 'sacerdocio-real',
    termo: 'Sacerdócio real',
    grego: { palavra: 'βασίλειον ἱεράτευμα', translit: 'basileion hierateuma', strong: 'G934+G2406' },
    definicao: 'Todo crente é sacerdote — não precisa de intermediário para chegar a Deus (1Pe 2.9). No AT, só a tribo de Levi. Na nova aliança, o véu rasgou (Mt 27.51) e o acesso é direto. "Vós sois geração eleita, sacerdócio real, nação santa" (1Pe 2.9). Isso muda como você ora, como serve e como vive.',
    textos: ['1PE.2.5', '1PE.2.9', 'REV.1.6', 'REV.5.10', 'HEB.10.19', 'HEB.10.22', 'MAT.27.51', 'EXO.19.6', 'ROM.12.1'],
    relacionados: ['sacerdocio', 'identidade-em-cristo', 'nova-alianca', 'adoracao'],
  },

  /* ─── Termos de provisão e prosperidade (§13, cont.) ─── */

  {
    id: 'dizimo',
    termo: 'Dízimo',
    hebraico: { palavra: 'מַעֲשֵׂר', translit: "ma'aser", strong: 'H4643' },
    definicao: 'A décima parte da renda, entregue ao Senhor. Abraão deu o dízimo a Melquisedeque antes da lei (Gn 14.20). Malaquias desafia: "Trazei todos os dízimos e provai-me" (Ml 3.10). No NT, Jesus valida o dízimo (Mt 23.23) e amplia: tudo pertence a Deus, a questão é o coração (2Co 9.7).',
    textos: ['MAL.3.10', 'MAL.3.11', 'GEN.14.20', 'GEN.28.22', 'MAT.23.23', 'LUK.11.42', 'LEV.27.30', 'NUM.18.26', 'HEB.7.2', 'HEB.7.6'],
    relacionados: ['provisao', 'mordomia', 'generosidade', 'alianca'],
  },
  {
    id: 'bencao',
    termo: 'Bênção',
    hebraico: { palavra: 'בָּרַךְ', translit: 'barak', strong: 'H1288' },
    grego: { palavra: 'εὐλογέω', translit: 'eulogeō', strong: 'G2127' },
    definicao: 'Barak é "ajoelhar-se diante de" e também "abençoar". Deus abençoou Abraão e disse: "Em ti serão benditas todas as famílias da terra" (Gn 12.3). Em Cristo, fomos abençoados "com toda sorte de bênção espiritual nos lugares celestiais" (Ef 1.3). A bênção de Deuteronômio 28 é fruto da aliança.',
    textos: ['GEN.12.2', 'GEN.12.3', 'EPH.1.3', 'DEU.28.2', 'DEU.28.3', 'DEU.28.6', 'DEU.28.8', 'NUM.6.24', 'GAL.3.14', 'PSA.1.1', 'PRO.10.22'],
    relacionados: ['provisao', 'alianca', 'graca'],
  },

  /* ─── Revelação e conhecimento ─── */

  {
    id: 'revelacao',
    termo: 'Revelação',
    grego: { palavra: 'ἀποκάλυψις', translit: 'apokalypsis', strong: 'G602' },
    definicao: 'Apocalypsis é "desvelamento" — tirar o véu, mostrar o que estava escondido. Deus se revelou na criação (Rm 1.20), nas Escrituras (2Tm 3.16) e supremamente em Cristo (Hb 1.1-2). Paulo pede ao Pai "espírito de sabedoria e de revelação no conhecimento dele" (Ef 1.17). Revelação é Deus mostrando quem Ele é.',
    textos: ['EPH.1.17', 'GAL.1.12', 'ROM.1.17', 'ROM.1.20', '1CO.2.10', 'HEB.1.1', 'HEB.1.2', 'MAT.16.17', 'DAN.2.28', 'REV.1.1'],
    relacionados: ['palavra', 'espirito-santo', 'sabedoria'],
  },
  {
    id: 'inspiracao',
    termo: 'Inspiração das Escrituras',
    grego: { palavra: 'θεόπνευστος', translit: 'theopneustos', strong: 'G2315' },
    definicao: 'Theopneustos = "soprado por Deus". "Toda Escritura é inspirada por Deus" (2Tm 3.16). Não foi ditado mecânico — Deus usou a personalidade, a cultura e o estilo de cada autor, mas garantiu que o resultado é a Palavra dEle, sem erro. "Homens santos falaram da parte de Deus, movidos pelo Espírito Santo" (2Pe 1.21).',
    textos: ['2TI.3.16', '2TI.3.17', '2PE.1.20', '2PE.1.21', 'HEB.1.1', 'JHN.10.35', 'MAT.5.18', 'PSA.19.7', 'PSA.119.89', 'ISA.40.8'],
    relacionados: ['palavra', 'verdade', 'espirito-santo'],
  },

  /* ─── Trindade ─── */

  {
    id: 'trindade',
    termo: 'Trindade',
    definicao: 'Um só Deus em três pessoas: Pai, Filho e Espírito Santo. A palavra "Trindade" não aparece na Bíblia, mas o conceito está em toda parte: na criação (Gn 1.26, "façamos"), no batismo de Jesus (Mt 3.16-17: o Filho na água, o Espírito descendo, o Pai falando), e na Grande Comissão (Mt 28.19). Não são três deuses, e não são três modos — são três pessoas distintas, um só Deus.',
    textos: ['MAT.28.19', 'MAT.3.16', 'MAT.3.17', '2CO.13.13', 'GEN.1.26', 'JHN.14.16', 'JHN.14.26', '1PE.1.2', 'EPH.4.4', 'EPH.4.5', 'EPH.4.6'],
    relacionados: ['espirito-santo', 'encarnacao', 'soberania'],
  },

  /* ─── Elementos da fé reformada/protestante ─── */

  {
    id: 'sola-scriptura',
    termo: 'Sola Scriptura',
    definicao: 'Somente a Escritura. É o princípio da Reforma: a Bíblia é a autoridade final em matéria de fé e prática. Não significa que tradição e experiência não tenham valor — significa que são avaliadas pela Escritura, não o contrário. "Toda Escritura é inspirada por Deus e útil" (2Tm 3.16).',
    textos: ['2TI.3.16', '2TI.3.17', 'ISA.8.20', 'ACT.17.11', 'PSA.119.105', 'MAT.4.4', 'JHN.17.17', 'PRO.30.5', 'REV.22.18', 'REV.22.19'],
    relacionados: ['palavra', 'inspiracao', 'verdade'],
  },
  {
    id: 'sola-fide',
    termo: 'Sola Fide',
    definicao: 'Somente a fé. A salvação é recebida pela fé, não por obras (Ef 2.8-9). Abraão "creu no Senhor, e isso lhe foi imputado como justiça" (Gn 15.6). A fé não é mérito — é a mão que recebe o presente da graça. Mas a fé verdadeira nunca vem sozinha: produz obras (Tg 2.17) como o fogo produz calor.',
    textos: ['ROM.3.28', 'ROM.4.5', 'ROM.5.1', 'GAL.2.16', 'EPH.2.8', 'EPH.2.9', 'GEN.15.6', 'HAB.2.4', 'JAS.2.17', 'HEB.11.6'],
    relacionados: ['fe', 'justificacao', 'graca'],
  },
  {
    id: 'sola-gratia',
    termo: 'Sola Gratia',
    definicao: 'Somente a graça. A salvação é obra de Deus, do começo ao fim. "Pela graça sois salvos, mediante a fé; e isto não vem de vós; é dom de Deus" (Ef 2.8). Ninguém pode se salvar por esforço — até a fé para crer é um presente. A glória é toda de Deus, porque a iniciativa é toda dEle.',
    textos: ['EPH.2.8', 'EPH.2.9', 'ROM.3.24', 'ROM.11.6', '2TI.1.9', 'TIT.3.5', 'TIT.3.7', 'ROM.5.15', 'ROM.5.17', 'GAL.2.21'],
    relacionados: ['graca', 'justificacao', 'salvacao'],
  },

  /* ─── Vida no Espírito ─── */

  {
    id: 'andar-no-espirito',
    termo: 'Andar no Espírito',
    grego: { palavra: 'πνεύματι περιπατεῖτε', translit: 'pneumati peripateite' },
    definicao: 'É a vida cristã normal: viver guiado pelo Espírito Santo, não pela carne (Gl 5.16). Quem anda no Espírito não cumpre a cobiça da carne — mas não por esforço próprio, e sim porque o Espírito produz fruto (Gl 5.22). É deixar o Espírito conduzir suas decisões, reações e prioridades.',
    textos: ['GAL.5.16', 'GAL.5.18', 'GAL.5.25', 'ROM.8.4', 'ROM.8.5', 'ROM.8.6', 'ROM.8.13', 'ROM.8.14', 'EPH.5.18', 'JHN.16.13'],
    relacionados: ['espirito-santo', 'fruto-espirito', 'santificacao'],
  },
  {
    id: 'renovacao-mente',
    termo: 'Renovação da mente',
    grego: { palavra: 'ἀνακαίνωσις τοῦ νοός', translit: 'anakainōsis tou noos', strong: 'G342' },
    definicao: 'A salvação muda o espírito de uma vez; a mente precisa ser renovada dia a dia (Rm 12.2). É trocar o "sistema operacional" — pensar como Deus pensa, não como o mundo ensinou. Não é esforço de vontade; é exposição à Palavra. "Transformai-vos pela renovação do vosso entendimento" (Rm 12.2).',
    textos: ['ROM.12.2', 'EPH.4.23', 'COL.3.10', '2CO.4.16', 'PHI.4.8', 'ISA.26.3', 'ROM.8.6', '2CO.10.5'],
    relacionados: ['santificacao', 'palavra', 'identidade-em-cristo'],
  },

  /* ─── Termos essenciais para estudo bíblico ─── */

  {
    id: 'tipo',
    termo: 'Tipo / Tipologia',
    grego: { palavra: 'τύπος', translit: 'typos', strong: 'G5179' },
    definicao: 'Tipo é uma "impressão", um molde. Na Bíblia, é quando algo do AT aponta para algo maior no NT — como Adão aponta para Cristo (Rm 5.14), a Páscoa aponta para a cruz, o templo aponta para o crente. Não é coincidência; é Deus contando a mesma história em camadas, até a versão definitiva.',
    textos: ['ROM.5.14', '1CO.10.6', '1CO.10.11', 'HEB.8.5', 'HEB.10.1', 'COL.2.17', '1PE.3.21', 'GAL.4.24', 'JHN.3.14'],
    relacionados: ['messias', 'nova-alianca', 'cordeiro'],
  },
  {
    id: 'parusia',
    termo: 'Parusia',
    grego: { palavra: 'παρουσία', translit: 'parousia', strong: 'G3952' },
    definicao: 'A "presença" ou "chegada" de Cristo — Sua vinda gloriosa e visível. No NT, parusia é usada para a volta de Cristo que os apóstolos esperavam e que nós esperamos. Será pessoal ("assim como o vistes ir" — At 1.11), visível e definitiva. É a esperança que motiva a pureza (1Jo 3.3) e a fidelidade.',
    textos: ['MAT.24.27', 'MAT.24.37', '1CO.15.23', '1TH.2.19', '1TH.3.13', '1TH.4.15', '2TH.2.1', '2TH.2.8', 'JAS.5.7', '2PE.3.4', '1JN.2.28'],
    relacionados: ['segunda-vinda', 'ressurreicao', 'glorificacao'],
  },

  /* ─── Mais conceitos pastorais ─── */

  {
    id: 'chamado',
    termo: 'Chamado / Vocação',
    grego: { palavra: 'κλῆσις', translit: 'klēsis', strong: 'G2821' },
    definicao: 'Deus te chamou — não só para a salvação, mas para um propósito (2Tm 1.9). Todo crente tem um chamado: a vida santa, o serviço no corpo, e a missão específica que Deus preparou (Ef 2.10). Não é só para pastores e missionários — é para todos, no lugar onde estão.',
    textos: ['2TI.1.9', 'EPH.2.10', 'EPH.4.1', 'ROM.8.28', '1CO.7.20', '1PE.2.9', '2PE.1.10', '1TH.2.12', 'HEB.3.1', 'PHI.3.14'],
    relacionados: ['servico', 'dons', 'eleicao'],
  },
  {
    id: 'restituicao',
    termo: 'Restituição / Restauração',
    hebraico: { palavra: 'שׁוּב', translit: 'shuv', strong: 'H7725' },
    grego: { palavra: 'ἀποκατάστασις', translit: 'apokatastasis', strong: 'G605' },
    definicao: 'Deus é o Deus da restituição: "Restituir-vos-ei os anos que o gafanhoto comeu" (Jl 2.25). Em Cristo, o que o pecado destruiu pode ser restaurado — relacionamentos, propósito, dignidade, saúde, alegria. Pedro fala dos "tempos de restauração de todas as coisas" (At 3.21). É promessa para agora e para a eternidade.',
    textos: ['JOE.2.25', 'JOE.2.26', 'ACT.3.21', 'PSA.23.3', 'PSA.51.12', 'ISA.61.7', 'JER.30.17', 'JOB.42.10', '1PE.5.10', 'GAL.6.1'],
    relacionados: ['redencao', 'graca', 'salvacao'],
  },
  {
    id: 'consolo',
    termo: 'Consolo / Consolação',
    grego: { palavra: 'παράκλησις', translit: 'paraklēsis', strong: 'G3874' },
    definicao: 'Paraklēsis é "chamado para o lado" — consolar, encorajar, exortar. Deus é o "Deus de toda consolação" (2Co 1.3). O Espírito Santo é o Paracleto — o Consolador (Jo 14.16). E quem foi consolado consola os outros com o mesmo consolo (2Co 1.4). A dor nunca é desperdiçada nas mãos de Deus.',
    textos: ['2CO.1.3', '2CO.1.4', 'JHN.14.16', 'JHN.14.26', 'ROM.15.4', 'ROM.15.5', 'PHI.2.1', 'PSA.23.4', 'ISA.40.1', '1TH.4.18', '2TH.2.16'],
    relacionados: ['espirito-santo', 'esperanca', 'oracao'],
  },
  {
    id: 'jugo',
    termo: 'Jugo de Cristo',
    grego: { palavra: 'ζυγός', translit: 'zygos', strong: 'G2218' },
    definicao: 'O jugo é a peça de madeira que une dois animais para puxar juntos. Jesus diz: "O meu jugo é suave e o meu fardo é leve" (Mt 11.30). Não é vida sem peso — é peso compartilhado com Ele. Vir a Jesus é trocar o jugo do legalismo e do esforço próprio pelo descanso de trabalhar ao lado dEle.',
    textos: ['MAT.11.28', 'MAT.11.29', 'MAT.11.30', 'GAL.5.1', 'ACT.15.10', '1JN.5.3'],
    relacionados: ['graca', 'obediencia', 'lei'],
  },
  {
    id: 'mansidao',
    termo: 'Mansidão',
    grego: { palavra: 'πραΰτης', translit: 'prautēs', strong: 'G4240' },
    definicao: 'Não é fraqueza — é força sob controle. O cavalo treinado tem toda a força, mas obedece ao cavaleiro. Jesus disse: "Sou manso e humilde de coração" (Mt 11.29) — e é o mesmo que expulsou os cambistas. Moisés era o mais manso da terra (Nm 12.3) e enfrentou Faraó. Mansidão é saber quando usar a força e quando conter.',
    textos: ['MAT.5.5', 'MAT.11.29', 'GAL.5.23', 'EPH.4.2', 'COL.3.12', '1PE.3.15', 'NUM.12.3', 'TIT.3.2', 'JAS.1.21', 'JAS.3.13'],
    relacionados: ['fruto-espirito', 'humildade', 'paciencia'],
  },

  /* ─── Conceitos de missão e Grande Comissão ─── */

  {
    id: 'grande-comissao',
    termo: 'Grande Comissão',
    definicao: 'O último mandamento de Jesus antes de subir ao céu: "Ide, fazei discípulos de todas as nações, batizando-os… ensinando-os" (Mt 28.19-20). Não é para super-cristãos — é para todo crente, cada um no seu alcance. E vem com uma promessa: "Eis que estou convosco todos os dias" (Mt 28.20).',
    textos: ['MAT.28.18', 'MAT.28.19', 'MAT.28.20', 'MRK.16.15', 'MRK.16.20', 'LUK.24.47', 'LUK.24.48', 'ACT.1.8', 'JHN.20.21'],
    relacionados: ['evangelismo', 'discipulado', 'batismo', 'espirito-santo'],
  },
  {
    id: 'testemunho',
    termo: 'Testemunho',
    grego: { palavra: 'μαρτυρία', translit: 'martyria', strong: 'G3141' },
    definicao: 'Martyria é de onde vem "mártir" — a testemunha que fala o que viu, mesmo que custe a vida. "Sereis minhas testemunhas" (At 1.8). O testemunho cristão é pessoal: o que Cristo fez na sua vida. Ninguém pode refutar a sua história. E a palavra do testemunho, junto com o sangue do Cordeiro, vence o acusador (Ap 12.11).',
    textos: ['ACT.1.8', 'ACT.4.33', 'REV.12.11', '1JN.5.11', 'JHN.15.27', 'ACT.22.15', '2TI.1.8', 'PSA.107.2', 'ROM.10.9', 'MRK.5.19'],
    relacionados: ['evangelismo', 'fe', 'espirito-santo'],
  },

  /* ─── Anjos e realidades espirituais ─── */

  {
    id: 'anjos',
    termo: 'Anjos',
    hebraico: { palavra: 'מַלְאָךְ', translit: "mal'ak", strong: 'H4397' },
    grego: { palavra: 'ἄγγελος', translit: 'angelos', strong: 'G32' },
    definicao: 'Mal\'ak e angelos significam "mensageiro". São seres espirituais criados por Deus para servir (Hb 1.14). Não devem ser adorados (Cl 2.18) — servem a Deus e a nós. "O anjo do Senhor acampa-se ao redor dos que o temem" (Sl 34.7). São reais, ativos, e enviados para ajudar quem é herdeiro da salvação.',
    textos: ['HEB.1.14', 'PSA.34.7', 'PSA.91.11', 'PSA.103.20', 'MAT.18.10', 'LUK.1.19', 'LUK.1.26', 'ACT.12.7', 'HEB.13.2', 'COL.2.18', 'REV.22.9'],
    relacionados: ['guerra-espiritual', 'soberania', 'oracao'],
  },
  {
    id: 'satanas',
    termo: 'Satanás / Diabo',
    hebraico: { palavra: 'שָׂטָן', translit: 'satan', strong: 'H7854' },
    grego: { palavra: 'διάβολος', translit: 'diabolos', strong: 'G1228' },
    definicao: 'Satan significa "adversário"; diabolos, "caluniador". É um anjo caído, não o oposto de Deus — é criatura, limitada. Jesus o derrotou na cruz (Cl 2.15). Ele ruge como leão (1Pe 5.8), mas a Escritura manda resistir — firmes na fé (Tg 4.7). Sua arma principal é a mentira (Jo 8.44), e a verdade o desarma.',
    textos: ['GEN.3.1', 'JHN.8.44', '1PE.5.8', 'JAS.4.7', 'EPH.6.11', 'COL.2.15', 'REV.12.9', 'REV.20.10', 'LUK.10.18', '2CO.4.4', '2CO.11.14'],
    relacionados: ['guerra-espiritual', 'autoridade', 'obra-consumada'],
  },

  /* ─── Amor prático ─── */

  {
    id: 'misericordia',
    termo: 'Misericórdia',
    hebraico: { palavra: 'חֶסֶד', translit: 'chesed', strong: 'H2617' },
    grego: { palavra: 'ἔλεος', translit: 'eleos', strong: 'G1656' },
    definicao: 'Chesed é amor leal, fidelidade de aliança — é Deus fazendo o bem mesmo quando você não merece. É mais que perdão: é compaixão ativa. "As misericórdias do Senhor são a causa de não sermos consumidos" (Lm 3.22). Em Cristo, "achemos misericórdia e graça para socorro em ocasião oportuna" (Hb 4.16).',
    textos: ['LAM.3.22', 'LAM.3.23', 'HEB.4.16', 'EPH.2.4', 'TIT.3.5', 'PSA.136.1', 'PSA.103.8', 'MIC.6.8', 'MAT.5.7', 'LUK.6.36', 'ROM.12.1'],
    relacionados: ['graca', 'amor-de-deus', 'perdao'],
  },
  {
    id: 'compaixao',
    termo: 'Compaixão',
    grego: { palavra: 'σπλαγχνίζομαι', translit: 'splanchnizomai', strong: 'G4697' },
    definicao: 'Literalmente "mover-se nas entranhas" — sentir no fundo do ser. Jesus "teve compaixão" antes de curar, multiplicar pães e ensinar (Mt 9.36, 14.14). Não é pena à distância; é dor compartilhada que move à ação. É o coração de Deus batendo em você diante da necessidade do outro.',
    textos: ['MAT.9.36', 'MAT.14.14', 'MAT.15.32', 'MAT.20.34', 'MRK.1.41', 'MRK.6.34', 'LUK.7.13', 'LUK.10.33', 'LUK.15.20', 'COL.3.12'],
    relacionados: ['amor-de-deus', 'misericordia', 'servico'],
  },

  /* ─── Conceitos finais para completar as redes ─── */

  {
    id: 'justificacao-pela-fe',
    termo: 'Justificação pela fé',
    grego: { palavra: 'δικαιωθέντες ἐκ πίστεως', translit: 'dikaiōthentes ek pisteōs' },
    definicao: 'A mensagem central de Romanos e Gálatas: ninguém é declarado justo pelas obras da lei — é pela fé em Cristo (Rm 3.28, Gl 2.16). Abraão creu, e isso lhe foi creditado como justiça (Gn 15.6, Rm 4.3). Não é o que você faz por Deus — é o que Cristo fez por você, recebido pela fé.',
    textos: ['ROM.3.28', 'ROM.4.3', 'ROM.4.5', 'ROM.5.1', 'GAL.2.16', 'GAL.3.6', 'GAL.3.11', 'GEN.15.6', 'HAB.2.4', 'PHI.3.9'],
    relacionados: ['justificacao', 'fe', 'graca', 'sola-fide'],
  },
  {
    id: 'cruz',
    termo: 'Cruz',
    grego: { palavra: 'σταυρός', translit: 'stauros', strong: 'G4716' },
    definicao: 'O instrumento de morte que se tornou símbolo de vitória. "A palavra da cruz é loucura para os que se perdem, mas para nós que somos salvos é o poder de Deus" (1Co 1.18). Na cruz, Cristo derrotou principados e potestades (Cl 2.15), cancelou a dívida (Cl 2.14) e abriu o caminho para Deus (Hb 10.20).',
    textos: ['1CO.1.18', 'GAL.6.14', 'COL.2.14', 'COL.2.15', 'EPH.2.16', 'PHI.2.8', 'HEB.12.2', 'GAL.2.20', '1PE.2.24', 'ROM.6.6'],
    relacionados: ['obra-consumada', 'redencao', 'sangue', 'reconciliacao'],
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
  {
    id: 'agap-',
    nome: 'Família ἀγαπ- (amor)',
    descricao: 'Raiz grega ligada a amor incondicional.',
    termos: [
      { strong: 'G26', lemma: 'ἀγάπη', translit: 'agapē', sentido: 'amor incondicional' },
      { strong: 'G25', lemma: 'ἀγαπάω', translit: 'agapaō', sentido: 'amar incondicionalmente' },
      { strong: 'G27', lemma: 'ἀγαπητός', translit: 'agapētos', sentido: 'amado' },
    ],
    dicionario: 'amor-de-deus',
  },
  {
    id: 'katall-',
    nome: 'Família καταλλ- (reconciliação)',
    descricao: 'Raiz grega ligada a reconciliação, troca, restauração de relação.',
    termos: [
      { strong: 'G2643', lemma: 'καταλλαγή', translit: 'katallagē', sentido: 'reconciliação' },
      { strong: 'G2644', lemma: 'καταλλάσσω', translit: 'katallassō', sentido: 'reconciliar' },
      { strong: 'G604', lemma: 'ἀποκαταλλάσσω', translit: 'apokatallassō', sentido: 'reconciliar plenamente' },
    ],
    dicionario: 'reconciliacao',
  },
  {
    id: 'hilas-',
    nome: 'Família ἱλασ- (propiciação/expiação)',
    descricao: 'Raiz grega ligada a propiciar, expiar, cobrir pecado.',
    termos: [
      { strong: 'G2434', lemma: 'ἱλασμός', translit: 'hilasmos', sentido: 'propiciação' },
      { strong: 'G2435', lemma: 'ἱλαστήριον', translit: 'hilastērion', sentido: 'propiciatório, lugar de expiação' },
      { strong: 'G2433', lemma: 'ἱλάσκομαι', translit: 'hilaskomai', sentido: 'ser propício, expiar' },
    ],
    dicionario: 'propiciacao',
  },
  {
    id: 'klēr-',
    nome: 'Família κληρ- (herança)',
    descricao: 'Raiz grega ligada a herança, sorte, porção.',
    termos: [
      { strong: 'G2817', lemma: 'κληρονομία', translit: 'klēronomia', sentido: 'herança' },
      { strong: 'G2818', lemma: 'κληρονόμος', translit: 'klēronomos', sentido: 'herdeiro' },
      { strong: 'G2816', lemma: 'κληρονομέω', translit: 'klēronomeō', sentido: 'herdar' },
      { strong: 'G4789', lemma: 'συγκληρονόμος', translit: 'synklēronomos', sentido: 'co-herdeiro' },
    ],
    dicionario: 'heranca',
  },
  {
    id: 'basil-',
    nome: 'Família βασιλ- (reino)',
    descricao: 'Raiz grega ligada a rei, reinado, reino.',
    termos: [
      { strong: 'G932', lemma: 'βασιλεία', translit: 'basileia', sentido: 'reino, reinado' },
      { strong: 'G935', lemma: 'βασιλεύς', translit: 'basileus', sentido: 'rei' },
      { strong: 'G936', lemma: 'βασιλεύω', translit: 'basileuō', sentido: 'reinar' },
      { strong: 'G934', lemma: 'βασίλειος', translit: 'basileios', sentido: 'real, régio' },
    ],
    dicionario: 'reino-de-deus',
  },
  {
    id: 'chesed',
    nome: 'Família חסד (misericórdia — hebraico)',
    descricao: 'Raiz hebraica ligada a amor leal, misericórdia, bondade.',
    termos: [
      { strong: 'H2617', lemma: 'חֶסֶד', translit: 'chesed', sentido: 'amor leal, misericórdia, bondade' },
      { strong: 'H2603', lemma: 'חָנַן', translit: 'chanan', sentido: 'ter misericórdia, ser gracioso' },
      { strong: 'H2580', lemma: 'חֵן', translit: 'chen', sentido: 'graça, favor' },
      { strong: 'H7355', lemma: 'רָחַם', translit: 'racham', sentido: 'compadecer-se, ter compaixão' },
      { strong: 'H7356', lemma: 'רַחֲמִים', translit: 'rachamim', sentido: 'misericórdias, compaixão' },
    ],
    dicionario: 'misericordia',
  },
  {
    id: 'berit',
    nome: 'Família ברית (aliança — hebraico)',
    descricao: 'Raiz hebraica ligada a pacto, aliança, acordo.',
    termos: [
      { strong: 'H1285', lemma: 'בְּרִית', translit: 'berit', sentido: 'aliança, pacto' },
      { strong: 'H3772', lemma: 'כָּרַת', translit: 'karat', sentido: 'cortar (fazer aliança)' },
      { strong: 'G1242', lemma: 'διαθήκη', translit: 'diathēkē', sentido: 'aliança, testamento' },
    ],
    dicionario: 'alianca',
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

/* ═══════════════════════════════════════════════════════════════════════════
   GUIAS DOUTRINÁRIOS POR TEMA
   ═══════════════════════════════════════════════════════════════════════════ */

const guias = [
  {
    id: 'justificacao-pela-fe',
    titulo: 'Justificação pela fé',
    descricao: 'O caminho da redenção: de pecador condenado a justo diante de Deus — não por esforço, mas pela fé em Cristo.',
    passos: [
      {
        conceito: 'Pecado',
        resumo: 'Todos pecaram e estão destituídos da glória de Deus.',
        verbete: 'pecado',
        textos: ['ROM.3.23', 'ROM.5.12'],
      },
      {
        conceito: 'Redenção',
        resumo: 'Cristo pagou com o próprio sangue para comprar de volta o que o pecado roubou.',
        verbete: 'redencao',
        textos: ['EPH.1.7', '1PE.1.18', '1PE.1.19'],
      },
      {
        conceito: 'Graça',
        resumo: 'A salvação é de graça — presente de Deus, não esforço humano.',
        verbete: 'graca',
        textos: ['EPH.2.8', 'EPH.2.9', 'ROM.3.24'],
      },
      {
        conceito: 'Fé',
        resumo: 'Recebida pela fé — crer na Palavra de Deus e confiar em Cristo.',
        verbete: 'fe',
        textos: ['ROM.10.17', 'HEB.11.1', 'HEB.11.6'],
      },
      {
        conceito: 'Justificação',
        resumo: 'Deus declara justo quem crê — como se nunca tivesse pecado.',
        verbete: 'justificacao',
        textos: ['ROM.3.28', 'ROM.5.1', 'GAL.2.16'],
      },
      {
        conceito: 'Justiça de Deus',
        resumo: 'A justiça que Deus dá de presente — não conquistada por regras.',
        verbete: 'justica-de-deus',
        textos: ['ROM.3.21', 'ROM.3.22', '2CO.5.21'],
      },
      {
        conceito: 'Nova identidade',
        resumo: 'Em Cristo, nova criação — o velho ficou para trás.',
        verbete: 'nova-criacao',
        textos: ['2CO.5.17', 'GAL.6.15', 'EPH.2.10'],
      },
      {
        conceito: 'Santificação',
        resumo: 'Separado para Deus, sendo transformado dia a dia.',
        verbete: 'santificacao',
        textos: ['1TH.4.3', 'ROM.12.1', 'ROM.12.2'],
      },
      {
        conceito: 'Glorificação',
        resumo: 'O destino final: conformado à imagem de Cristo, para sempre.',
        verbete: 'glorificacao',
        textos: ['ROM.8.30', 'PHI.3.21', '1JN.3.2'],
      },
    ],
  },
  {
    id: 'identidade-em-cristo',
    titulo: 'Identidade em Cristo',
    descricao: 'Quem você é em Cristo: da união com Ele até a autoridade que Ele delegou.',
    passos: [
      {
        conceito: 'União com Cristo',
        resumo: 'Você está em Cristo — morreu com Ele, ressuscitou com Ele.',
        verbete: 'identidade-em-cristo',
        textos: ['GAL.2.20', 'ROM.6.3', 'ROM.6.4', 'EPH.2.6'],
      },
      {
        conceito: 'Nova criação',
        resumo: 'Deus não reforma o velho — cria o novo.',
        verbete: 'nova-criacao',
        textos: ['2CO.5.17', 'EPH.4.24', 'COL.3.10'],
      },
      {
        conceito: 'Justificação',
        resumo: 'Declarado justo diante de Deus.',
        verbete: 'justificacao',
        textos: ['ROM.5.1', 'ROM.8.1', '1CO.6.11'],
      },
      {
        conceito: 'Justiça',
        resumo: 'Feito justiça de Deus em Cristo.',
        verbete: 'justica-de-deus',
        textos: ['2CO.5.21', 'PHI.3.9'],
      },
      {
        conceito: 'Filiação',
        resumo: 'Não empregado, mas filho — com todos os direitos.',
        verbete: 'filiacao',
        textos: ['ROM.8.15', 'GAL.4.5', 'GAL.4.6'],
      },
      {
        conceito: 'Herança',
        resumo: 'Herdeiro de Deus, co-herdeiro com Cristo.',
        verbete: 'heranca',
        textos: ['ROM.8.17', 'EPH.1.11', 'EPH.1.14'],
      },
      {
        conceito: 'Autoridade',
        resumo: 'Toda autoridade foi dada a Jesus — e Ele a delegou a quem crê.',
        verbete: 'autoridade',
        textos: ['LUK.10.19', 'EPH.1.19', 'EPH.2.6'],
      },
      {
        conceito: 'Vida no Espírito',
        resumo: 'Andar guiado pelo Espírito, não pela carne.',
        verbete: 'andar-no-espirito',
        textos: ['GAL.5.16', 'GAL.5.25', 'ROM.8.14'],
      },
    ],
  },
  {
    id: 'palavra-confissao',
    titulo: 'Palavra e confissão',
    descricao: 'Da Palavra no coração à confissão de boca: o ciclo da fé que move montanhas.',
    passos: [
      {
        conceito: 'Palavra de Deus',
        resumo: 'Logos e Rhema — a Escritura completa e a Palavra viva para agora.',
        verbete: 'palavra',
        textos: ['JHN.1.1', 'HEB.4.12', 'ROM.10.17'],
      },
      {
        conceito: 'Ouvir',
        resumo: 'A fé nasce de ouvir a Palavra.',
        verbete: 'rhema',
        textos: ['ROM.10.17', 'MAT.4.4'],
      },
      {
        conceito: 'Fé no coração',
        resumo: 'A fé é certeza do que se espera, convicção do que não se vê.',
        verbete: 'fe',
        textos: ['HEB.11.1', 'ROM.10.10', 'MRK.11.23'],
      },
      {
        conceito: 'Confissão',
        resumo: 'Dizer a mesma coisa que Deus diz — concordar com a Palavra.',
        verbete: 'confissao',
        textos: ['ROM.10.9', 'ROM.10.10', 'HEB.10.23'],
      },
      {
        conceito: 'Ação',
        resumo: 'A fé sem obras é morta — crer é agir de acordo.',
        verbete: 'obediencia',
        textos: ['JAS.2.17', 'JAS.2.26', 'JHN.14.15'],
      },
    ],
  },
  {
    id: 'cura-divina',
    titulo: 'Cura divina',
    descricao: 'De Rapha no AT ao ministério de Jesus e à promessa para a igreja hoje.',
    passos: [
      {
        conceito: 'Rapha — "Eu sou o Senhor que te sara"',
        resumo: 'No AT, Deus se revela como médico do Seu povo.',
        verbete: 'cura',
        textos: ['EXO.15.26', 'PSA.103.3', 'ISA.53.4', 'ISA.53.5'],
      },
      {
        conceito: 'Ministério de Jesus',
        resumo: 'Jesus curou todos que vieram a Ele — sem recusar ninguém.',
        verbete: 'therapeuo',
        textos: ['MAT.4.23', 'MAT.8.17', 'ACT.10.38'],
      },
      {
        conceito: 'Expiação e cura',
        resumo: '"Pelas suas pisaduras fomos sarados" — a cura está na cruz.',
        verbete: 'sozo',
        textos: ['1PE.2.24', 'ISA.53.5', 'MAT.8.17'],
      },
      {
        conceito: 'Dons de cura',
        resumo: 'O Espírito distribui dons de cura à igreja.',
        verbete: 'dons',
        textos: ['1CO.12.9', '1CO.12.28'],
      },
      {
        conceito: 'Oração da fé',
        resumo: 'A oração da fé salvará o doente, e o Senhor o levantará.',
        verbete: 'oracao',
        textos: ['JAS.5.14', 'JAS.5.15', 'MRK.16.18'],
      },
    ],
  },
  {
    id: 'provisao-prosperidade',
    titulo: 'Provisão e prosperidade',
    descricao: 'Da bênção da aliança ao princípio da semeadura: Deus cuida de todas as suas necessidades.',
    passos: [
      {
        conceito: 'Bênção da aliança',
        resumo: 'As promessas de provisão fazem parte da aliança de Deus.',
        verbete: 'bencao',
        textos: ['DEU.28.2', 'DEU.28.8', 'GAL.3.14'],
      },
      {
        conceito: 'Provisão de Deus',
        resumo: '"O meu Deus suprirá todas as vossas necessidades."',
        verbete: 'provisao',
        textos: ['PHI.4.19', 'MAT.6.33', 'PSA.23.1'],
      },
      {
        conceito: 'Semeadura e colheita',
        resumo: 'Quem semeia com fartura, com fartura colhe.',
        verbete: 'generosidade',
        textos: ['2CO.9.6', '2CO.9.7', '2CO.9.8', 'LUK.6.38'],
      },
      {
        conceito: 'Dízimo e oferta',
        resumo: '"Trazei todos os dízimos e provai-me."',
        verbete: 'dizimo',
        textos: ['MAL.3.10', 'MAL.3.11'],
      },
      {
        conceito: 'Mordomia',
        resumo: 'Tudo pertence a Deus; você é administrador fiel.',
        verbete: 'mordomia',
        textos: ['MAT.25.21', '1CO.4.2', '1PE.4.10'],
      },
    ],
  },
  {
    id: 'autoridade-crente',
    titulo: 'Autoridade do crente',
    descricao: 'Do direito recebido ao poder em ação: a procuração que Cristo deu e como usá-la.',
    passos: [
      {
        conceito: 'Exousia — o direito',
        resumo: 'Jesus recebeu toda autoridade e a delegou a quem crê.',
        verbete: 'autoridade',
        textos: ['MAT.28.18', 'LUK.10.19'],
      },
      {
        conceito: 'Dynamis — o poder',
        resumo: 'O Espírito Santo dá a força explosiva para executar.',
        verbete: 'dynamis',
        textos: ['ACT.1.8', 'EPH.1.19', 'EPH.3.20'],
      },
      {
        conceito: 'O nome de Jesus',
        resumo: 'A procuração: agir em nome dEle, com a autoridade dEle.',
        verbete: 'nome-de-jesus',
        textos: ['PHI.2.9', 'PHI.2.10', 'ACT.3.6', 'MRK.16.17'],
      },
      {
        conceito: 'Guerra espiritual',
        resumo: 'A luta não é contra carne — é no Espírito, com armas divinas.',
        verbete: 'guerra-espiritual',
        textos: ['EPH.6.12', 'EPH.6.13', '2CO.10.4', 'COL.2.15'],
      },
      {
        conceito: 'Vida no Espírito',
        resumo: 'Autoridade se exerce andando no Espírito, não na carne.',
        verbete: 'andar-no-espirito',
        textos: ['GAL.5.16', 'ROM.8.14'],
      },
    ],
  },
  {
    id: 'graca',
    titulo: 'Graça',
    descricao: 'O favor imerecido de Deus: de onde vem, como funciona e o que sustenta a vida cristã.',
    passos: [
      {
        conceito: 'Favor imerecido',
        resumo: 'Graça é Deus fazendo por você o que você não consegue.',
        verbete: 'graca',
        textos: ['EPH.2.8', 'EPH.2.9', 'ROM.3.24'],
      },
      {
        conceito: 'Dom gratuito',
        resumo: 'Não é salário — é presente. Dado, não conquistado.',
        verbete: 'sola-gratia',
        textos: ['ROM.5.15', 'ROM.5.17', 'ROM.6.23'],
      },
      {
        conceito: 'Capacitação',
        resumo: 'A graça ensina a viver e dá forças na fraqueza.',
        verbete: 'graca',
        textos: ['TIT.2.11', 'TIT.2.12', '2CO.12.9'],
      },
      {
        conceito: 'Fundamento da salvação',
        resumo: '"Pela graça sois salvos, mediante a fé."',
        verbete: 'salvacao',
        textos: ['EPH.2.8', 'TIT.3.5', '2TI.1.9'],
      },
      {
        conceito: 'Fundamento da vida cristã',
        resumo: '"O pecado não terá domínio sobre vós — estais debaixo da graça."',
        verbete: 'libertacao',
        textos: ['ROM.6.14', 'ROM.5.20', 'ROM.5.21'],
      },
    ],
  },
  {
    id: 'at-nt',
    titulo: 'AT → NT',
    descricao: 'Como o Antigo Testamento aponta para o Novo: promessa e cumprimento, tipo e antítipo, sombra e realidade.',
    passos: [
      {
        conceito: 'Promessa → Cumprimento',
        resumo: 'Mais de 300 profecias messiânicas cumpridas em Jesus.',
        verbete: 'messias',
        textos: ['LUK.24.44', 'MAT.1.22', 'ACT.3.18'],
      },
      {
        conceito: 'Tipo → Antítipo',
        resumo: 'Figuras do AT que apontam para realidades maiores no NT.',
        verbete: 'tipo',
        textos: ['ROM.5.14', '1CO.10.6', 'HEB.8.5'],
      },
      {
        conceito: 'Sombra → Realidade',
        resumo: 'As cerimônias do AT eram sombra — Cristo é o corpo.',
        verbete: 'cordeiro',
        textos: ['COL.2.17', 'HEB.10.1', 'JHN.1.29'],
      },
      {
        conceito: 'Lei → Graça',
        resumo: 'A lei foi o tutor que conduziu a Cristo; agora é graça.',
        verbete: 'lei',
        textos: ['JHN.1.17', 'GAL.3.24', 'ROM.10.4'],
      },
      {
        conceito: 'Antiga aliança → Nova aliança',
        resumo: 'O sangue de Jesus selou algo superior, eterno e definitivo.',
        verbete: 'nova-alianca',
        textos: ['HEB.8.13', 'LUK.22.20', 'JER.31.33'],
      },
    ],
  },
];

// Grava os arquivos
writeFileSync(join(DIR, 'theological-dict.json'), JSON.stringify(dicionario));
writeFileSync(join(DIR, 'semantic-groups.json'), JSON.stringify(familias));
writeFileSync(join(DIR, 'typology.json'), JSON.stringify(tipologia));
writeFileSync(join(DIR, 'doctrinal-guides.json'), JSON.stringify(guias));

console.log(`Dicionário teológico: ${dicionario.length} verbetes.`);
console.log(`Famílias semânticas: ${familias.length} grupos, ${familias.reduce((s, f) => s + f.termos.length, 0)} termos.`);
console.log(`Tipologia AT → NT: ${tipologia.length} pares.`);
console.log(`Guias doutrinários: ${guias.length} temas, ${guias.reduce((s, g) => s + g.passos.length, 0)} passos.`);
console.log(`Gravados em ${DIR}/`);
