import { DEFAULT_CHAR_SHEET, type SheetOptions } from '../../domain/sheet';
import type { AppSettings } from '../../store/state';

/** How a printed reading passage looks: the worksheet defaults, in the reader's own colours and design. */
export const readerSheet = (settings: AppSettings): SheetOptions => ({
  ...DEFAULT_CHAR_SHEET,
  palette: settings.readerPalette,
  style: settings.readerStyle,
});
