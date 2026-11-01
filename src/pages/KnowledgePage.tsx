import { Link } from 'react-router';
import { SectionStub } from '../components/SectionStub';

export const KnowledgePage = () => (
  <SectionStub
    title="База знаний"
    description="Здесь будут заметки, разложенные по темам. Пока мысли собираются во входящих."
  >
    <Link to="/inbox" className="btn stub-action">
      Открыть Inbox
    </Link>
  </SectionStub>
);
