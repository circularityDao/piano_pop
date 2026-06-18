// SVG icon set — transliterated VERBATIM from recovered module `e469d512`.
import type { SVGProps } from "react";

type IconName =
  | "play"
  | "pause"
  | "note"
  | "home"
  | "replay"
  | "sound"
  | "mute"
  | "gear";

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
}

export function Icon({ name, ...p }: IconProps) {
  const paths: Record<IconName, JSX.Element> = {
    play: <path d="M8 5v14l11-7z" />,
    pause: <path d="M7 5h4v14H7zM13 5h4v14h-4z" />,
    note: (
      <path
        d="M9 17V5l10-2v12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
    home: (
      <path
        d="M3 11l9-8 9 8M5 9.5V21h14V9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
    replay: (
      <path
        d="M4 12a8 8 0 1 1 2.3 5.6M4 12V6m0 6h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
    sound: (
      <path
        d="M4 9v6h4l5 4V5L8 9H4zM16 9a3 3 0 0 1 0 6M18.5 7a6 6 0 0 1 0 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
    mute: (
      <path
        d="M4 9v6h4l5 4V5L8 9H4zM21 9l-5 6M16 9l5 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
    // Added for the new Settings entry point (plan §3-D7). Drawn in the same
    // outlined style as the original icon set.
    gear: (
      <path
        d="M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4 12l-1.6-.9 1.2-3 1.8.4a6.4 6.4 0 0 1 1.5-.9l.4-1.8h3.4l.4 1.8c.5.2 1 .5 1.5.9l1.8-.4 1.2 3L19 12l1.6.9-1.2 3-1.8-.4c-.5.4-1 .7-1.5.9l-.4 1.8h-3.4l-.4-1.8a6.4 6.4 0 0 1-1.5-.9l-1.8.4-1.2-3L4 12z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  };
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      {paths[name]}
    </svg>
  );
}

export type { IconName };
