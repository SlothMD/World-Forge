import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { MapMode, MapTheme, PointInspectionRecord, RenderMode, renderWorldToCanvas } from '@world-forge/renderer';
import { WorldProject } from '@world-forge/shared';

export type GlobeDebugMode = 'final' | 'albedo' | 'lit' | 'water-mask' | 'sea-level' | 'coast-mask' | 'ocean-shell' | 'neutral-mesh' | 'topology-face' | 'uv-grid' | 'shade' | 'gyres';
export type GlobeFocusTarget = { x: number; y: number; width: number; height: number; latitude: number; longitude: number };

type GlobeScaleConfig = {
  seaLevelRadius: number;
  deepOceanFloorRadius: number;
  shallowSeabedRadius: number;
  oceanShellRadius: number;
  coastalLowlandRadius: number;
  typicalLandRadiusMin: number;
  typicalLandRadiusMax: number;
  highlandRadiusMin: number;
  highlandRadiusMax: number;
  exceptionalMountainRadiusCap: number;
  cloudShellRadius: number;
  atmosphereShellRadius: number;
};

const defaultGlobeScale: GlobeScaleConfig = {
  seaLevelRadius: 1,
  deepOceanFloorRadius: 0.986,
  shallowSeabedRadius: 0.996,
  oceanShellRadius: 1.002,
  coastalLowlandRadius: 1.003,
  typicalLandRadiusMin: 1.004,
  typicalLandRadiusMax: 1.012,
  highlandRadiusMin: 1.012,
  highlandRadiusMax: 1.014,
  exceptionalMountainRadiusCap: 1.018,
  cloudShellRadius: 1.04,
  atmosphereShellRadius: 1.085
};
export function GlobeViewer({
  project,
  mapMode,
  renderMode,
  mapTheme,
  showRivers,
  showPlates,
  showGlobeShells,
  globeDebugMode,
  diagnosticMode,
  inspectionRecord,
  focusTarget,
  zoom,
  onZoom,
  onInspect
}: {
  project: WorldProject;
  mapMode: MapMode;
  renderMode: RenderMode;
  mapTheme: MapTheme;
  showRivers: boolean;
  showPlates: boolean;
  showGlobeShells: boolean;
  globeDebugMode: GlobeDebugMode;
  diagnosticMode: boolean;
  inspectionRecord: PointInspectionRecord | null;
  focusTarget: GlobeFocusTarget | null;
  zoom: number;
  onZoom: (event: WheelEvent) => void;
  onInspect: (x: number, y: number, screen: { x: number; y: number }) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const globeMeshRef = useRef<THREE.Mesh | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const markerRef = useRef<THREE.Group | null>(null);
  const focusMarkerRef = useRef<THREE.Group | null>(null);
  const diagnosticModeRef = useRef(diagnosticMode);
  const freezeSpinRef = useRef((diagnosticMode && Boolean(inspectionRecord)) || Boolean(focusTarget));

  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    camera.position.set(0, 0, globeCameraDistance(zoom));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [zoom]);

  useEffect(() => {
    diagnosticModeRef.current = diagnosticMode;
    freezeSpinRef.current = (diagnosticMode && Boolean(inspectionRecord)) || Boolean(focusTarget);
    const globe = globeMeshRef.current;
    if (!globe) return;
    if (markerRef.current) {
      globe.remove(markerRef.current);
      disposeGlobeMarker(markerRef.current);
      markerRef.current = null;
    }
    if (diagnosticMode && inspectionRecord) {
      const marker = createGlobeInspectionMarker(inspectionRecord);
      globe.add(marker);
      markerRef.current = marker;
      orientGlobeToDirection(globe, directionFromInspection(inspectionRecord));
    }
  }, [diagnosticMode, focusTarget, inspectionRecord]);

  useEffect(() => {
    const globe = globeMeshRef.current;
    if (!globe) return;
    if (focusMarkerRef.current) {
      globe.remove(focusMarkerRef.current);
      disposeGlobeMarker(focusMarkerRef.current);
      focusMarkerRef.current = null;
    }
    if (!focusTarget) return;
    const u = (focusTarget.x + 0.5) / Math.max(1, focusTarget.width);
    const v = 1 - (focusTarget.y + 0.5) / Math.max(1, focusTarget.height);
    const direction = directionFromGlobeUv(u, v);
    const marker = createGlobeTargetMarker(direction);
    globe.add(marker);
    focusMarkerRef.current = marker;
    orientGlobeToDirection(globe, direction);
  }, [focusTarget]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    host.replaceChildren(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 20);
    camera.position.set(0, 0, globeCameraDistance(zoom));
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const texture = new THREE.CanvasTexture(createGlobeTexture(project, mapMode, renderMode, mapTheme, showRivers, showPlates, globeDebugMode));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    const scale = defaultGlobeScale;
    const geometry = createGlobeGeometry(project, scale);
    const material = createGlobeMaterial(texture, globeDebugMode);
    const globe = new THREE.Mesh(geometry, material);
    globe.rotation.y = -0.55;
    scene.add(globe);
    globeMeshRef.current = globe;

    if (diagnosticModeRef.current && inspectionRecord) {
      const marker = createGlobeInspectionMarker(inspectionRecord);
      globe.add(marker);
      markerRef.current = marker;
      orientGlobeToDirection(globe, directionFromInspection(inspectionRecord));
    }
    if (focusTarget) {
      const u = (focusTarget.x + 0.5) / Math.max(1, focusTarget.width);
      const v = 1 - (focusTarget.y + 0.5) / Math.max(1, focusTarget.height);
      const direction = directionFromGlobeUv(u, v);
      const marker = createGlobeTargetMarker(direction);
      globe.add(marker);
      focusMarkerRef.current = marker;
      orientGlobeToDirection(globe, direction);
    }

    const ocean = new THREE.Mesh(
      new THREE.SphereGeometry(scale.oceanShellRadius, 160, 80),
      new THREE.MeshPhysicalMaterial({
        color: 0x2f7fa6,
        transparent: true,
        opacity: 0.34,
        roughness: 0.62,
        metalness: 0,
        transmission: 0,
        depthWrite: false,
        depthTest: true
      })
    );
    ocean.visible = showGlobeShells && (globeDebugMode === 'final' || globeDebugMode === 'ocean-shell');
    scene.add(ocean);

    const cloudAlpha = new THREE.CanvasTexture(createCloudAlphaTexture(project));
    cloudAlpha.wrapS = THREE.RepeatWrapping;
    cloudAlpha.wrapT = THREE.ClampToEdgeWrapping;
    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(scale.cloudShellRadius, 128, 64),
      new THREE.MeshLambertMaterial({
        color: 0xf6f3e8,
        alphaMap: cloudAlpha,
        transparent: true,
        opacity: 0.68,
        alphaTest: 0.035,
        depthWrite: false,
        depthTest: true
      })
    );
    clouds.visible = false;
    scene.add(clouds);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(scale.atmosphereShellRadius, 96, 48),
      createAtmosphereMaterial()
    );
    atmosphere.visible = showGlobeShells && globeDebugMode === 'final';
    scene.add(atmosphere);

    scene.add(new THREE.AmbientLight(0x9fb5bd, 0.46));
    const sun = new THREE.DirectionalLight(0xfff1d0, 3.05);
    sun.position.set(-4.2, 1.35, 0.55);
    scene.add(sun);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const drag = { active: false, x: 0, y: 0, startX: 0, startY: 0, vx: 0, vy: 0 };
    const onPointerDown = (event: PointerEvent) => {
      drag.active = true;
      drag.x = event.clientX;
      drag.y = event.clientY;
      drag.startX = event.clientX;
      drag.startY = event.clientY;
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!drag.active) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      drag.x = event.clientX;
      drag.y = event.clientY;
      drag.vx = dx * 0.006;
      drag.vy = dy * 0.004;
      globe.rotation.y += drag.vx;
      globe.rotation.x = clampGlobeTilt(globe.rotation.x + drag.vy);
    };
    const onPointerUp = (event: PointerEvent) => {
      const movement = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      drag.active = false;
      renderer.domElement.releasePointerCapture(event.pointerId);
      if (diagnosticModeRef.current && movement <= 4) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObject(globe, false)[0];
        if (hit) {
          const world = project.primaryWorld;
          const uvPoint = hit.uv
            ? mapPointFromGlobeUv(hit.uv, world.mapModel.resolution.width, world.mapModel.resolution.height)
            : mapPointFromGlobeLocalDirection(globe.worldToLocal(hit.point.clone()).normalize(), world.mapModel.resolution.width, world.mapModel.resolution.height);
          const mapX = uvPoint.x;
          const mapY = uvPoint.y;
          onInspect(mapX, mapY, { x: Math.round(event.clientX), y: Math.round(event.clientY) });
        }
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);
    renderer.domElement.addEventListener('wheel', onZoom, { passive: false });

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    let frame = 0;
    let disposed = false;
    const animate = () => {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      if (!drag.active && !freezeSpinRef.current) {
        globe.rotation.y += 0.0017 + drag.vx * 0.02;
        globe.rotation.x = clampGlobeTilt(globe.rotation.x + drag.vy * 0.018);
        drag.vx *= 0.94;
        drag.vy *= 0.9;
      }
      ocean.rotation.copy(globe.rotation);
      clouds.rotation.copy(globe.rotation);
      clouds.rotateY(performance.now() * 0.00000018);
      atmosphere.rotation.copy(globe.rotation);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      renderer.domElement.removeEventListener('wheel', onZoom);
      if (markerRef.current) {
        globe.remove(markerRef.current);
        disposeGlobeMarker(markerRef.current);
        markerRef.current = null;
      }
      if (focusMarkerRef.current) {
        globe.remove(focusMarkerRef.current);
        disposeGlobeMarker(focusMarkerRef.current);
        focusMarkerRef.current = null;
      }
      globeMeshRef.current = null;
      cameraRef.current = null;
      geometry.dispose();
      material.dispose();
      texture.dispose();
      cloudAlpha.dispose();
      ocean.geometry.dispose();
      (ocean.material as THREE.Material).dispose();
      clouds.geometry.dispose();
      (clouds.material as THREE.Material).dispose();
      atmosphere.geometry.dispose();
      (atmosphere.material as THREE.Material).dispose();
      renderer.dispose();
      host.replaceChildren();
    };
  }, [focusTarget, globeDebugMode, inspectionRecord, mapMode, mapTheme, onInspect, onZoom, project, renderMode, showGlobeShells, showPlates, showRivers]);

  return <div ref={hostRef} className={`globe-viewer ${diagnosticMode ? 'diagnostic-active' : ''}`} aria-label={`Generated globe for ${project.projectName}`} />;
}

