import { Link as RouterLink } from 'react-router-dom';
import { citationToHit, type GroundedRunReport } from '../../utils/askTaskForge';
import styles from './Knowledge.module.css';

// Renders a grounded knowledge Run draft: the bounded answer, then each retrieved excerpt with
// its exact recorded quote and a link that rechecks it against the current owned source.
export default function GroundedCitations({ report }: { report: GroundedRunReport }) {
  return (
    <div>
      <p className="os-text-muted os-mt-0 os-mb-3">
        Local AI draft grounded only in the excerpts below. Citations prove where text came from,
        not that it is true. Open a source to check whether the excerpt still matches its current
        version.
      </p>
      <h3 className="tf-h3 os-mt-0 os-mb-1">Question</h3>
      <p className={'os-mt-0 os-mb-3 ' + styles.preWrap}>{report.question}</p>
      <h3 className="tf-h3 os-mt-0 os-mb-1">Draft answer</h3>
      <p className={'os-mt-0 os-mb-3 ' + styles.preWrap}>{report.answer}</p>
      <h3 className="tf-h3 os-mt-0 os-mb-2">
        {report.projectScoped ? 'Retrieved excerpts (project sources)' : 'Retrieved excerpts'}
      </h3>
      <ol className="os-list-unstyled os-m-0 os-p-0">
        {report.excerpts.map((item) => (
          <li key={item.key} className="os-border-top os-py-3">
            <p className="os-text-sm os-text-muted os-m-0">
              [{item.key}] {item.cited ? 'Cited in the answer' : 'Retrieved, not cited'}
            </p>
            <RouterLink
              to={'/knowledge/' + encodeURIComponent(item.sourceId)}
              state={{ citation: citationToHit(item) }}
              className={styles.anywhere}
            >
              {item.title} — version {item.version}
            </RouterLink>
            <blockquote className={styles.quote}>{item.quote}</blockquote>
          </li>
        ))}
      </ol>
    </div>
  );
}
