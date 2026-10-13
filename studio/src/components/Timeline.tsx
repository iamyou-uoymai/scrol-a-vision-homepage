import { useState } from "react";
import type { CSSProperties } from "react";
import type { AnimationTarget, CompositionCueTrack, PresentationIntervalCue, Shot } from "../types/story";
import type { CompiledPath } from "../data/pathCompiler";
import type { NarrativePathAllocation, NarrativeUnitView } from "../data/studioPath";
import type { StudioSelectionProjection } from "../data/studioSelection";
import { PathEditor } from "./PathEditor";
import type { ShotPathAllocation } from "../player/progress";

interface TimelineProps {
  shot: Shot;
  playhead: number;
  onPlayheadChange: (progress: number) => void;
  onCueSelect: (id: string) => void;
  onCueAdd: (track: CompositionCueTrack) => void;
  onCreativeIntervalAdd: (kind: PresentationIntervalCue["kind"]) => void;
  onCreativeIntervalSelect: (id: string) => void;
  animationTarget: AnimationTarget;
  selectedKeyframe?: { id: string; target: AnimationTarget };
  onAnimationTargetChange: (target: AnimationTarget) => void;
  onKeyframeAdd: (target: AnimationTarget) => void;
  onKeyframeSelect: (target: AnimationTarget, id: string) => void;
  compositionPath: CompiledPath<ShotPathAllocation>;
  narrativePath: CompiledPath<NarrativePathAllocation>;
  selection: StudioSelectionProjection["path"];
  selectedPathSpan?: { start: number; end: number };
  onPathShotSelect: (shot: Shot) => void;
  onNarrativeSelect: (unit: NarrativeUnitView) => void;
}

const tracks: { id: CompositionCueTrack; label: string }[] = [
  { id: "camera", label: "Camera" },
  { id: "character", label: "Character" },
  { id: "dialogue", label: "Dialogue" },
  { id: "sound", label: "Sound" },
  { id: "scroll", label: "Scroll" },
];

const trackColors: Record<CompositionCueTrack, string> = {
  camera: "#66b7c4",
  character: "#9ab98f",
  dialogue: "#e9a157",
  sound: "#be9bd0",
  scroll: "#e6cf7d",
};

