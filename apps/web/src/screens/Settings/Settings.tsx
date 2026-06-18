// Settings screen — an intentional NEW addition (plan §3-D7, §7 step 6).
//
// The original standalone app had no visible settings: the recovered
// TweaksPanel only rendered when a no-code-builder host posted
// __activate_edit_mode, so the app always ran on baked defaults. Per the product
// owner's decision we surface all FIVE Tweaks options as a real, persisted,
// portrait-usable in-app screen backed by usePreferences (localStorage). The
// postMessage / __edit_mode_* scaffold is gone.
//
// The five options map 1:1 to the recovered Tweaks controls:
//   Difficulty  -> TweakRadio  (easy / normal / challenge)
//   Note color  -> TweakRadio  (single / rainbow)
//   Show letters-> TweakToggle
//   Guide keys  -> TweakToggle
//   Sky theme   -> TweakColor  (3 curated palettes)
import { Ambient } from "../../components/Ambient";
import { Icon } from "../../components/Icon";
import {
  SKY_OPTIONS,
  type Difficulty,
  type NoteColor,
  type Preferences,
  type SetPref,
  type Sky,
} from "../../state/usePreferences";

interface SettingsProps {
  prefs: Preferences;
  setPref: SetPref;
  onBack: () => void;
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={"seg-btn" + (o.value === value ? " on" : "")}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="pp-toggle"
      role="switch"
      aria-checked={value}
      data-on={value ? "1" : "0"}
      onClick={() => onChange(!value)}
    >
      <i />
    </button>
  );
}

function skyKey(s: Sky): string {
  return s.join("|").toLowerCase();
}

export function Settings({ prefs, setPref, onBack }: SettingsProps) {
  return (
    <div className="screen active">
      <Ambient />
      <div className="settings-card">
        <div className="settings-head">
          <button
            className="hud-btn settings-back"
            onClick={onBack}
            aria-label="Back"
            title="Back"
          >
            <Icon name="home" />
          </button>
          <h2>Settings</h2>
        </div>

        <div className="settings-body">
          <div className="settings-section">Difficulty</div>
          <div className="settings-row">
            <span className="settings-label">Level</span>
            <Segmented<Difficulty>
              value={prefs.difficulty}
              options={[
                { value: "easy", label: "Easy" },
                { value: "normal", label: "Normal" },
                { value: "challenge", label: "Challenge" },
              ]}
              onChange={(v) => setPref("difficulty", v)}
            />
          </div>

          <div className="settings-section">Falling notes</div>
          <div className="settings-row">
            <span className="settings-label">Color</span>
            <Segmented<NoteColor>
              value={prefs.noteColor}
              options={[
                { value: "single", label: "Single" },
                { value: "rainbow", label: "Rainbow" },
              ]}
              onChange={(v) => setPref("noteColor", v)}
            />
          </div>
          <div className="settings-row settings-row-h">
            <span className="settings-label">Show note letters</span>
            <Toggle
              value={prefs.showLetters}
              onChange={(v) => setPref("showLetters", v)}
            />
          </div>
          <div className="settings-row settings-row-h">
            <span className="settings-label">Highlight next key</span>
            <Toggle
              value={prefs.guideKeys}
              onChange={(v) => setPref("guideKeys", v)}
            />
          </div>

          <div className="settings-section">Scene</div>
          <div className="settings-row">
            <span className="settings-label">Sky</span>
            <div className="sky-chips" role="radiogroup">
              {SKY_OPTIONS.map((s, i) => {
                const on = skyKey(s) === skyKey(prefs.sky);
                return (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    className={"sky-chip" + (on ? " on" : "")}
                    style={{
                      background: `linear-gradient(135deg, ${s[0]}, ${s[1]})`,
                    }}
                    onClick={() => setPref("sky", s)}
                    aria-label={`Sky ${i + 1}`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <button className="btn btn-resume settings-done" onClick={onBack}>
          Done
        </button>
      </div>
    </div>
  );
}
