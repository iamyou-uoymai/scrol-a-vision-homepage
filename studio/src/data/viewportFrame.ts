export interface FrameSize {
  width: number;
  height: number;
}

export interface FittedFrame extends FrameSize {
  left: number;
  top: number;
  scale: number;
}

export const UNIVERSAL_FRAME_SIZE = Object.freeze({ width: 1080, height: 1920 });

export function fitFrameInViewport(
  viewportWidth: number,
  viewportHeight: number,
  frame: FrameSize = UNIVERSAL_FRAME_SIZE,
): FittedFrame {
  if (
    !Number.isFinite(viewportWidth)
    || !Number.isFinite(viewportHeight)
    || !Number.isFinite(frame.width)
    || !Number.isFinite(frame.height)
    || viewportWidth <= 0
    || viewportHeight <= 0
    || frame.width <= 0
    || frame.height <= 0
  ) {
    return { left: 0, top: 0, width: 0, height: 0, scale: 0 };
  }

  const scale = Math.min(viewportWidth / frame.width, viewportHeight / frame.height);
  const width = Math.min(viewportWidth, frame.width * scale);
  const height = Math.min(viewportHeight, frame.height * scale);

  return {
    left: (viewportWidth - width) / 2,
    top: (viewportHeight - height) / 2,
    width,
    height,
    scale,
  };
}