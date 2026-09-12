import type { HttpBindings } from '@hono/node-server';
import type { ActiveSession } from '../application/auth-service';
import type { Services } from '../composition';

/** What every request handler can read from its context. */
export interface AppEnv {
  Bindings: HttpBindings;
  Variables: {
    /** set by `requireSession` */
    session: ActiveSession;
  };
}

export interface RouteDeps extends Services {
  trustProxy: boolean;
}
