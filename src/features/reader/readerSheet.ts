import { printSheet, type SheetOptions } from '../../domain/sheet';
import type { AppSettings } from '../../store/state';

/**
 * How a printed reading passage looks: the print colour from Settings, and the
 * Drill layout for the practice pages behind it.
 */
export const readerSheet = (settings: AppSettings): SheetOptions => printSheet('drill', settings.printPalette);
