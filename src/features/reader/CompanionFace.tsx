import type { CastMember } from '../../domain/companion';

/**
 * A person of a book with a companion: the face cut from the chapters' own
 * pictures, or, for someone without one, the first character of the name the
 * book uses — never an empty circle.
 */
export function CompanionFace({ member, name, size = 44 }: { member: CastMember | undefined; name: string | null; size?: number }) {
  return (
    <span className="cp-face" style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }} aria-hidden>
      {member?.face ? <img src={`/companion/faces/${member.face}.jpg`} alt="" width={size} height={size} /> : <span className="hanzi">{name ? [...name][0] : '？'}</span>}
    </span>
  );
}
