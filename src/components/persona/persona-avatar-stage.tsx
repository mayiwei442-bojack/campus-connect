"use client";

import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { AnimationMixer, Box3, Group, MathUtils, Mesh, Vector3 } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";

export type PersonaAvatarSlot = 1 | 2 | 3;

export type PersonaAvatarModelConfig = Readonly<{
  accent: string;
  displayScale: number;
  label: string;
  modelUrl: string;
  slot: PersonaAvatarSlot;
  verticalOffset: number;
}>;

type PersonaAvatarStageProps = {
  model: PersonaAvatarModelConfig;
};

type StageErrorBoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
};

class StageErrorBoundary extends Component<StageErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function useStageActivity(containerRef: RefObject<HTMLDivElement | null>) {
  const [isVisible, setIsVisible] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), { rootMargin: "160px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [containerRef]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isVisible && !reduceMotion;
}

function StageControls({ motionActive }: { motionActive: boolean }) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    const handleChange = () => invalidate();
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.minPolarAngle = Math.PI / 2.8;
    controls.maxPolarAngle = Math.PI / 1.95;
    controls.target.set(0, 1.02, 0);
    controls.autoRotateSpeed = 0.34;
    controls.addEventListener("change", handleChange);
    controls.update();
    controlsRef.current = controls;

    return () => {
      controlsRef.current = null;
      controls.removeEventListener("change", handleChange);
      controls.dispose();
    };
  }, [camera, gl, invalidate]);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = motionActive;
      controlsRef.current.enableDamping = motionActive;
      invalidate();
    }
  }, [invalidate, motionActive]);

  useFrame(() => controlsRef.current?.update());
  return null;
}

function AvatarModel({
  compact,
  config,
  motionActive,
}: {
  compact: boolean;
  config: PersonaAvatarModelConfig;
  motionActive: boolean;
}) {
  const gltf = useLoader(GLTFLoader, config.modelUrl);
  const groupRef = useRef<Group>(null);
  const scene = useMemo(() => {
    const nextScene = clone(gltf.scene);
    const bounds = new Box3().setFromObject(nextScene);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    const scale = 2.65 / Math.max(size.y, 0.001);

    nextScene.scale.setScalar(scale);
    nextScene.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    nextScene.traverse((object) => {
      if (object instanceof Mesh) {
        object.frustumCulled = true;
      }
    });
    return nextScene;
  }, [gltf.scene]);
  const mixer = useMemo(() => new AnimationMixer(scene), [scene]);

  useEffect(() => {
    const clip = gltf.animations[0];
    if (!clip) {
      return;
    }
    const action = mixer.clipAction(clip);
    action.play();
    return () => {
      action.stop();
      mixer.uncacheRoot(scene);
    };
  }, [gltf.animations, mixer, scene]);

  useFrame((state, delta) => {
    if (motionActive) {
      mixer.update(Math.min(delta, 0.05));
    }
    const group = groupRef.current;
    if (!group) {
      return;
    }

    const targetScale = (compact ? 0.84 : 1) * config.displayScale;
    const targetDepth = 0.32;
    if (!motionActive) {
      group.scale.setScalar(targetScale);
      group.position.z = targetDepth;
      group.rotation.y = 0;
      return;
    }
    group.scale.setScalar(MathUtils.damp(group.scale.x, targetScale, 5, delta));
    group.position.z = MathUtils.damp(group.position.z, targetDepth, 5, delta);
    group.rotation.y = Math.sin(state.clock.elapsedTime * 0.45 + config.slot) * 0.045;
  });

  return (
    <group ref={groupRef} position={[0, config.verticalOffset, 0]}>
      <primitive object={scene} />
    </group>
  );
}

function LoadingFigure({ accent, verticalOffset }: { accent: string; verticalOffset: number }) {
  const groupRef = useRef<Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.7;
    }
  });

  return (
    <group ref={groupRef} position={[0, 1.05 + verticalOffset, 0]}>
      <mesh>
        <octahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.32} wireframe />
      </mesh>
    </group>
  );
}

function StageLight({ model }: { model: PersonaAvatarModelConfig }) {
  return <pointLight color={model.accent} intensity={2.5} distance={3.8} position={[0, 1.15, 0.55]} />;
}

function AvatarScene({ model, motionActive }: PersonaAvatarStageProps & { motionActive: boolean }) {
  const width = useThree((state) => state.size.width);
  const compact = width < 600;

  return (
    <>
      <fog attach="fog" args={["#071923", 5.8, 11]} />
      <ambientLight intensity={1.15} />
      <hemisphereLight args={["#d4ecff", "#071923", 1.8]} />
      <directionalLight color="#fff4df" intensity={2.4} position={[-3.5, 5, 4]} />
      <directionalLight color="#5dbaf1" intensity={1.5} position={[4, 2.5, 2]} />
      <StageControls motionActive={motionActive} />
      <StageLight model={model} />
      <Suspense key={model.slot} fallback={<LoadingFigure accent={model.accent} verticalOffset={model.verticalOffset} />}>
        <AvatarModel compact={compact} config={model} motionActive={motionActive} />
      </Suspense>
    </>
  );
}

export function PersonaAvatarStage({ model }: PersonaAvatarStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sceneKey, setSceneKey] = useState(0);
  const motionActive = useStageActivity(containerRef);

  return (
    <div ref={containerRef} className="relative h-full touch-none">
      <StageErrorBoundary
        key={sceneKey}
        fallback={(
          <div className="grid h-full place-items-center px-6 text-center text-white/60">
            <div>
              <p className="text-sm font-bold text-white/78">3D 形象暂时无法载入</p>
              <p className="mt-2 text-xs leading-6 text-white/40">Persona 内容仍可正常使用。</p>
              <button type="button" onClick={() => setSceneKey((key) => key + 1)} className="mt-4 rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-white/70">
                重新载入
              </button>
            </div>
          </div>
        )}
      >
        <Canvas
          aria-label={`当前选中的${model.label}`}
          camera={{ fov: 38, near: 0.1, far: 30, position: [0, 1.42, 6.25] }}
          dpr={[1, 1.5]}
          frameloop={motionActive ? "always" : "demand"}
          gl={{ antialias: true, powerPreference: "high-performance" }}
        >
          <AvatarScene model={model} motionActive={motionActive} />
        </Canvas>
      </StageErrorBoundary>
    </div>
  );
}
