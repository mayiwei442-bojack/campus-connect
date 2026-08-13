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
  label: string;
  modelUrl: string;
  slot: PersonaAvatarSlot;
}>;

type PersonaAvatarStageProps = {
  activeSlot: PersonaAvatarSlot;
  models: PersonaAvatarModelConfig[];
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
  isActive,
  motionActive,
}: {
  compact: boolean;
  config: PersonaAvatarModelConfig;
  isActive: boolean;
  motionActive: boolean;
}) {
  const gltf = useLoader(GLTFLoader, config.modelUrl);
  const groupRef = useRef<Group>(null);
  const scene = useMemo(() => {
    const nextScene = clone(gltf.scene);
    const bounds = new Box3().setFromObject(nextScene);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    const scale = 2.18 / Math.max(size.y, 0.001);

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

    const compactScale = compact ? 0.73 : 1;
    const targetScale = compactScale * (isActive ? 1.055 : 0.94);
    const targetDepth = isActive ? 0.32 : 0;
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

  const spread = compact ? 1.12 : 1.62;
  return (
    <group ref={groupRef} position={[(config.slot - 2) * spread, 0, 0]}>
      <primitive object={scene} />
    </group>
  );
}

function LoadingFigure({ compact, slot, accent }: { compact: boolean; slot: PersonaAvatarSlot; accent: string }) {
  const groupRef = useRef<Group>(null);
  const spread = compact ? 1.12 : 1.62;

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.7;
    }
  });

  return (
    <group ref={groupRef} position={[(slot - 2) * spread, compact ? 0.62 : 0.84, 0]} scale={compact ? 0.72 : 1}>
      <mesh>
        <octahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.32} wireframe />
      </mesh>
    </group>
  );
}

function StageFloor({ models, activeSlot, compact }: { models: PersonaAvatarModelConfig[]; activeSlot: PersonaAvatarSlot; compact: boolean }) {
  const spread = compact ? 1.12 : 1.62;
  return (
    <>
      {models.map((model) => (
        <group key={model.slot} position={[(model.slot - 2) * spread, -0.025, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[model.slot === activeSlot ? 0.42 : 0.3, model.slot === activeSlot ? 0.47 : 0.33, 48]} />
            <meshBasicMaterial color={model.accent} transparent opacity={model.slot === activeSlot ? 0.92 : 0.28} />
          </mesh>
          <pointLight color={model.accent} intensity={model.slot === activeSlot ? 2.4 : 0.7} distance={3.4} position={[0, 0.65, 0.55]} />
        </group>
      ))}
      <mesh position={[0, -0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[14, 8]} />
        <meshStandardMaterial color="#071923" roughness={0.84} metalness={0.08} />
      </mesh>
    </>
  );
}

function AvatarScene({ activeSlot, models, motionActive }: PersonaAvatarStageProps & { motionActive: boolean }) {
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
      <StageFloor activeSlot={activeSlot} compact={compact} models={models} />
      {models.map((model) => (
        <Suspense key={model.slot} fallback={<LoadingFigure accent={model.accent} compact={compact} slot={model.slot} />}>
          <AvatarModel compact={compact} config={model} isActive={model.slot === activeSlot} motionActive={motionActive} />
        </Suspense>
      ))}
    </>
  );
}

export function PersonaAvatarStage({ activeSlot, models }: PersonaAvatarStageProps) {
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
          aria-label="三个可交互的 Persona 三维人物形象"
          camera={{ fov: 38, near: 0.1, far: 30, position: [0, 1.42, 6.7] }}
          dpr={[1, 1.5]}
          frameloop={motionActive ? "always" : "demand"}
          gl={{ antialias: true, powerPreference: "high-performance" }}
        >
          <AvatarScene activeSlot={activeSlot} models={models} motionActive={motionActive} />
        </Canvas>
      </StageErrorBoundary>
    </div>
  );
}

useLoader.preload(GLTFLoader, "/models/persona/einstein.glb");
useLoader.preload(GLTFLoader, "/models/persona/ironman.glb");
useLoader.preload(GLTFLoader, "/models/persona/spider.glb");
