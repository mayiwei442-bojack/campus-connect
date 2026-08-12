type PerspectiveFitOptions = {
  radius: number;
  verticalFovDegrees: number;
  aspect: number;
  padding?: number;
};

export function getPerspectiveFitDistance({
  radius,
  verticalFovDegrees,
  aspect,
  padding = 1,
}: PerspectiveFitOptions) {
  const safeRadius = Math.max(radius, 0.001);
  const safeAspect = Math.max(aspect, 0.1);
  const safePadding = Math.max(padding, 1);
  const verticalFov = (Math.min(Math.max(verticalFovDegrees, 1), 179) * Math.PI) / 180;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * safeAspect);
  const limitingFov = Math.min(verticalFov, horizontalFov);

  return (safeRadius / Math.sin(limitingFov / 2)) * safePadding;
}
