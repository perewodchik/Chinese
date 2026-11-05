import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { paths } from '../navigation/paths';
import { feedbackUrl } from '../platform/feedback';
import { Splash } from '../ui/Splash';
import { useTitle } from '../ui/useTitle';

/** What a page shows when it threw while rendering, instead of a blank screen. */
export function RouteError() {
  const error = useRouteError();
  useTitle('Something broke');
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : String(error);

  // The form, with this page and the error's words already in it; no name, since the session may be what broke.
  const feedback = feedbackUrl(window.location.pathname, '', message);
  return (
    <Splash mark="误">
      <p>Something broke on this page.</p>
      <p className="small">{message}</p>
      <div className="row" style={{ justifyContent: 'center', marginTop: 10 }}>
        <button className="btn primary" onClick={() => window.location.reload()}>
          Reload
        </button>
        <Link className="btn" to={paths.today()}>
          Go to Today
        </Link>
      </div>
      {feedback && (
        <p className="small" style={{ marginTop: 14 }}>
          <a href={feedback} target="_blank" rel="noreferrer">
            Tell whoever runs the site what happened
          </a>
        </p>
      )}
    </Splash>
  );
}

export function NotFoundPage() {
  useTitle('Not found');
  return (
    <Splash mark="迷">
      <p>Nothing lives at this address.</p>
      <Link className="btn primary" to={paths.today()} style={{ marginTop: 10 }}>
        Go to Today
      </Link>
    </Splash>
  );
}