function createGlobeTargetMarker(direction: THREE.Vector3): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color: 0xe84a45, depthTest: false, depthWrite: false, transparent: true, opacity: 0.98 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.004, 10, 40), material);
  ring.position.copy(direction.clone().multiplyScalar(1.072));
  ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
  ring.renderOrder = 12;
  group.add(ring);
  return group;
}

function createGlobeInspectionMarker(record: PointInspectionRecord): THREE.Group {
  const group = new THREE.Group();
  const direction = directionFromInspection(record);
  const tangent = new THREE.Vector3(-direction.z, 0, direction.x);
  if (tangent.lengthSq() < 0.001) {
    tangent.set(1, 0, 0);
  }
  tangent.normalize();

  const red = new THREE.MeshBasicMaterial({
    color: 0xe84a45,
    depthTest: true,
    depthWrite: false,
    transparent: true,
    opacity: 0.96
  });

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.0045, 8, 36), red);
  ring.position.copy(direction.clone().multiplyScalar(1.07));
  ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
  ring.renderOrder = 10;
  group.add(ring);

  const arrowDirection = direction.clone().multiplyScalar(1.07).sub(direction.clone().multiplyScalar(1.13).add(tangent.clone().multiplyScalar(0.11))).normalize();
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.065, 18), red.clone());
  arrow.position.copy(direction.clone().multiplyScalar(1.13).add(tangent.clone().multiplyScalar(0.11)));
  arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), arrowDirection);
  arrow.renderOrder = 10;
  group.add(arrow);

  return group;
}

