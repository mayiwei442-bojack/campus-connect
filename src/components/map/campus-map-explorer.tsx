"use client";

import { Canvas, type ThreeEvent, useLoader, useThree } from "@react-three/fiber";
import {
  Box,
  Check,
  Compass,
  Crosshair,
  MapPin,
  MousePointer2,
  RefreshCw,
  Rotate3d,
  Search,
  TriangleAlert,
  ZoomIn,
} from "lucide-react";
import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Box3, Object3D, Vector3 } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { getPerspectiveFitDistance } from "@/lib/map/scene-camera";
import { buildSceneNodePairs, findPlaceIdInHierarchy } from "@/lib/map/scene-index";

const MODEL_URL = "/models/campus.glb";
const MODEL_DIAMETER = 12;
const SCENE_OVERVIEW_RADIUS = (MODEL_DIAMETER * Math.SQRT2) / 2;
const SCENE_CENTER: [number, number, number] = [0, 0.2, 0];

type ScenePlace = {
  id: string;
  label: string;
  category: string;
  placeNodeName: string;
  anchorNodeName: string;
  anchorPosition: [number, number, number];
};

type CameraRequest = {
  mode: "overview" | "top" | "focus";
  token: number;
};

type MapErrorBoundaryProps = {
  children: ReactNode;
  fallback: (message: string) => ReactNode;
};

type MapErrorBoundaryState = {
  message: string | null;
};

class MapErrorBoundary extends Component<MapErrorBoundaryProps, MapErrorBoundaryState> {
  state: MapErrorBoundaryState = { message: null };

  static getDerivedStateFromError(error: unknown): MapErrorBoundaryState {
    return { message: error instanceof Error ? error.message : "无法载入 3D 场景" };
  }

  componentDidCatch(error: unknown) {
    console.error("Campus map scene failed to render", error);
  }

  render() {
    return this.state.message ? this.props.fallback(this.state.message) : this.props.children;
  }
}

function CameraRig({ request, focus }: { request: CameraRequest; focus: ScenePlace | null }) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const size = useThree((state) => state.size);
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const nextControls = new OrbitControls(camera, gl.domElement);
    const handleChange = () => invalidate();
    nextControls.enableDamping = false;
    nextControls.minDistance = 2.5;
    nextControls.maxDistance = 80;
    nextControls.maxPolarAngle = Math.PI / 2.04;
    nextControls.addEventListener("change", handleChange);
    controlsRef.current = nextControls;

    return () => {
      controlsRef.current = null;
      nextControls.removeEventListener("change", handleChange);
      nextControls.dispose();
    };
  }, [camera, gl, invalidate]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) {
      return;
    }

    const aspect = size.height > 0 ? size.width / size.height : 1;
    const verticalFov = "fov" in camera && typeof camera.fov === "number" ? camera.fov : 42;
    const overviewDistance = getPerspectiveFitDistance({
      radius: SCENE_OVERVIEW_RADIUS,
      verticalFovDegrees: verticalFov,
      aspect,
      padding: 1.16,
    });
    if (request.mode === "top") {
      controls.target.set(...SCENE_CENTER);
      camera.up.set(0, 0, -1);
      camera.position.set(SCENE_CENTER[0], SCENE_CENTER[1] + overviewDistance, SCENE_CENTER[2] + 0.001);
    } else if (request.mode === "focus" && focus) {
      controls.target.set(...focus.anchorPosition);
      camera.up.set(0, 1, 0);
      const focusOffset = new Vector3(1, 0.9, 1).normalize().multiplyScalar(7.5);
      camera.position.set(...focus.anchorPosition).add(focusOffset);
    } else {
      controls.target.set(...SCENE_CENTER);
      camera.up.set(0, 1, 0);
      const overviewOffset = new Vector3(1, 0.78, 1).normalize().multiplyScalar(overviewDistance);
      camera.position.set(...SCENE_CENTER).add(overviewOffset);
    }

    camera.lookAt(controls.target);
    camera.updateProjectionMatrix();
    controls.update();
    invalidate();
  }, [camera, focus, invalidate, request, size.height, size.width]);

  return null;
}

function SceneLoadingObject() {
  return (
    <group position={[0, 0.4, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.42, 0.48, 40]} />
        <meshBasicMaterial color="#e3572d" />
      </mesh>
    </group>
  );
}

