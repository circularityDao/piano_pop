// Floating ambient sparkles + clouds — transliterated VERBATIM from recovered
// module `e469d512`.
import { Star } from "./Star";

type Sparkle = [string, string, number, number, string];

export function Ambient() {
  const sparkles: Sparkle[] = [
    ["18%", "40%", 0, 22, "#fff"],
    ["80%", "55%", 1.2, 18, "#fff7c2"],
    ["30%", "70%", 0.6, 16, "#ffd7f2"],
    ["70%", "32%", 1.8, 20, "#fff"],
    ["50%", "16%", 0.9, 14, "#e7d4ff"],
    ["10%", "62%", 1.5, 16, "#fff7c2"],
    ["90%", "24%", 0.3, 18, "#ffd7f2"],
    ["60%", "72%", 2.1, 14, "#fff"],
    ["42%", "48%", 1.0, 12, "#fff"],
    ["24%", "22%", 0.5, 16, "#e7d4ff"],
  ];
  return (
    <div className="ambient">
      <div
        className="cloud"
        style={{
          width: 140,
          height: 46,
          left: "8%",
          top: "14%",
          animation: "drift 9s ease-in-out infinite alternate",
        }}
      />
      <div
        className="cloud"
        style={{
          width: 100,
          height: 34,
          right: "12%",
          top: "22%",
          animation: "drift 11s ease-in-out infinite alternate",
        }}
      />
      <div
        className="cloud"
        style={{
          width: 120,
          height: 40,
          left: "62%",
          top: "8%",
          animation: "drift 13s ease-in-out infinite alternate",
        }}
      />
      {sparkles.map((s, i) => (
        <Star
          key={i}
          className="star"
          style={{
            left: s[0],
            top: s[1],
            width: s[3],
            height: s[3],
            color: s[4],
            animation: `twinkle 3s ease-in-out ${s[2]}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