function directionFromInspection(record: PointInspectionRecord): THREE.Vector3 {
  const u = (record.equirectangular.x + 0.5) / Math.max(1, record.equirectangular.width);
  const v = 1 - (record.equirectangular.y + 0.5) / Math.max(1, record.equirectangular.height);
  return directionFromGlobeUv(u, v);
}

function orientGlobeToDirection(globe: THREE.Mesh, direction: THREE.Vector3) {
  globe.quaternion.setFromUnitVectors(direction.clone().normalize(), new THREE.Vector3(0, 0, 1));
}

function globeCameraDistance(zoom: number): number {
  const clamped = Math.max(0.75, Math.min(4, Number.isFinite(zoom) ? zoom : 1));
  return 3.15 / Math.sqrt(clamped);
}

function directionFromGlobeUv(u: number, v: number): THREE.Vector3 {
  const phi = wrapUnit(u) * Math.PI * 2;
  const theta = (1 - clamp01(v)) * Math.PI;
  const sinTheta = Math.sin(theta);
  return new THREE.Vector3(
    -Math.cos(phi) * sinTheta,
    Math.cos(theta),
    Math.sin(phi) * sinTheta
  ).normalize();
}

function mapPointFromGlobeUv(uv: THREE.Vector2, width: number, height: number): { x: number; y: number } {
  return {
    x: wrapUnit(uv.x) * width,
    y: clamp01(1 - uv.y) * height
  };
}

