import { useState } from 'react';
import { Link } from 'react-router';
import { paths } from '../../navigation/paths';
import { Icon } from '../../ui/Icon';
import { useTitle } from '../../ui/useTitle';
import { ChangePasswordForm } from '../auth/ChangePasswordForm';
import { AccessTokens } from './AccessTokens';
import { Devices } from './Devices';
import { RecoveryCodes } from './RecoveryCodes';
import './account.css';

/**
 * /account/security (P12): the password, the recovery codes, the devices
 * signed in, the access tokens. The password form opens on asking, rather
 * than standing open on the page.
 *
 * States: the password closed (Change password…), open (the form, Not now).
 */
export function AccountSecurity() {
  useTitle('Security');
  const [changing, setChanging] = useState(false);
  return (
    <section className="account-page">
      <header className="page-head">
        <Link className="back-link" to={paths.account()}>
          <Icon name="back" />
          Account
        </Link>
      </header>
      <h1>Security</h1>

      <section className="block">
        <h2 className="block-title">Password</h2>
        {changing ? (
          <>
            <ChangePasswordForm />
            <button className="btn quiet ac-close" onClick={() => setChanging(false)}>
              Not now
            </button>
          </>
        ) : (
          <button className="btn tonal" aria-expanded={false} onClick={() => setChanging(true)}>
            Change password…
          </button>
        )}
      </section>

      <RecoveryCodes />

      <Devices />

      <AccessTokens />
    </section>
  );
}
