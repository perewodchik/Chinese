import { useEffect, useState } from 'react';
import type { Due } from '../core/dialogue/source';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

/**
 * The phone at the counter (Y2), 支付宝-style but our own drawing: at a
 * stall you 扫一扫 the code and type the amount you heard (after two wrong
 * amounts it is filled in for you); at a cashier's they scan your 付款码 and
 * you check what they charged — 付款, or 不对. No password, ever: a tap and
 * a fingerprint.
 */
export function PhonePay({ due, balance, fill, onPay, onDispute }: { due: Due; balance: number; fill: boolean; onPay: (amount: number) => void; onDispute: () => void }) {
  const [typed, setTyped] = useState('');
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    if (fill) setTyped(String(due.total));
  }, [fill, due.total]);
  const amount = due.mode === 'code' ? due.charged : Number(typed || '0');
  const short = amount > balance;
  const press = (k: string) => {
    if (k === '⌫') return setTyped((t) => t.slice(0, -1));
    setTyped((t) => {
      const next = t + k;
      return /^\d{0,4}(\.\d?)?$/.test(next) ? next : t;
    });
  };
  const pay = () => {
    if (touch || !amount || short) return;
    setTouch(true);
    // the fingerprint: a moment, then paid
    window.setTimeout(() => {
      setTouch(false);
      setTyped('');
      onPay(amount);
    }, 650);
  };
  return (
    <div className="w-phone" role="group" aria-label="支付宝">
      <div className="w-phone-head">
        <span className="han">支付宝</span>
        <span className="tiny">{due.mode === 'scan' ? '扫一扫' : '付款码'}</span>
        <span className="spacer" />
        <span className="tiny">
          <span className="han">余额</span> ¥{balance.toFixed(2)}
        </span>
      </div>
      <div className="w-phone-shop han">{due.name}</div>
      <div className="w-phone-amount" data-short={short ? '' : undefined}>
        ¥{due.mode === 'code' ? due.charged.toFixed(2) : typed || '0'}
        {short && <span className="tiny han"> 余额不足</span>}
      </div>
      {due.mode === 'scan' ? (
        <div className="w-phone-keys">
          {KEYS.map((k) => (
            <button key={k} type="button" onClick={() => press(k)} aria-label={k === '⌫' ? 'Delete' : k}>
              {k}
            </button>
          ))}
        </div>
      ) : (
        <p className="tiny w-phone-note">The cashier has scanned your code. Is it right? If not, say 不对.</p>
      )}
      <div className="w-phone-go">
        {due.mode === 'code' && (
          <button type="button" className="btn sm" onClick={onDispute}>
            <span className="han">不对</span>
          </button>
        )}
        <button type="button" className="wd-go w-phone-pay" onClick={pay} disabled={!amount || short || touch} data-touch={touch ? '' : undefined}>
          {touch ? '☝ …' : <span className="han">付款</span>}
        </button>
      </div>
    </div>
  );
}