function mapPointFromGlobeLocalDirection(direction: THREE.Vector3, width: number, height: number): { x: number; y: number } {
  const theta = Math.acos(Math.max(-1, Math.min(1, direction.y)));
  const phi = Math.atan2(direction.z, -direction.x);
  return {
    x: wrapUnit(phi / (Math.PI * 2)) * width,
    y: clamp01(theta / Math.PI) * height
  };
}

function disposeGlobeMarker(marker: THREE.Group) {
  marker.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach((entry) => entry.dispose());
    } else if (material) {
      material.dispose();
    }
  });
}

function createGlobeMaterial(texture: THREE.Texture, globeDebugMode: GlobeDebugMode): THREE.Material {
  if (globeDebugMode === 'final' || globeDebugMode === 'lit') {
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.86,
      metalness: 0.02
    });
  }
  if (globeDebugMode === 'neutral-mesh') {
    return new THREE.MeshBasicMaterial({ color: 0x9a9a92 });
  }
  if (globeDebugMode === 'ocean-shell') {
    return new THREE.MeshBasicMaterial({ color: 0x26383a });
  }
  return new THREE.MeshBasicMaterial({ map: texture });
}

function createAtmosphereMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(0x86cde6) }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      void main() {
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float rim = pow(1.0 - max(dot(normalize(vNormal), viewDirection), 0.0), 2.4);
        gl_FragColor = vec4(color, rim * 0.28);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide
  });
}

