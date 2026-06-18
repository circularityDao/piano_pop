// Piano keyboard — transliterated VERBATIM from recovered module `e469d512`.
// 3 octaves C4..B6 = 21 white + 15 black (octaves [4,5,6], see songs/keys.ts).
// Pointer events give multi-touch + hold support out of the box.
import { forwardRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { PianoKey } from "../songs/schema";

interface PianoProps {
  keys: PianoKey[];
  guideMidi: number | null;
  onPress: (midi: number) => void;
  onRelease?: (midi: number) => void;
}

export const Piano = forwardRef<HTMLDivElement, PianoProps>(function Piano(
  { keys, guideMidi, onPress, onRelease },
  ref
) {
  const whites = keys.filter((k) => k.type === "white");
  const blacks = keys.filter((k) => k.type === "black");
  const n = whites.length;
  const press = (e: ReactPointerEvent<HTMLButtonElement>, midi: number) => {
    e.preventDefault();
    e.currentTarget.classList.add("down");
    onPress(midi);
  };
  const release = (e: ReactPointerEvent<HTMLButtonElement>, midi: number) => {
    e.currentTarget.classList.remove("down");
    if (onRelease) onRelease(midi);
  };
  return (
    <div className="keyboard" ref={ref}>
      {whites.map((k) => (
        <button
          key={k.id}
          className={"wkey" + (guideMidi === k.id ? " guide" : "")}
          data-key={k.id}
          data-type="white"
          onPointerDown={(e) => press(e, k.id)}
          onPointerUp={(e) => release(e, k.id)}
          onPointerLeave={(e) => release(e, k.id)}
          onPointerCancel={(e) => release(e, k.id)}
        >
          <span className="klabel">{k.letter}</span>
        </button>
      ))}
      {blacks.map((k) => (
        <button
          key={k.id}
          className="bkey"
          data-key={k.id}
          data-type="black"
          style={{
            width: `calc((100% - ${(n - 1) * 6}px) / ${n} * 0.6)`,
            left: `calc((100% - ${(n - 1) * 6}px) / ${n} * ${k.whiteIndex + 1} + ${k.whiteIndex * 6}px)`,
          }}
          onPointerDown={(e) => press(e, k.id)}
          onPointerUp={(e) => release(e, k.id)}
          onPointerLeave={(e) => release(e, k.id)}
          onPointerCancel={(e) => release(e, k.id)}
        />
      ))}
    </div>
  );
});
