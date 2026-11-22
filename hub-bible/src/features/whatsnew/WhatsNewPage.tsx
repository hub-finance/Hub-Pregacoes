import { PageHeader } from '../../components/ui';
import { allWhatsNew } from '../../core/whatsNew';
import { APP_VERSION } from '../../core/edition';
import { WhatsNewList } from './WhatsNewList';

export default function WhatsNewPage() {
  return (
    <div className="page">
      <PageHeader title="Novidades" lead={`O que mudou nas últimas atualizações. Você está na versão ${APP_VERSION}.`} />
      <div className="card">
        <WhatsNewList entries={allWhatsNew()} />
      </div>
    </div>
  );
}
