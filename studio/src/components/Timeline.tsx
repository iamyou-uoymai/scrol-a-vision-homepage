import { useState } from "react";
import type { CSSProperties } from "react";
import type { AnimationTarget, BeatTrack, Shot } from "../types/story";

interface TimelineProps {
  shot: Shot;
  playhead: number;
  onPlayheadChange: (progress: number) => void;
  onBeatSelect: (id: string) => void;
  onBeatAdd: (track: BeatTrack) => void;
  animationTarget: AnimationTarget;
  selectedKeyframe?: { id: string; target: AnimationTarget };
  onAnimationTargetChange: (target: AnimationTarget) => void;
  onKeyframeAdd: (target: AnimationTarget) => void;
  onKeyframeSelect: (target: AnimationTarget, id: string) => void;
}

const tracks: { id: BeatTrack; label: string }[] = [
  { id: "camera", label: "Camera" },
  { id: "character", label: "Character" },
  { id: "dialogue", label: "Dialogue" },
  { id: "sound", label: "Sound" },
  { id: "scroll", label: "Scroll" },
];

const trackColors: Record<BeatTrack, string> = {
  camera: "#66b7c4",
  character: "#9ab98f",
  dialogue: "#e9a157",
  sound: "#be9bd0",
  scroll: "#e6cf7d",
};

export function Timeline({ shot, playhead, onPlayheadChange, onBeatSelect, onBeatAdd, animationTarget, selectedKeyframe, onAnimationTargetChange, onKeyframeAdd, onKeyframeSelect }: TimelineProps) {
  const [newTrack, setNewTrack] = useState<BeatTrack>("camera");
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
      <div className="timeline-header">
        <div className="timeline-title"><span className="eyebrow">DIRECTING</span><h2>Timeline</h2></div>
        <div className="timeline-tools">
          <label className="track-picker-label" htmlFor="new-beat-track">New beat</label>
          <select id="new-beat-track" value={newTrack} onChange={(event) => setNewTrack(event.target.value as BeatTrack)}>
            {tracks.map((track) => <option value={track.id} key={track.id}>{track.label}</option>)}
          </select>
          <button type="button" className="add-beat-button" onClick={() => onBeatAdd(newTrack)}>Add beat</button>
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
          const trackBeats = shot.beats.filter((beat) => beat.track === track.id);
          const laneStyle = { "--track-color": trackColors[track.id] } as CSSProperties;
          return (
            <div className={`track-row track-row-${track.id}`} key={track.id}>
              <div className="track-label"><i style={{ backgroundColor: trackColors[track.id] }} />{track.label}</div>
              <div className="track-lane" style={laneStyle}>
                {trackBeats.map((beat) => (
                  <button
                    type="button"
                    key={beat.id}
                    className="beat-block"
                    style={{ left: `${beat.start * 100}%`, width: `${Math.max(beat.duration * 100, 2)}%` }}
                    onClick={() => onBeatSelect(beat.id)}
                    aria-label={`${track.label} beat: ${beat.label}`}
                    title={beat.label}
                  >
                    <span>{beat.label}</span>
                  </button>
                ))}
                <span className="playhead-line" style={{ left: `${playhead * 100}%` }} aria-hidden="true" />
              </div>
            </div>
          );
        })}
      </div>
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