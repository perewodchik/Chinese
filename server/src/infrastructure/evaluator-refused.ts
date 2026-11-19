/** A speech evaluation service said no: to the keys themselves, or to this one request. */
export class EvaluatorRefused extends Error {
  constructor(
    message: string,
    readonly reason: 'keys' | 'failed',
  ) {
    super(message);
  }
}
