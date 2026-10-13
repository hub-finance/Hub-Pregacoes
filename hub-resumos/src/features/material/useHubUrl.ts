import { useLiveQuery } from 'dexie-react-hooks';
import { getSetting } from '../../core/db';

/** Endereço do Hub Bible configurado (vazio: sem links para o Hub). */
export const useHubUrl = () => useLiveQuery(() => getSetting('hubUrl', ''), [], '');
