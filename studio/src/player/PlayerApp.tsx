import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";
import cityBackdrop from "../../../assets/player-city-demo.jpg";
import travelerArtwork from "../../../assets/traveler.svg";
import { loadStoredStory, parseImportedStory } from "../data/storyStorage";
import { sampleStory } from "../data/sampleStory";
import type { LayerTransform, Shot, Story, VisualLayer } from "../types/story";
import { DEFAULT_CAMERA_TRANSFORM, evaluateAnimationTrack } from "../data/animation";
import {
  mapScrollToProgress,
  resolveShotAtProgress,
  visibilityThroughBeat,
} from "./progress";

function loadPlayerStory(): Story {
  try {
    return loadStoredStory(window.localStorage).story;
  } catch {
    return sampleStory;
  }
}

function getLayerStyle(kind: VisualLayer["kind"], transform: LayerTransform): CSSProperties {
  const width = kind === "background"
    ? "100%"
    : kind === "character"
      ? "clamp(150px, 19vw, 270px)"
      : "min(35rem, calc(100vw - 40px))";
  const height = kind === "background" ? "100%" : kind === "character" ? "72%" : "auto";

  return {
    left: `${transform.x}%`,
    top: `${transform.y}%`,
    width,
    height,
    opacity: transform.opacity / 100,
    transform: `translate(-50%, -50%) rotate(${transform.rotation}deg) scale(${transform.scale / 100})`,
  };
}

function layerTransformAtProgress(
  shot: Shot,
  layer: VisualLayer,
  progress: number,
  reducedMotion: boolean,
): LayerTransform {
  const track = shot.animation.layers[layer.id];
  if (reducedMotion) return track?.[0]?.transform ?? layer.transform;
  return evaluateAnimationTrack(track, progress) ?? layer.transform;
}

