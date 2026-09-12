import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { paths } from '../navigation/paths';
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

  return (
    <Splash mark="误">
      <p>Something broke on this page.</p>
      <p className="small">{message}</p>
      <div className="row" style={{ justifyContent: 'center', marginTop: 10 }}>
        <button className="btn primary" onClick={() => window.location.reload()}>
          Reload
        </button>
        <Link className="btn" to={paths.review()}>
          Go to Review
        </Link>
      </div>
    </Splash>
  );
}

export function NotFoundPage() {
  useTitle('Not found');
  return (
    <Splash mark="迷">
      <p>Nothing lives at this address.</p>
      <Link className="btn" to={paths.review()} style={{ marginTop: 10 }}>
        Go to Review
      </Link>
    </Splash>
  );
}
