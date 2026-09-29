import { PixelIcon } from './PixelIcon';

/** Five small pixel hearts, always five wide, so a row never shifts as friendship grows (X2). */
export function Hearts({ n }: { n: number }) {
  return (
    <span className="w-hearts" role="img" aria-label={`Friendship ${n} of 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} data-on={i < n ? '' : undefined}>
          <PixelIcon name={i < n ? 'heart' : 'heart-empty'} size={14} />
        </span>
      ))}
    </span>
  );
}