export function Timeline({ shot, playhead, onPlayheadChange, onCueSelect, onCueAdd, onCreativeIntervalAdd, onCreativeIntervalSelect, animationTarget, selectedKeyframe, onAnimationTargetChange, onKeyframeAdd, onKeyframeSelect, compositionPath, narrativePath, selection, selectedPathSpan, onPathShotSelect, onNarrativeSelect }: TimelineProps) {
  const [newTrack, setNewTrack] = useState<CompositionCueTrack>("camera");
  const [newIntervalKind, setNewIntervalKind] = useState<PresentationIntervalCue["kind"] | "">("");
  const targetValue = animationTarget.type === "camera" ? "camera" : `layer:${animationTarget.layerId}`;
  const keyframeTracks = [
    { target: { type: "camera" } as const, label: "Camera", keyframes: shot.animation.camera },
    ...shot.layers.map((layer) => ({
      target: { type: "layer", layerId: layer.id } as const,
      label: layer.name,
      keyframes: shot.animation.layers[layer.id] ?? [],
    })),
  ].filter((track) => track.keyframes.length > 0);

  return (
    <section className="timeline-panel" aria-label="Shot timeline">
      <PathEditor
        compositionPath={compositionPath}
        narrativePath={narrativePath}
        selection={selection}
        previewPosition={playhead}
        selectedPathSpan={selectedPathSpan}
        onShotSelect={onPathShotSelect}
        onNarrativeSelect={onNarrativeSelect}
      />
      <div className="timeline-header">
        <div className="timeline-title"><span className="eyebrow">DIRECTING</span><h2>Timeline</h2></div>
        <div className="timeline-tools">
          <label className="track-picker-label" htmlFor="new-cue-track">New cue</label>
          <select id="new-cue-track" value={newTrack} onChange={(event) => setNewTrack(event.target.value as CompositionCueTrack)}>
            {tracks.map((track) => <option value={track.id} key={track.id}>{track.label}</option>)}
          </select>
          <button type="button" className="add-beat-button" onClick={() => onCueAdd(newTrack)}>Add cue</button>
          <span className="timeline-divider" aria-hidden="true" />
          <label className="track-picker-label" htmlFor="new-creative-interval">Presentation cue</label>
          <select id="new-creative-interval" value={newIntervalKind} onChange={(event) => setNewIntervalKind(event.target.value as PresentationIntervalCue["kind"] | "")}>
            <option value="">Choose type</option>
            <option value="silence">Silence</option>
            <option value="void">Void</option>
          </select>
          <button type="button" className="add-beat-button" disabled={!newIntervalKind} onClick={() => {
            if (!newIntervalKind) return;
            onCreativeIntervalAdd(newIntervalKind);
          }}>Add interval</button>
          <span className="timeline-divider" aria-hidden="true" />
          <label className="track-picker-label" htmlFor="animation-target">Animate</label>
          <select
            id="animation-target"
            aria-label="Animation target"
            value={targetValue}
            onChange={(event) => {
              const value = event.target.value;
              onAnimationTargetChange(value === "camera"
                ? { type: "camera" }
                : { type: "layer", layerId: value.slice("layer:".length) });
            }}
          >
            <option value="camera">Camera</option>
            {shot.layers.map((layer) => <option value={`layer:${layer.id}`} key={layer.id}>{layer.name}</option>)}
          </select>
          <button type="button" className="add-beat-button keyframe-add-button" onClick={() => onKeyframeAdd(animationTarget)}>Add keyframe</button>
          <span className="timeline-divider" aria-hidden="true" />
          <span className="progress-label">PLAYHEAD</span>
          <output className="progress-value" aria-live="polite">{Math.round(playhead * 100)}%</output>
          <input
            className="playhead-range"
            type="range"
            min="0"
            max="100"
            step="1"
            value={Math.round(playhead * 100)}
            aria-label="Timeline playhead progress"
            onChange={(event) => onPlayheadChange(Number(event.target.value) / 100)}
          />
        </div>
      </div>
      <div className="timeline-ruler" aria-hidden="true">
        <span />
        <div className="ruler-marks"><i>0%</i><i>25%</i><i>50%</i><i>75%</i><i>100%</i></div>
      </div>
      <div className="timeline-tracks">
        {tracks.map((track) => {
          const trackCues = shot.cues.filter((cue) => cue.track === track.id);
          const laneStyle = { "--track-color": trackColors[track.id] } as CSSProperties;
          return (
            <div className={`track-row track-row-${track.id}`} key={track.id}>
              <div className="track-label"><i style={{ backgroundColor: trackColors[track.id] }} />{track.label}</div>
              <div className="track-lane" style={laneStyle}>
                {trackCues.map((cue) => (
                  <button
                    type="button"
                    key={cue.id}
                    className="beat-block"
                    style={{ left: `${cue.start * 100}%`, width: `${Math.max(cue.duration * 100, 2)}%` }}
                    onClick={() => onCueSelect(cue.id)}
                    aria-label={`${track.label} cue: ${cue.label}`}
                    title={cue.label}
                  >
                    <span>{cue.label}</span>
                  </button>
                ))}
                <span className="playhead-line" style={{ left: `${playhead * 100}%` }} aria-hidden="true" />
              </div>
            </div>
          );
        })}
      </div>
      {(shot.creativeIntervals?.length ?? 0) > 0 && (
        <div className="creative-interval-tracks" aria-label="Intentional Shot intervals">
          {(["silence", "void"] as const).map((kind) => {
            const intervals = (shot.creativeIntervals ?? []).filter((interval) => interval.kind === kind);
            if (intervals.length === 0) return null;
            return (
              <div className={`track-row interval-track-row interval-track-${kind}`} key={kind}>
                <div className="track-label">{kind === "silence" ? "Silence · audio" : "Void · visual"}</div>
                <div className="track-lane interval-lane">
                  {intervals.map((interval) => {
                    const selected = selection.object.domain === "composition"
                      && selection.object.kind === "creative-interval"
                      && selection.object.id === interval.id;
                    return (
                      <button
                        type="button"
                        className={`interval-block${selected ? " is-selected" : ""}`}
                        style={{ left: `${interval.start * 100}%`, width: `${Math.max((interval.end - interval.start) * 100, 1)}%` }}
                        key={interval.id}
                        aria-pressed={selected}
                        aria-label={`Select ${kind} interval from ${Math.round(interval.start * 100)}% to ${Math.round(interval.end * 100)}%`}
                        title={`${kind[0].toUpperCase() + kind.slice(1)} · ${Math.round(interval.start * 100)}%–${Math.round(interval.end * 100)}%${interval.intent ? ` · ${interval.intent}` : ""}`}
                        onClick={() => onCreativeIntervalSelect(interval.id)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {keyframeTracks.length > 0 && (
        <div className="timeline-keyframes" aria-label="Animation keyframes">
          <div className="keyframe-tracks-heading">ANIMATION KEYFRAMES</div>
          <div className="timeline-tracks">
            {keyframeTracks.map((track) => (
              <div className="track-row keyframe-track-row" key={track.target.type === "camera" ? "camera" : track.target.layerId}>
                <div className="track-label" title={track.label}>{track.label}</div>
                <div className="track-lane keyframe-lane">
                  {track.keyframes.map((keyframe) => (
                    <button
                      type="button"
                      className={`keyframe-marker${selectedKeyframe?.id === keyframe.id ? " is-selected" : ""}`}
                      key={keyframe.id}
                      style={{
                        left: `${keyframe.progress * 100}%`,
                        transform: `translateX(${keyframe.progress === 0 ? "0" : keyframe.progress === 1 ? "-100%" : "-50%"})`,
                      }}
                      aria-label={`Select ${track.label} keyframe at ${Math.round(keyframe.progress * 100)}%`}
                      aria-pressed={selectedKeyframe?.id === keyframe.id}
                      title={`${track.label} · ${Math.round(keyframe.progress * 100)}%`}
                      onClick={() => onKeyframeSelect(track.target, keyframe.id)}
                    />
                  ))}
                  <span className="playhead-line" style={{ left: `${playhead * 100}%` }} aria-hidden="true" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="timeline-caption"><span>{shot.title}</span><span>Scroll progress drives authored camera and layer keyframes.</span></div>
    </section>
  );
}