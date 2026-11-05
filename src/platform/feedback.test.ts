import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { feedbackUrl, fillFeedback, hasFeedback } from './feedback';

const FORM = 'https://docs.google.com/forms/d/e/abc/viewform?usp=pp_url&entry.1=%PAGE%&entry.2=%USER%&entry.3=%MESSAGE%';

describe('the feedback form’s address', () => {
  it('is nothing when the site has no form', () => {
    assert.equal(hasFeedback(), false);
    assert.equal(feedbackUrl('/read', 'masha'), null);
  });

  it('carries the page, the name and what went wrong, and drops the message field when there is none', () => {
    assert.equal(fillFeedback(FORM, '/read/s1', 'masha', 'x is not a function'), 'https://docs.google.com/forms/d/e/abc/viewform?usp=pp_url&entry.1=%2Fread%2Fs1&entry.2=masha&entry.3=x%20is%20not%20a%20function');
    assert.equal(fillFeedback(FORM, '/today', 'Маша'), 'https://docs.google.com/forms/d/e/abc/viewform?usp=pp_url&entry.1=%2Ftoday&entry.2=%D0%9C%D0%B0%D1%88%D0%B0');
  });
});