function createGlobeTexture(project: WorldProject, mapMode: MapMode, renderMode: RenderMode, mapTheme: MapTheme, showRivers: boolean, showPlates: boolean, globeDebugMode: GlobeDebugMode): HTMLCanvasElement {
  if (globeDebugMode === 'gyres') {
    return createGyreDebugTexture(project);
  }
  if (globeDebugMode === 'coast-mask') {
    return createCoastMaskTexture(project);
  }
  if (globeDebugMode === 'uv-grid') {
    return createUvGridTexture();
  }

  const canvas = document.createElement('canvas');
  const mode = globeDebugMode === 'water-mask'
    ? 'water-depth'
    : globeDebugMode === 'sea-level'
      ? 'sea-level'
      : globeDebugMode === 'shade'
        ? 'slope'
    : globeDebugMode === 'topology-face'
      ? 'topology-face'
      : mapMode;
  const includeOverlays = globeDebugMode === 'final';
  renderWorldToCanvas(canvas, project, mapTheme, {
    rivers: includeOverlays && showRivers && mapMode !== 'elevation' && mapMode !== 'heightmap',
    plates: includeOverlays && showPlates,
    heightmap: mode === 'elevation',
    coastlineTreatment: 'toned',
    renderMode,
    mode,
    targetResolution: { width: 2048, height: 1024 }
  });
  normalizeHorizontalTextureSeam(canvas, 1);
  return canvas;
}

