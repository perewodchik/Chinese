import { useEffect, useState } from 'react';
import type { AuthOptionsResponse } from '../../../shared/api';
import { authApi } from '../../api/auth';
import { ApiError } from '../../api/http';

/** What to tell a person about a failed request, in a sentence they can act on. */
export function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    return err.code === 'network' ? `${err.message} Is the server running?` : err.message;
  }
  return err instanceof Error ? err.message : 'Something went wrong.';
}

let options: Promise<AuthOptionsResponse> | null = null;

/** Whether this server lets people make accounts — or null until it has said. */
export function useRegistration(): AuthOptionsResponse['registration'] | null {
  const [registration, setRegistration] = useState<AuthOptionsResponse['registration'] | null>(null);

  useEffect(() => {
    let live = true;
    options ??= authApi.options();
    options.then(
      (o) => live && setRegistration(o.registration),
      () => {
        options = null;
      },
    );
    return () => {
      live = false;
    };
  }, []);

  return registration;
}