function CampusModel({
  selectedId,
  onSelect,
  onReady,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReady: (places: ScenePlace[]) => void;
}) {
  const gltf = useLoader(GLTFLoader, MODEL_URL);
  const invalidate = useThree((state) => state.invalidate);
  const [hovered, setHovered] = useState(false);

  const prepared = useMemo(() => {
    const scene = gltf.scene.clone(true);
    const initialBounds = new Box3().setFromObject(scene);
    const size = initialBounds.getSize(new Vector3());
    const center = initialBounds.getCenter(new Vector3());
    const scale = MODEL_DIAMETER / Math.max(size.x, size.z);

    scene.scale.setScalar(scale);
    scene.position.set(-center.x * scale, -initialBounds.min.y * scale, -center.z * scale);
    scene.updateMatrixWorld(true);

    const names: string[] = [];
    scene.traverse((object) => {
      if (object.name) {
        names.push(object.name);
      }
    });

    const places = buildSceneNodePairs(names).flatMap<ScenePlace>((pair) => {
      const anchor = scene.getObjectByName(pair.anchorNodeName);
      if (!anchor) {
        return [];
      }

      const position = anchor.getWorldPosition(new Vector3());
      return [{ ...pair, anchorPosition: [position.x, position.y, position.z] }];
    });

    return { scene, places };
  }, [gltf.scene]);

  const selectedPlace = prepared.places.find((place) => place.id === selectedId) ?? null;
  const selectedObject = selectedPlace ? prepared.scene.getObjectByName(selectedPlace.placeNodeName) : null;

  useEffect(() => {
    onReady(prepared.places);
    invalidate();
  }, [invalidate, onReady, prepared.places]);

  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = "pointer";
    }
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered]);

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    const placeId = findPlaceIdInHierarchy(event.object as Object3D);
    if (!placeId) {
      return;
    }

    event.stopPropagation();
    onSelect(placeId);
  };

  return (
    <>
      <primitive
        object={prepared.scene}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      />
      {selectedObject ? <boxHelper args={[selectedObject, "#e3572d"]} /> : null}
      {selectedPlace ? (
        <group position={selectedPlace.anchorPosition}>
          <mesh position={[0, 0.22, 0]}>
            <sphereGeometry args={[0.09, 18, 18]} />
            <meshBasicMaterial color="#e3572d" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
            <ringGeometry args={[0.14, 0.2, 32]} />
            <meshBasicMaterial color="#f4f0e6" transparent opacity={0.9} />
          </mesh>
        </group>
      ) : null}
    </>
  );
}

function CampusScene({
  selectedId,
  cameraRequest,
  places,
  onSelect,
  onReady,
}: {
  selectedId: string | null;
  cameraRequest: CameraRequest;
  places: ScenePlace[];
  onSelect: (id: string) => void;
  onReady: (places: ScenePlace[]) => void;
}) {
  const selectedPlace = places.find((place) => place.id === selectedId) ?? null;

  return (
    <>
      <color attach="background" args={["#173f35"]} />
      <fog attach="fog" args={["#173f35", 38, 78]} />
      <ambientLight intensity={1.65} />
      <hemisphereLight args={["#dceff1", "#6f5943", 2.1]} />
      <directionalLight position={[6, 10, 5]} intensity={2.2} />
      <gridHelper args={[18, 36, "#52766c", "#31594e"]} position={[0, -0.015, 0]} />
      <Suspense fallback={<SceneLoadingObject />}>
        <CampusModel selectedId={selectedId} onSelect={onSelect} onReady={onReady} />
      </Suspense>
      <CameraRig request={cameraRequest} focus={selectedPlace} />
    </>
  );
}

function SceneFailure({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="campus-grid flex h-full min-h-[32rem] items-center justify-center px-6 text-center text-paper">
      <div className="max-w-md">
        <TriangleAlert className="mx-auto text-signal" size={34} aria-hidden="true" />
        <h2 className="mt-5 font-display text-2xl font-semibold">3D 场景没有成功启动</h2>
        <p className="mt-3 text-sm leading-7 text-paper/65">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-paper px-4 py-2.5 text-sm font-bold text-forest transition-colors hover:bg-white"
        >
          <RefreshCw size={16} aria-hidden="true" />
          重新载入
        </button>
      </div>
    </div>
  );
}

