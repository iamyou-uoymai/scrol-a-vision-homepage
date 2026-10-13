import type { PresentationIntervalCue, PresentationIntervalCueUpdate } from "../types/story";

interface CreativeIntervalInspectorProps {
  interval: PresentationIntervalCue;
  onUpdate: (update: PresentationIntervalCueUpdate) => void;
  onRemove: () => void;
}

const intervalDefinitions: Record<PresentationIntervalCue["kind"], string> = {
  silence: "An intentional absence or reduction of audible material. It does not require an empty or motionless visual composition.",
  void: "An interval of deliberately reduced visual information. It does not stop audio and is not a loading gap or missing asset.",
};

export function CreativeIntervalInspector({ interval, onUpdate, onRemove }: CreativeIntervalInspectorProps) {
  const startPercent = Math.round(interval.start * 100);
  const endPercent = Math.round(interval.end * 100);

  return (
    <aside className="inspector-panel narrative-inspector" aria-label="Intentional interval properties">
      <div className="panel-heading"><h2>{interval.kind[0].toUpperCase() + interval.kind.slice(1)}</h2><span className="read-only-chip">PRESENTATION CUE</span></div>
      <label className="narrative-field">
        <span>Type</span>
        <select value={interval.kind} onChange={(event) => {
          const kind = event.target.value as PresentationIntervalCue["kind"];
          onUpdate(kind === "silence" ? { kind, audioChannel: "audioChannel" in interval ? interval.audioChannel : undefined } : { kind });
        }}>
          <option value="silence">Silence</option>
          <option value="void">Void</option>
        </select>
      </label>
      {interval.kind === "silence" && (
        <label className="narrative-field"><span>Audio channel</span><input type="text" value={interval.audioChannel ?? ""} onChange={(event) => onUpdate({ audioChannel: event.target.value || undefined })} /></label>
      )}
      <p className="interval-definition">{intervalDefinitions[interval.kind]}</p>
      <div className="field-row">
        <label className="field-group"><span>Start</span><span className="number-field-wrap"><input type="number" min="0" max={Math.max(0, endPercent - 1)} value={startPercent} onChange={(event) => {
          const value = Number(event.target.value) / 100;
          onUpdate({ start: Math.max(0, Math.min(interval.end - 0.000001, value)) });
        }} /><i>%</i></span></label>
        <label className="field-group"><span>End</span><span className="number-field-wrap"><input type="number" min={Math.min(100, startPercent + 1)} max="100" value={endPercent} onChange={(event) => {
          const value = Number(event.target.value) / 100;
          onUpdate({ end: Math.min(1, Math.max(interval.start + 0.000001, value)) });
        }} /><i>%</i></span></label>
      </div>
      <label className="narrative-field"><span>Intent note</span><textarea rows={3} value={interval.intent ?? ""} onChange={(event) => onUpdate({ intent: event.target.value || undefined })} /></label>
      <button type="button" className="destructive-action" onClick={onRemove}>Remove interval</button>
      <p className="inspector-hint">This typed annotation is saved independently. The current Player does not execute it.</p>
    </aside>
  );
}