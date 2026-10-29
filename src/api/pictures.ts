import { API } from '../../shared/api';

/** Where a text's drawn picture is fetched from; the key is the picture, so the address never goes stale. */
export const pictureUrl = (key: string) => `${API.pictures}/${key}`;