export function PlayerApp() {
  const [story, setStory] = useState(loadPlayerStory);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const runwayRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    window.scrollTo(0, 0);

    const updateProgress = () => {
      const runway = runwayRef.current;
      if (!runway) return;
      const runwayStart = runway.getBoundingClientRect().top + window.scrollY;
      setProgress(mapScrollToProgress(window.scrollY, runwayStart, runway.offsetHeight, window.innerHeight));
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
      window.history.scrollRestoration = previousRestoration;
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(media.matches);
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  const chapter = story.chapters[0];
  const scene = chapter?.scenes[0];
  const playback = resolveShotAtProgress(scene?.shots, progress);

  async function handleStoryFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      setStory(parseImportedStory(await file.text()));
      setError("");
      setProgress(0);
      window.scrollTo(0, 0);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "The selected project could not be opened.");
    } finally {
      input.value = "";
    }
  }

  if (!chapter || !scene || !playback) {
    const message = !chapter
      ? "This story does not contain a playable chapter."
      : !scene
        ? "The first chapter does not contain a playable scene."
        : `The first scene, ${scene.title}, does not contain any playable shots.`;
    return <main className="player-empty">{message}</main>;
  }

  const { shot, index: shotIndex, localProgress } = playback;
  const backgroundLayers = shot.layers.filter((layer) => layer.kind === "background");
  const characterLayers = shot.layers.filter((layer) => layer.kind === "character");
  const dialogueLayers = shot.layers.filter((layer) => layer.kind === "dialogue");
  const dialogueBeats = shot.beats.filter((beat) => beat.track === "dialogue");
  const cameraTrack = shot.animation.camera;
  const camera = prefersReducedMotion
    ? cameraTrack[0]?.transform ?? DEFAULT_CAMERA_TRANSFORM
    : evaluateAnimationTrack(cameraTrack, localProgress) ?? DEFAULT_CAMERA_TRANSFORM;
  const cameraStyle: CSSProperties = {
    transform: `translate3d(${camera.x}%, ${camera.y}%, 0) rotate(${camera.rotation}deg) scale(${camera.scale / 100})`,
  };

  return (
    <main className="player-document" aria-label={`${story.title} player`}>
      <div className="player-runway" ref={runwayRef} style={{ height: `${100 + scene.shots.length * 200}svh` }}>
        <section className="player-viewport" aria-label={`${scene.title}: ${shot.title}`}>
          <div className="player-world" style={cameraStyle}>
            {backgroundLayers.map((layer) => (
              <div
                className="player-layer player-layer-background"
                data-layer-id={layer.id}
                key={layer.id}
                style={getLayerStyle(layer.kind, layerTransformAtProgress(shot, layer, localProgress, prefersReducedMotion))}
              >
                {layer.assetId === "hero-scene" && <img src={cityBackdrop} alt="" draggable="false" />}
              </div>
            ))}
            <div className="player-atmosphere" aria-hidden="true" />
            {characterLayers.map((layer) => {
              const transform = layerTransformAtProgress(shot, layer, localProgress, prefersReducedMotion);
              const artwork = !layer.assetId || layer.assetId === "traveler" ? travelerArtwork : undefined;
              return (
                <div
                  className="player-layer player-layer-character"
                  data-layer-id={layer.id}
                  data-layer-kind="character"
                  key={layer.id}
                  style={getLayerStyle(layer.kind, transform)}
                >
                  {artwork && <img src={artwork} alt={layer.name} draggable="false" />}
                </div>
              );
            })}
            {dialogueBeats.map((beat, index) => {
              const layer = dialogueLayers[index];
              const fallbackTransform = { x: 50, y: 76, scale: 100, rotation: 0, opacity: 100 };
              const baseTransform = layer
                ? layerTransformAtProgress(shot, layer, localProgress, prefersReducedMotion)
                : fallbackTransform;
              const active = localProgress >= beat.start && localProgress <= beat.start + beat.duration;
              const opacity = prefersReducedMotion
                ? Number(active)
                : visibilityThroughBeat(localProgress, beat);
              const style: CSSProperties = {
                ...getLayerStyle("dialogue", baseTransform),
                opacity: (baseTransform.opacity / 100) * opacity,
                visibility: active ? "visible" : "hidden",
              };
              return (
                <div className="player-dialogue" key={beat.id} style={style} aria-hidden={!active}>
                  {layer?.speaker && <span className="player-dialogue-speaker">{layer.speaker}</span>}
                  <p>{layer?.text ?? beat.label}</p>
                </div>
              );
            })}
            {dialogueBeats.length === 0 && dialogueLayers.map((layer) => (
              <div className="player-dialogue" key={layer.id} style={getLayerStyle(layer.kind, layerTransformAtProgress(shot, layer, progress, prefersReducedMotion))}>
                {layer.speaker && <span className="player-dialogue-speaker">{layer.speaker}</span>}
                <p>{layer.text}</p>
              </div>
            ))}
            <div className="player-vignette" aria-hidden="true" />
          </div>

          <header className="player-chrome">
            <a className="player-return" href="/studio/">Back to Studio</a>
            <div className="player-heading">
              <span>{story.title}</span>
              <h1>{chapter.title}</h1>
            </div>
            <div className="player-actions">
              <input
                ref={fileInputRef}
                className="player-file-input"
                type="file"
                accept=".json,application/json"
                aria-label="Open story JSON"
                onChange={handleStoryFile}
              />
              <button type="button" className="player-open-button" onClick={() => fileInputRef.current?.click()}>
                Open story JSON
              </button>
            </div>
            <div className="player-progress-row">
              <span>{shot.title}</span>
              <span className="player-shot-order">SHOT {String(shotIndex + 1).padStart(2, "0")} / {String(scene.shots.length).padStart(2, "0")}</span>
              <output>{String(Math.round(progress * 100)).padStart(2, "0")}%</output>
            </div>
            <div
              className="player-progress-track"
              role="progressbar"
              aria-label={`${scene.title} progress`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
            >
              <span style={{ transform: `scaleX(${progress})` }} />
            </div>
            {error && <p className="player-error" role="alert">{error}</p>}
          </header>

          <div className="player-scene-label">
            <span>{scene.title}</span>
            <i aria-hidden="true" />
            <span>{shot.title}</span>
          </div>
        </section>
      </div>
    </main>
  );
}