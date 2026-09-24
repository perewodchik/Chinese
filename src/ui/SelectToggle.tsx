/**
 * The switch between opening cards and picking them. Its width does not
 * change with its label, so nothing beside it moves when it is pressed.
 */
export function SelectToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="btn sm select-toggle"
      aria-pressed={on}
      onClick={onToggle}
      title={on ? 'Stop picking — a tap opens a card again' : 'Pick cards to mark them learned or put them in a collection'}
    >
      {on ? 'Done' : 'Select'}
    </button>
  );
}
