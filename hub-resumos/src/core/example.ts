import { createMaterial, saveMaterial } from './materials';
import type { Material } from './types';

/**
 * Material de exemplo, para conhecer as visões antes de trazer o próprio
 * texto. Vem marcado como exemplo e pode ser excluído como qualquer outro.
 * O texto usa todas as marcações que o app reconhece: títulos (#), destaque
 * (>), "Termo: definição", listas, perguntas, referências e "- [ ]" de ação.
 */
const EXAMPLE_TEXT = `# Introdução
A parábola do bom samaritano responde a uma pergunta sobre a vida eterna (Lucas 10:25-37). Jesus não discute a teoria do amor ao próximo; ele mostra como esse amor age na estrada.
> Amar o próximo é aproximar-se de quem precisa.
Parábola: história curta que ensina uma verdade espiritual por comparação.
Samaritano: morador de Samaria, desprezado pelos judeus do tempo de Jesus.

# A pergunta do intérprete da lei
O intérprete conhecia o mandamento de Deuteronômio 6:5 e Levítico 19:18, mas quis limitar quem seria o seu próximo.
Quem é o meu próximo?
- Conhecer a lei não é o mesmo que praticá-la
- A pergunta buscava um limite para o amor
- Jesus responde com uma história, não com uma definição

# Os que passaram de largo
O sacerdote e o levita viram o homem ferido e seguiram adiante. A religião sem misericórdia vê a necessidade e muda de lado.
> Ver e passar de largo também é uma escolha.

# A compaixão que age
O samaritano teve compaixão, aproximou-se, tratou as feridas, levou o homem à hospedaria e pagou pelo cuidado. A compaixão de Jesus sempre termina em atitude (Mateus 9:36).
Compaixão: sentir com o outro a ponto de agir em favor dele.
- Ver a necessidade
- Aproximar-se
- Cuidar com o que tem
- Comprometer-se com o que falta

# Aplicação
- [ ] Identificar nesta semana uma pessoa que precisa de ajuda perto de mim
- [ ] Separar tempo e recursos para cuidar de alguém sem esperar retorno
- Orar pedindo um coração compassivo
Qual é a estrada em que Deus me chama a parar?`;

export async function createExampleMaterial(): Promise<Material> {
  const m = await createMaterial({
    title: 'Exemplo — O bom samaritano',
    kind: 'estudo',
    author: 'Material de exemplo do Hub Resumos',
    text: EXAMPLE_TEXT,
    source: { type: 'manual' },
  });
  return saveMaterial({ ...m, tags: ['exemplo'], centralIdea: 'Amar o próximo é aproximar-se de quem precisa e agir com compaixão.' });
}
