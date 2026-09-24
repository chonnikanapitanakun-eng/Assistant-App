import { useTranslation } from 'react-i18next';

import { ComingSoon } from '@/components/coming-soon';

export default function TasksScreen() {
  const { t } = useTranslation();
  return <ComingSoon title={t('nav.tasks')} />;
}