export function CampusMapExplorer() {
  const [places, setPlaces] = useState<ScenePlace[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sceneKey, setSceneKey] = useState(0);
  const [cameraRequest, setCameraRequest] = useState<CameraRequest>({ mode: "overview", token: 0 });

  const selectedPlace = places.find((place) => place.id === selectedId) ?? null;
  const filteredPlaces = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return places;
    }

    return places.filter((place) =>
      [place.label, place.id, place.category, place.placeNodeName]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [places, query]);

  const requestCamera = useCallback((mode: CameraRequest["mode"]) => {
    setCameraRequest((current) => ({ mode, token: current.token + 1 }));
  }, []);

  const selectPlace = useCallback((id: string) => {
    setSelectedId(id);
    setCameraRequest((current) => ({ mode: "focus", token: current.token + 1 }));
  }, []);

  const handleReady = useCallback((scenePlaces: ScenePlace[]) => {
    setPlaces(scenePlaces);
  }, []);

  const retryScene = () => {
    setPlaces([]);
    setSelectedId(null);
    setSceneKey((current) => current + 1);
  };

  return (
    <section className="overflow-hidden rounded-[1.8rem] border border-forest/10 bg-[#ede7da] shadow-[0_26px_90px_rgba(20,35,31,0.1)]">
      <header className="flex flex-col gap-4 border-b border-forest/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-signal opacity-45" />
            <span className="relative inline-flex size-2.5 rounded-full bg-signal" />
          </span>
          <div>
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.22em] text-forest/45">Live scene index</p>
            <p className="mt-0.5 text-sm font-bold text-forest">
              {places.length > 0 ? `${places.length} 组节点已配对` : "正在解析场景节点"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => requestCamera("overview")}
            className="inline-flex items-center gap-2 rounded-full border border-forest/12 bg-white/55 px-3.5 py-2 text-xs font-bold text-forest transition-colors hover:bg-white"
          >
            <Compass size={15} aria-hidden="true" />
            鸟瞰
          </button>
          <button
            type="button"
            onClick={() => requestCamera("top")}
            className="inline-flex items-center gap-2 rounded-full border border-forest/12 bg-white/55 px-3.5 py-2 text-xs font-bold text-forest transition-colors hover:bg-white"
          >
            <Crosshair size={15} aria-hidden="true" />
            正上方
          </button>
          <button
            type="button"
            onClick={() => selectedPlace && requestCamera("focus")}
            disabled={!selectedPlace}
            className="inline-flex items-center gap-2 rounded-full bg-forest px-3.5 py-2 text-xs font-bold text-paper transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ZoomIn size={15} aria-hidden="true" />
            聚焦选中
          </button>
        </div>
      </header>

      <div className="grid xl:h-[42rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="relative h-[32rem] min-h-0 overflow-hidden bg-forest xl:h-full">
          <MapErrorBoundary key={sceneKey} fallback={(message) => <SceneFailure message={message} onRetry={retryScene} />}>
            <Canvas
              aria-label="可交互三维校园场景"
              frameloop="demand"
              dpr={[1, 1.75]}
              camera={{ position: [18, 15, 18], fov: 42, near: 0.1, far: 100 }}
              gl={{ antialias: true, powerPreference: "high-performance" }}
              fallback={
                <p className="p-6 text-sm leading-7 text-paper">
                  三维校园场景需要 WebGL；如果当前设备无法显示，仍可使用地点列表浏览全部场景节点。
                </p>
              }
            >
              <CampusScene
                selectedId={selectedId}
                cameraRequest={cameraRequest}
                places={places}
                onSelect={selectPlace}
                onReady={handleReady}
              />
            </Canvas>
          </MapErrorBoundary>

          <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex flex-wrap gap-2 text-[0.64rem] font-semibold text-paper/70">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-forest/80 px-3 py-2 backdrop-blur">
              <Rotate3d size={13} aria-hidden="true" /> 左键旋转
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-forest/80 px-3 py-2 backdrop-blur">
              <MousePointer2 size={13} aria-hidden="true" /> 点击建筑
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-forest/80 px-3 py-2 backdrop-blur">
              <ZoomIn size={13} aria-hidden="true" /> 滚轮缩放
            </span>
          </div>
        </div>

        <aside className="flex h-[34rem] min-h-0 flex-col border-t border-forest/10 bg-paper/68 xl:h-full xl:border-l xl:border-t-0">
          <div className="border-b border-forest/10 p-5">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-forest/35" size={17} aria-hidden="true" />
              <span className="sr-only">搜索 GLB 场景节点</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索 library / dormitory…"
                className="w-full rounded-xl border border-forest/10 bg-white/65 py-3 pl-10 pr-3 text-sm text-forest placeholder:text-forest/35"
              />
            </label>
            <div className="mt-3 flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-[0.14em] text-forest/38">
              <span>Scene places</span>
              <span>{filteredPlaces.length} / {places.length || "—"}</span>
            </div>
          </div>

          {selectedPlace ? (
            <div className="border-b border-forest/10 bg-forest px-5 py-4 text-paper">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-signal text-white">
                  <MapPin size={16} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-semibold capitalize">{selectedPlace.label}</p>
                  <p className="mt-1 truncate font-mono text-[0.63rem] text-paper/52">{selectedPlace.anchorNodeName}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="border-b border-forest/10 px-5 py-4 text-xs leading-6 text-forest/50">
              从列表选择，或直接点击场景中的建筑模型。
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto p-2" aria-live="polite">
            {filteredPlaces.map((place) => {
              const isSelected = place.id === selectedId;
              return (
                <button
                  type="button"
                  key={place.id}
                  onClick={() => selectPlace(place.id)}
                  aria-pressed={isSelected}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                    isSelected ? "bg-signal text-white" : "text-forest hover:bg-forest/6"
                  }`}
                >
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-full border text-[0.6rem] font-bold ${
                      isSelected ? "border-white/25 bg-white/12" : "border-forest/12 bg-white/45 text-forest/42"
                    }`}
                  >
                    {isSelected ? <Check size={14} aria-hidden="true" /> : <Box size={13} aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold capitalize">{place.label}</span>
                    <span className={`mt-0.5 block truncate font-mono text-[0.58rem] ${isSelected ? "text-white/65" : "text-forest/35"}`}>
                      {place.placeNodeName}
                    </span>
                  </span>
                </button>
              );
            })}

            {places.length > 0 && filteredPlaces.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm leading-6 text-forest/45">没有匹配的场景节点。</p>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
}

useLoader.preload(GLTFLoader, MODEL_URL);