function createGyreDebugTexture(project: WorldProject): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  const world = project.primaryWorld;
  const width = world.mapModel.resolution.width;
  const height = world.mapModel.resolution.height;
  const circulation = (world.climate as typeof world.climate & { basinCirculation?: { packedGyres?: Array<{ id: number; centerX: number; centerY: number; radiusX: number; radiusY: number; territorySize: number; rotationSign: number }>; gyreOwner?: Int16Array } } | undefined)?.basinCirculation;
  const gyres = circulation?.packedGyres ?? [];
  const owner = circulation?.gyreOwner;
  const palette = ['#f2c14e', '#5bc0eb', '#9bc53d', '#e55934', '#fa7921', '#b084cc', '#52b788', '#ef476f', '#06d6a0', '#ffd166', '#118ab2', '#c77dff', '#80ed99', '#ff9f1c'];
  const image = context.createImageData(canvas.width, canvas.height);
  for (let py = 0; py < canvas.height; py += 1) {
    const sy = Math.min(height - 1, Math.floor((py / canvas.height) * height));
    for (let px = 0; px < canvas.width; px += 1) {
      const sx = Math.min(width - 1, Math.floor((px / canvas.width) * width));
      const source = sy * width + sx;
      const target = (py * canvas.width + px) * 4;
      if (!world.layers.water[source]) {
        image.data[target] = 38; image.data[target + 1] = 43; image.data[target + 2] = 34; image.data[target + 3] = 255;
        continue;
      }
      const gyreId = owner?.[source] ?? -1;
      if (gyreId < 0) {
        image.data[target] = 25; image.data[target + 1] = 55; image.data[target + 2] = 72; image.data[target + 3] = 255;
        continue;
      }
      const color = new THREE.Color(palette[gyreId % palette.length]);
      image.data[target] = Math.round(color.r * 255 * 0.72);
      image.data[target + 1] = Math.round(color.g * 255 * 0.72);
      image.data[target + 2] = Math.round(color.b * 255 * 0.72);
      image.data[target + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  context.save();
  context.lineWidth = 3;
  context.font = 'bold 22px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  for (const gyre of gyres) {
    const cx = ((gyre.centerX + 0.5) / Math.max(1, width)) * canvas.width;
    const cy = ((gyre.centerY + 0.5) / Math.max(1, height)) * canvas.height;
    const rx = (gyre.radiusX / Math.max(1, width)) * canvas.width;
    const ry = (gyre.radiusY / Math.max(1, height)) * canvas.height;
    const color = palette[gyre.id % palette.length];
    for (const offset of [-canvas.width, 0, canvas.width]) {
      context.strokeStyle = color;
      context.setLineDash([10, 7]);
      context.beginPath();
      context.ellipse(cx + offset, cy, rx, ry, 0, 0, Math.PI * 2);
      context.stroke();
      context.setLineDash([]);
      context.beginPath();
      context.moveTo(cx + offset - 10, cy); context.lineTo(cx + offset + 10, cy);
      context.moveTo(cx + offset, cy - 10); context.lineTo(cx + offset, cy + 10);
      context.stroke();
      context.fillStyle = '#ffffff';
      context.strokeStyle = '#111820';
      context.lineWidth = 5;
      const label = `G${gyre.id + 1} ${gyre.rotationSign > 0 ? 'CW' : 'CCW'} ${gyre.territorySize}`;
      context.strokeText(label, cx + offset, cy - 18);
      context.fillText(label, cx + offset, cy - 18);
      context.lineWidth = 3;
    }
  }
  context.restore();
  normalizeHorizontalTextureSeam(canvas, 1);
  return canvas;
}

function createCloudAlphaTexture(project: WorldProject): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const width = 1024;
  const height = 512;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  const image = context.createImageData(width, height);
  const world = project.primaryWorld;
  const worldWidth = world.mapModel.resolution.width;
  const worldHeight = world.mapModel.resolution.height;

  for (let y = 0; y < height; y += 1) {
    const v = y / Math.max(1, height - 1);
    const latitude01 = Math.abs(v - 0.5) * 2;
    for (let x = 0; x < width; x += 1) {
      const u = x / Math.max(1, width - 1);
      const sourceX = Math.max(0, Math.min(worldWidth - 1, Math.floor(u * worldWidth)));
      const sourceY = Math.max(0, Math.min(worldHeight - 1, Math.floor(v * worldHeight)));
      const index = sourceY * worldWidth + sourceX;
      const water = world.layers.water[index] === 1 ? 1 : 0;
      const wetness = world.layers.wetness[index] ?? 0.45;
      const temperature = world.layers.temperature[index] ?? 12;
      const polarDry = smoothStep(0.72, 1, latitude01);
      const temperateBand = 1 - Math.abs(latitude01 - 0.45) / 0.55;
      const climateProbability = clamp01(0.34 + water * 0.24 + wetness * 0.28 + clamp01(temperateBand) * 0.14 - polarDry * 0.18 - (temperature > 28 ? 0.08 : 0));
      const noise = fractalCloudNoise(u, v, project.seed);
      const weighted = noise * (0.88 + climateProbability * 0.46);
      const alpha = smoothStep(0.47, 0.68, weighted) * (0.54 + climateProbability * 0.58);
      const value = Math.round(clamp01(alpha) * 255);
      const target = (y * width + x) * 4;
      image.data[target] = value;
      image.data[target + 1] = value;
      image.data[target + 2] = value;
      image.data[target + 3] = value;
    }
  }
  context.putImageData(image, 0, 0);
  normalizeHorizontalTextureSeam(canvas, 1);
  return canvas;
}

function normalizeHorizontalTextureSeam(canvas: HTMLCanvasElement, columns = 2) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context || canvas.width < 2 || canvas.height < 1) return;
  const width = canvas.width;
  const height = canvas.height;
  const seamColumns = Math.max(1, Math.min(columns, Math.floor(width / 2)));
  const image = context.getImageData(0, 0, width, height);

  for (let y = 0; y < height; y += 1) {
    for (let offset = 0; offset < seamColumns; offset += 1) {
      const left = (y * width + offset) * 4;
      const right = (y * width + (width - 1 - offset)) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        const value = Math.round((image.data[left + channel] + image.data[right + channel]) / 2);
        image.data[left + channel] = value;
        image.data[right + channel] = value;
      }
    }
  }

  context.putImageData(image, 0, 0);
}

function fractalCloudNoise(u: number, v: number, seed: string): number {
  let amplitude = 0.58;
  let frequency = 2.1;
  let total = 0;
  let weight = 0;
  for (let octave = 0; octave < 5; octave += 1) {
    total += smoothValueNoise(u * frequency, v * frequency, `${seed}:cloud:${octave}`) * amplitude;
    weight += amplitude;
    amplitude *= 0.52;
    frequency *= 2.05;
  }
  return weight > 0 ? total / weight : 0;
}

