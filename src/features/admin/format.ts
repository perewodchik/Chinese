/** How the site's pages say a day, a size and a count. */
export const day = (at: number) => new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
const MB = 1024 * 1024;
export const mb = (b: number) => (b < MB ? '<1 MB' : `${Math.round(b / MB).toLocaleString('en')} MB`);
export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;
