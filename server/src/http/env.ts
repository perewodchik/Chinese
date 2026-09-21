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
  /** development only: the account a request from this machine is signed in as, without a password */
  devUser: string | null;
  /** whether that account may be made on the way in; false on the deployed site's own database */
  devUserCreate: boolean;
  /** where a route says something worth the server's operator seeing */
  log: (line: string) => void;
}