function smoothValueNoise(x: number, y: number, seed: string): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smoothStep(0, 1, x - x0);
  const fy = smoothStep(0, 1, y - y0);
  const a = seededUnit(seed, x0, y0);
  const b = seededUnit(seed, x0 + 1, y0);
  const c = seededUnit(seed, x0, y0 + 1);
  const d = seededUnit(seed, x0 + 1, y0 + 1);
  return linearInterpolate(linearInterpolate(a, b, fx), linearInterpolate(c, d, fx), fy);
}

function seededUnit(seed: string, x: number, y: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  h ^= Math.imul(x + 374761393, 668265263);
  h ^= Math.imul(y + 2246822519, 3266489917);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967295;
}

function createUvGridTexture(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  context.fillStyle = '#202424';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#f0d777';
  context.lineWidth = 2;
  for (let x = 0; x <= canvas.width; x += 128) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 128) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();
  }
  context.strokeStyle = '#e84a45';
  context.lineWidth = 5;
  context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
  context.fillStyle = '#f7efe2';
  context.font = 'bold 42px system-ui, sans-serif';
  context.fillText('NW', 24, 58);
  context.fillText('NE', canvas.width - 92, 58);
  context.fillText('SW', 24, canvas.height - 28);
  context.fillText('SE', canvas.width - 92, canvas.height - 28);
  context.fillText('EQUATOR', 24, canvas.height / 2 - 16);
  return canvas;
}

function createCoastMaskTexture(project: WorldProject): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const world = project.primaryWorld;
  const { width, height } = world.mapModel.resolution;
  canvas.width = 2048;
  canvas.height = 1024;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  const image = context.createImageData(canvas.width, canvas.height);
  const sourceWater = world.layers.water;
  const sourceWidth = width;
  const sourceHeight = height;

  for (let y = 0; y < canvas.height; y += 1) {
    const sourceY = Math.max(0, Math.min(sourceHeight - 1, Math.floor((y / canvas.height) * sourceHeight)));
    for (let x = 0; x < canvas.width; x += 1) {
      const sourceX = Math.max(0, Math.min(sourceWidth - 1, Math.floor((x / canvas.width) * sourceWidth)));
      const sourceIndex = sourceY * sourceWidth + sourceX;
      const isWater = sourceWater[sourceIndex] === 1;
      let nearCoast = false;
      for (let dy = -2; dy <= 2 && !nearCoast; dy += 1) {
        const ny = Math.max(0, Math.min(sourceHeight - 1, sourceY + dy));
        for (let dx = -2; dx <= 2; dx += 1) {
          const nx = (sourceX + dx + sourceWidth) % sourceWidth;
          const neighborWater = sourceWater[ny * sourceWidth + nx] === 1;
          if (neighborWater !== isWater) {
            nearCoast = true;
            break;
          }
        }
      }
      const target = (y * canvas.width + x) * 4;
      const value = nearCoast ? 235 : isWater ? 36 : 9;
      image.data[target] = nearCoast ? 232 : value;
      image.data[target + 1] = nearCoast ? 82 : value;
      image.data[target + 2] = nearCoast ? 72 : value;
      image.data[target + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

function createGlobeGeometry(project: WorldProject, scale: GlobeScaleConfig): THREE.SphereGeometry {
  const geometry = new THREE.SphereGeometry(1, 320, 160);
  const positions = geometry.attributes.position as THREE.BufferAttribute;
  const uvs = geometry.attributes.uv as THREE.BufferAttribute;
  const world = project.primaryWorld;
  const { width, height } = world.mapModel.resolution;
  const [lowDepthElevation] = rasterPercentileRange(world.layers.elevation, 0.02, 0.98);
  const [, highElevation] = rasterPercentileRange(world.layers.elevation, 0.02, 0.98);
  const landRange = Math.max(0.0001, highElevation - world.seaLevel);
  const oceanRange = Math.max(0.0001, world.seaLevel - lowDepthElevation);
  const vertex = new THREE.Vector3();

  for (let i = 0; i < positions.count; i += 1) {
    vertex.fromBufferAttribute(positions, i).normalize();
    const uvPoint = mapPointFromGlobeUv(new THREE.Vector2(uvs.getX(i), uvs.getY(i)), width, height);
    const elevation = sampleSmoothedWrappedScalar(world.layers.elevation, width, height, uvPoint.x, uvPoint.y);
    const waterWeight = sampleSmoothedWrappedScalar(world.layers.water, width, height, uvPoint.x, uvPoint.y);
    const isWater = waterWeight >= 0.5;
    const land01 = clamp01((elevation - world.seaLevel) / landRange);
    const depth01 = clamp01((world.seaLevel - elevation) / oceanRange);
    const relief = Math.pow(land01, 0.68);
    const radius = isWater
      ? linearInterpolate(scale.shallowSeabedRadius, scale.deepOceanFloorRadius, Math.pow(depth01, 0.76))
      : Math.min(
        scale.exceptionalMountainRadiusCap,
        linearInterpolate(scale.coastalLowlandRadius, scale.highlandRadiusMax, relief)
      );
    positions.setXYZ(i, vertex.x * radius, vertex.y * radius, vertex.z * radius);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function sampleWrappedScalar(values: Float32Array | Uint8Array, width: number, height: number, x: number, y: number): number {
  const wrappedX = ((x % width) + width) % width;
  const clampedY = Math.max(0, Math.min(height - 1, y));
  const x0 = Math.floor(wrappedX) % width;
  const x1 = (x0 + 1) % width;
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(clampedY)));
  const y1 = Math.max(0, Math.min(height - 1, y0 + 1));
  const tx = wrappedX - Math.floor(wrappedX);
  const ty = clampedY - y0;
  const top = linearInterpolate(values[y0 * width + x0] ?? 0, values[y0 * width + x1] ?? 0, tx);
  const bottom = linearInterpolate(values[y1 * width + x0] ?? 0, values[y1 * width + x1] ?? 0, tx);
  return linearInterpolate(top, bottom, ty);
}

function sampleSmoothedWrappedScalar(values: Float32Array | Uint8Array, width: number, height: number, x: number, y: number): number {
  const taps: Array<[number, number, number]> = [
    [0, 0, 4],
    [-1, 0, 2],
    [1, 0, 2],
    [0, -1, 1],
    [0, 1, 1],
    [-1, -1, 0.5],
    [1, -1, 0.5],
    [-1, 1, 0.5],
    [1, 1, 0.5]
  ];
  let total = 0;
  let weight = 0;
  for (const [dx, dy, tapWeight] of taps) {
    total += sampleWrappedScalar(values, width, height, x + dx, y + dy) * tapWeight;
    weight += tapWeight;
  }
  return weight > 0 ? total / weight : sampleWrappedScalar(values, width, height, x, y);
}

function rasterPercentileRange(values: Float32Array, lowPercentile: number, highPercentile: number): [number, number] {
  const sorted = Array.from(values).sort((a, b) => a - b);
  const low = sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * lowPercentile)))];
  const high = sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * highPercentile)))];
  return low === high ? [sorted[0] ?? 0, sorted[sorted.length - 1] ?? 1] : [low, high];
}

function clampGlobeTilt(value: number): number {
  return Math.max(-1.1, Math.min(1.1, value));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function linearInterpolate(a: number, b: number, t: number): number {
  return a + (b - a) * clamp01(t);
}

function smoothStep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / Math.max(0.0001, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function wrapUnit(value: number): number {
  return ((value % 1) + 1) % 1;
}

