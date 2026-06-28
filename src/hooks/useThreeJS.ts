import { useRef, useEffect, useCallback } from 'react';
import * as ThreeModule from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { setThreeRenderer } from './useCanvas';

const THREE = ThreeModule as any;

// Device configurations from original three-renderer.js
const deviceConfigs: Record<string, {
  modelPath?: string;
  aspectRatio: number;
  screenHeightFactor: number;
  screenOffset: { x: number; y: number; z: number };
  positionOffsetFactor: number;
  cornerRadiusFactor: number;
  modelRotation: { x: number; y: number; z: number };
  procedural?: boolean;
  bezelX?: number;
  bezelY?: number;
  depth?: number;
  cornerRadius?: number;
}> = {
  iphone: {
    modelPath: 'models/iphone-15-pro-max.glb',
    aspectRatio: 1290 / 2796,
    screenHeightFactor: 0.826,
    screenOffset: { x: 0.027, y: 0.745, z: 0.098 },
    positionOffsetFactor: 0.81,
    cornerRadiusFactor: 0.16,
    modelRotation: { x: 0, y: 0, z: 0 },
  },
  ipad: {
    procedural: true,
    aspectRatio: 2048 / 2732,
    screenHeightFactor: 0.88,
    screenOffset: { x: 0, y: 0, z: 0.034 },
    positionOffsetFactor: 0.72,
    cornerRadiusFactor: 0.055,
    modelRotation: { x: 0, y: 0, z: 0 },
    bezelX: 0.055, bezelY: 0.075, depth: 0.044, cornerRadius: 0.13,
  },
  samsung: {
    modelPath: 'models/samsung-galaxy-s25-ultra.glb',
    aspectRatio: 1440 / 3120,
    screenHeightFactor: 0.66,
    screenOffset: { x: 0, y: 0.0, z: 0.08 },
    positionOffsetFactor: 0.5,
    cornerRadiusFactor: 0.04,
    modelRotation: { x: 0, y: 0, z: 0 },
  },
};

const frameColorPresets: Record<string, Array<{ id: string; label: string; swatch: string; materials: Record<string, string> }>> = {
  iphone: [
    { id: 'natural', label: 'Natural Titanium', swatch: '#9d927f', materials: { backpanel: '#9d927f', metalframe: '#5f5950', gray: '#221f1b' } },
    { id: 'blue', label: 'Blue Titanium', swatch: '#3d4d5c', materials: { backpanel: '#394d5f', metalframe: '#3a4553', gray: '#1a1f24' } },
    { id: 'white', label: 'White Titanium', swatch: '#e3ddd4', materials: { backpanel: '#e3ddd4', metalframe: '#c4bdb4', gray: '#2a2825' } },
    { id: 'black', label: 'Black Titanium', swatch: '#3a3632', materials: { backpanel: '#3a3632', metalframe: '#2a2725', gray: '#1a1918' } },
    { id: 'desert', label: 'Desert Titanium', swatch: '#c4a882', materials: { backpanel: '#c4a882', metalframe: '#8a7560', gray: '#2a2218' } },
    { id: 'deep-purple', label: 'Deep Purple', swatch: '#5b4a6e', materials: { backpanel: '#5b4a6e', metalframe: '#3d3348', gray: '#1e1825' } },
    { id: 'gold', label: 'Gold', swatch: '#e3c8a0', materials: { backpanel: '#e3c8a0', metalframe: '#c9a96e', gray: '#2a2418' } },
    { id: 'red', label: 'Product Red', swatch: '#c1272d', materials: { backpanel: '#c1272d', metalframe: '#8a1c20', gray: '#1a0a0a' } },
  ],
  ipad: [
    { id: 'space-gray', label: 'Space Gray', swatch: '#5f6062', materials: { frame: '#5f6062', back_glass: '#4f5052', bezel: '#080808', camera: '#111111' } },
    { id: 'silver', label: 'Silver', swatch: '#d8d8d3', materials: { frame: '#d8d8d3', back_glass: '#c8c8c3', bezel: '#101010', camera: '#111111' } },
    { id: 'starlight', label: 'Starlight', swatch: '#e7decf', materials: { frame: '#e7decf', back_glass: '#d9cfbf', bezel: '#101010', camera: '#111111' } },
    { id: 'blue', label: 'Blue', swatch: '#9eb3c9', materials: { frame: '#9eb3c9', back_glass: '#8da4bd', bezel: '#090909', camera: '#111111' } },
    { id: 'purple', label: 'Purple', swatch: '#b6abc9', materials: { frame: '#b6abc9', back_glass: '#a99cbe', bezel: '#090909', camera: '#111111' } },
  ],
  samsung: [
    { id: 'gray', label: 'Titanium Gray', swatch: '#8a8a8a', materials: { back_glass: '#4c4c4c', frame: '#cdcdcd', antenna: '#707070' } },
    { id: 'black', label: 'Titanium Black', swatch: '#2a2a2a', materials: { back_glass: '#1a1a1a', frame: '#3a3a3a', antenna: '#2a2a2a' } },
    { id: 'silverblue', label: 'Titanium Silverblue', swatch: '#a8b8c8', materials: { back_glass: '#8a9eb0', frame: '#b8c8d4', antenna: '#7a8ea0' } },
    { id: 'whitesilver', label: 'Titanium Whitesilver', swatch: '#e8e4df', materials: { back_glass: '#d8d4cf', frame: '#e8e4df', antenna: '#c0bcb7' } },
    { id: 'pinkgold', label: 'Titanium Pinkgold', swatch: '#d4a89a', materials: { back_glass: '#c89888', frame: '#d4b0a0', antenna: '#b08878' } },
    { id: 'jadegreen', label: 'Titanium Jadegreen', swatch: '#9aaa9c', materials: { back_glass: '#7a9a7c', frame: '#a8b8aa', antenna: '#6a8a6c' } },
    { id: 'jetblack', label: 'Titanium Jetblack', swatch: '#404040', materials: { back_glass: '#2a2a2a', frame: '#484848', antenna: '#353535' } },
  ],
};

interface ThreeJSState {
  renderer: any;
  scene: any;
  camera: any;
  phoneModel: any;
  phonePivot: any;
  customScreenPlane: any;
  isInitialized: boolean;
  phoneModelLoaded: boolean;
  phoneModelLoading: boolean;
  currentDeviceModel: string;
  screenTexture: any;
  baseModelScale: number;
  modelCache: Record<string, any>;
}

function createRoundedRectShape(width: number, height: number, radius: number, THREE: any) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  const r = Math.min(radius, width / 2, height / 2);
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

function createProceduralDeviceModel(config: any, THREE: any) {
  const group = new THREE.Group();
  const screenHeight = 4.3 * config.screenHeightFactor;
  const screenWidth = screenHeight * config.aspectRatio;
  const bodyWidth = screenWidth + (config.bezelX || 0.18) * 2;
  const bodyHeight = screenHeight + (config.bezelY || 0.24) * 2;
  const bodyDepth = config.depth || 0.16;
  const outerRadius = config.cornerRadius || 0.18;
  const innerRadius = Math.max(0.08, outerRadius - 0.04);

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x5f6062, metalness: 0.75, roughness: 0.28 });
  frameMat.name = 'frame';
  const backMat = new THREE.MeshStandardMaterial({ color: 0x4f5052, metalness: 0.45, roughness: 0.38, side: THREE.DoubleSide });
  backMat.name = 'back_glass';
  const bezelMat = new THREE.MeshStandardMaterial({ color: 0x070707, metalness: 0.03, roughness: 0.72, side: THREE.DoubleSide });
  bezelMat.name = 'bezel';
  const cameraMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.1, roughness: 0.2 });
  cameraMat.name = 'camera';

  const bodyGeometry = new THREE.ExtrudeGeometry(createRoundedRectShape(bodyWidth, bodyHeight, outerRadius, THREE), {
    depth: bodyDepth, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.012, bevelSegments: 8, curveSegments: 16,
  });
  const body = new THREE.Mesh(bodyGeometry, frameMat);
  body.name = 'ipad-frame';
  body.position.z = -bodyDepth / 2;
  group.add(body);

  const frontBezel = new THREE.Mesh(
    new THREE.ShapeGeometry(createRoundedRectShape(bodyWidth - 0.026, bodyHeight - 0.026, innerRadius, THREE)),
    bezelMat
  );
  frontBezel.name = 'ipad-front-bezel';
  frontBezel.position.z = bodyDepth / 2 + 0.004;
  group.add(frontBezel);

  const backPanel = new THREE.Mesh(
    new THREE.ShapeGeometry(createRoundedRectShape(bodyWidth - 0.08, bodyHeight - 0.08, innerRadius, THREE)),
    backMat
  );
  backPanel.name = 'ipad-back-panel';
  backPanel.position.z = -bodyDepth / 2 - 0.006;
  group.add(backPanel);

  const camera = new THREE.Mesh(new THREE.CircleGeometry(0.018, 32), cameraMat);
  camera.name = 'ipad-camera';
  camera.position.set(0, screenHeight / 2 + (config.bezelY || 0.075) * 0.5, bodyDepth / 2 + 0.008);
  group.add(camera);

  return group;
}

function applyFrameColor(model: any, presetId: string | undefined, deviceType: string): void {
  if (!model || !presetId) return;
  const preset = frameColorPresets[deviceType]?.find((p) => p.id === presetId);
  if (!preset) return;

  model.traverse((child: any) => {
    if (!child.isMesh || !child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material: any) => {
      const matName = (material.name || '').toLowerCase();
      if (preset.materials[matName] && material.color?.set) {
        material.color.set(preset.materials[matName]);
      }
    });
  });
}

function createDeviceScreenImage(image: HTMLImageElement, config: any): HTMLCanvasElement {
  const targetAspect = config.aspectRatio || (image.width / image.height);
  const imageAspect = image.width / image.height;
  let canvasWidth = image.width;
  let canvasHeight = image.height;

  if (Math.abs(imageAspect - targetAspect) > 0.02) {
    if (imageAspect < targetAspect) {
      canvasHeight = image.height;
      canvasWidth = Math.round(canvasHeight * targetAspect);
    } else {
      canvasWidth = image.width;
      canvasHeight = Math.round(canvasWidth / targetAspect);
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d')!;
  const radius = Math.round(canvas.width * config.cornerRadiusFactor);

  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(canvas.width - radius, 0);
  ctx.quadraticCurveTo(canvas.width, 0, canvas.width, radius);
  ctx.lineTo(canvas.width, canvas.height - radius);
  ctx.quadraticCurveTo(canvas.width, canvas.height, canvas.width - radius, canvas.height);
  ctx.lineTo(radius, canvas.height);
  ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.clip();

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
  const dw = image.width * scale;
  const dh = image.height * scale;
  const dx = (canvas.width - dw) / 2;
  const dy = (canvas.height - dh) / 2;
  ctx.drawImage(image, dx, dy, dw, dh);

  return canvas;
}

export function useThreeJS(containerRef: React.RefObject<HTMLDivElement | null>) {
  const stateRef = useRef<ThreeJSState>({
    renderer: null, scene: null, camera: null, phoneModel: null, phonePivot: null,
    customScreenPlane: null, isInitialized: false, phoneModelLoaded: false,
    phoneModelLoading: false, currentDeviceModel: 'iphone', screenTexture: null, baseModelScale: 1,
    modelCache: {},
  });

  const animFrameRef = useRef<number>(0);

  const initScene = useCallback(() => {
    const container = containerRef.current;
    if (!container || stateRef.current.isInitialized) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x667eea);

    const aspect = 400 / 700;
    const camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 1000);
    camera.position.set(0, 0, 6);

    const renderer = new THREE.WebGLRenderer({
      antialias: false, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance',
    });
    renderer.setSize(400, 700);
    renderer.setPixelRatio(1);
    if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.autoClear = false;
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
    keyLight.position.set(2, 3, 4);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-2, 1, 2);
    scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
    rimLight.position.set(0, -2, -3);
    scene.add(rimLight);

    stateRef.current = { ...stateRef.current, renderer, scene, camera, isInitialized: true };

    setThreeRenderer({
      renderToCanvas: (canvas: HTMLCanvasElement, width: number, height: number, ss?: any) => {
        renderToCanvasInternal(canvas, width, height, ss);
      },
      renderForScreenshot: (canvas, width, height, screenshot, image) =>
        renderForScreenshotInternal(canvas, width, height, screenshot, image),
      isReady: false,
    });

    loadPhoneModel('iphone');
  }, [containerRef]);

  const loadPhoneModel = useCallback((deviceType: string) => {
    const state = stateRef.current;
    if (!state.scene || state.phoneModelLoading) return;
    const config = deviceConfigs[deviceType];
    if (!config) return;

    state.phoneModelLoading = true;
    state.currentDeviceModel = deviceType;

    // Remove existing model
    if (state.phonePivot && state.scene) {
      state.scene.remove(state.phonePivot);
      state.phonePivot.traverse((child: any) => {
        if (child.isMesh) { child.geometry?.dispose(); child.material?.dispose(); }
      });
      state.phonePivot = null;
      state.phoneModel = null;
      state.phoneModelLoaded = false;
    }

    if (config.procedural) {
      const model = createProceduralDeviceModel(config, THREE);
      finishModelLoad(model, deviceType);
      return;
    }
    if (!config.modelPath) {
      state.phoneModelLoading = false;
      return;
    }

    const loader = new GLTFLoader();
    loader.load(
      config.modelPath,
      (gltf: any) => { finishModelLoad(gltf.scene, deviceType); },
      undefined,
      (error: any) => { console.error('Error loading phone model:', error); state.phoneModelLoading = false; }
    );
  }, []);

  const finishModelLoad = useCallback((model: any, deviceType: string) => {
    const state = stateRef.current;
    if (!state.scene) return;
    const config = deviceConfigs[deviceType] || deviceConfigs.iphone;

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    model.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const baseModelScale = 3.75 / maxDim;
    model.scale.setScalar(baseModelScale);

    const screenOffset = config.screenOffset;
    const pivot = new THREE.Group();
    model.position.set(-screenOffset.x * baseModelScale, -screenOffset.y * baseModelScale, -screenOffset.z * baseModelScale);
    pivot.add(model);
    state.scene.add(pivot);

    // Create screen overlay
    const aspectRatio = config.aspectRatio;
    const planeHeight = 4.3 * config.screenHeightFactor;
    const planeWidth = planeHeight * aspectRatio;
    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
    const material = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide });
    const screenPlane = new THREE.Mesh(geometry, material);
    screenPlane.position.set(screenOffset.x, screenOffset.y, screenOffset.z);
    model.add(screenPlane);

    stateRef.current = {
      ...stateRef.current, phoneModel: model, phonePivot: pivot, customScreenPlane: screenPlane,
      phoneModelLoaded: true, phoneModelLoading: false, baseModelScale, currentDeviceModel: deviceType,
    };

    setThreeRenderer({
      renderToCanvas: (canvas: HTMLCanvasElement, width: number, height: number, ss?: any) => {
        renderToCanvasInternal(canvas, width, height, ss);
      },
      renderForScreenshot: (canvas, width, height, screenshot, image) =>
        renderForScreenshotInternal(canvas, width, height, screenshot, image),
      isReady: true,
    });
  }, []);

  const updateScreenTexture = useCallback((image: HTMLImageElement | null) => {
    const state = stateRef.current;
    if (!state.phoneModel || !image) return;
    const config = deviceConfigs[state.currentDeviceModel] || deviceConfigs.iphone;

    if (state.screenTexture) state.screenTexture.dispose();

    const roundedImage = createDeviceScreenImage(image, config);
    const texture = new THREE.Texture(roundedImage);
    texture.needsUpdate = true;
    if (THREE.sRGBEncoding) texture.encoding = THREE.sRGBEncoding;
    texture.flipY = true;

    const screenMaterial = new THREE.MeshBasicMaterial({ map: texture, side: THREE.FrontSide, transparent: true });
    if (state.customScreenPlane) {
      state.customScreenPlane.material.dispose();
      state.customScreenPlane.material = screenMaterial;
    }
    stateRef.current.screenTexture = texture;
  }, []);

  const buildRenderableModel = useCallback((model: any, deviceType: string) => {
    const config = deviceConfigs[deviceType] || deviceConfigs.iphone;

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    model.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const modelBaseScale = 3.75 / maxDim;
    model.scale.setScalar(modelBaseScale);

    const screenOffset = config.screenOffset;
    const pivot = new THREE.Group();
    model.position.set(
      -screenOffset.x * modelBaseScale,
      -screenOffset.y * modelBaseScale,
      -screenOffset.z * modelBaseScale
    );
    pivot.add(model);

    const planeHeight = 4.3 * config.screenHeightFactor;
    const planeWidth = planeHeight * config.aspectRatio;
    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
    const material = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide });
    const screenPlane = new THREE.Mesh(geometry, material);
    screenPlane.position.set(screenOffset.x, screenOffset.y, screenOffset.z);
    model.add(screenPlane);

    return { model, pivot, screenPlane, baseScale: modelBaseScale, loaded: true, loading: false };
  }, []);

  const loadCachedPhoneModel = useCallback((deviceType: string): Promise<any> => {
    const state = stateRef.current;
    if (state.modelCache[deviceType]?.loaded) return Promise.resolve(state.modelCache[deviceType]);
    if (state.modelCache[deviceType]?.promise) return state.modelCache[deviceType].promise;

    const config = deviceConfigs[deviceType];
    if (!config) return Promise.resolve(null);

    const promise = new Promise<any>((resolve) => {
      const finish = (model: any) => {
        const cached = buildRenderableModel(model, deviceType);
        if (cached) {
          stateRef.current.modelCache[deviceType] = cached;
          resolve(cached);
        } else {
          stateRef.current.modelCache[deviceType] = { loaded: false, loading: false };
          resolve(null);
        }
      };

      if (config.procedural) {
        finish(createProceduralDeviceModel(config, THREE));
        return;
      }
      if (!config.modelPath) {
        stateRef.current.modelCache[deviceType] = { loaded: false, loading: false };
        resolve(null);
        return;
      }

      const loader = new GLTFLoader();
      loader.load(
        config.modelPath,
        (gltf: any) => finish(gltf.scene),
        undefined,
        () => {
          stateRef.current.modelCache[deviceType] = { loaded: false, loading: false };
          resolve(null);
        }
      );
    });

    state.modelCache[deviceType] = { loaded: false, loading: true, promise };
    return promise;
  }, [buildRenderableModel]);

  const renderForScreenshotInternal = useCallback(async (
    targetCanvas: HTMLCanvasElement,
    width: number,
    height: number,
    screenshot: any,
    image: HTMLImageElement | null
  ): Promise<boolean> => {
    const state = stateRef.current;
    if (!state.renderer || !state.scene || !state.camera || !image) return false;

    const ss = screenshot?.screenshot;
    if (!ss?.use3D) return false;

    const deviceType = ss.device3D || 'iphone';
    const config = deviceConfigs[deviceType] || deviceConfigs.iphone;
    const useCurrentModel = deviceType === state.currentDeviceModel && !!state.phonePivot;
    const cached = useCurrentModel ? null : await loadCachedPhoneModel(deviceType);
    const pivotToUse = useCurrentModel ? state.phonePivot : cached?.pivot;
    const screenPlaneToUse = useCurrentModel ? state.customScreenPlane : cached?.screenPlane;
    const modelToUse = useCurrentModel ? state.phoneModel : cached?.model;
    if (!pivotToUse || !screenPlaneToUse || !modelToUse) return false;

    if (!useCurrentModel) state.scene.add(pivotToUse);

    const originalBackground = state.scene.background;
    const originalPosition = pivotToUse.position.clone();
    const originalScale = pivotToUse.scale.clone();
    const originalRotation = pivotToUse.rotation.clone();
    const originalMaterial = screenPlaneToUse.material;
    const originalCurrentVisible = state.phonePivot?.visible;

    if (!useCurrentModel && state.phonePivot) {
      state.phonePivot.visible = false;
    }

    const roundedImage = createDeviceScreenImage(image, config);
    const texture = new THREE.Texture(roundedImage);
    texture.needsUpdate = true;
    if (THREE.sRGBEncoding) texture.encoding = THREE.sRGBEncoding;
    texture.flipY = true;
    screenPlaneToUse.material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.FrontSide, transparent: true });

    applyFrameColor(modelToUse, ss.frameColor, deviceType);

    const rotation3D = ss.rotation3D || { x: 0, y: 0, z: 0 };
    const modelRot = config.modelRotation || { x: 0, y: 0, z: 0 };
    pivotToUse.rotation.set(
      (rotation3D.x + modelRot.x) * Math.PI / 180,
      (rotation3D.y + modelRot.y) * Math.PI / 180,
      (rotation3D.z + modelRot.z) * Math.PI / 180
    );

    const screenshotScale = ss.scale / 100;
    pivotToUse.scale.setScalar(screenshotScale);
    const availableSpaceY = (1 - screenshotScale) * 2;
    const availableSpaceX = (1 - screenshotScale) * 0.9;
    const xOffset = ((ss.x - 50) / 50) * availableSpaceX;
    const yOffset = -((ss.y - 50) / 50) * availableSpaceY;
    pivotToUse.position.set(xOffset, yOffset, 0);

    state.scene.background = null;
    state.renderer.setClearColor(0x000000, 0);
    state.renderer.setSize(width, height);
    state.camera.aspect = width / height;
    state.camera.updateProjectionMatrix();
    state.renderer.clear();
    state.renderer.render(state.scene, state.camera);

    const ctx = targetCanvas.getContext('2d');
    if (ctx) ctx.drawImage(state.renderer.domElement, 0, 0, width, height);

    screenPlaneToUse.material.map?.dispose();
    screenPlaneToUse.material.dispose();
    screenPlaneToUse.material = originalMaterial;

    state.renderer.setSize(400, 700);
    state.camera.aspect = 400 / 700;
    state.camera.updateProjectionMatrix();
    state.scene.background = originalBackground;
    pivotToUse.position.copy(originalPosition);
    pivotToUse.scale.copy(originalScale);
    pivotToUse.rotation.copy(originalRotation);

    if (!useCurrentModel) {
      state.scene.remove(pivotToUse);
      if (state.phonePivot) state.phonePivot.visible = originalCurrentVisible ?? true;
    }

    return true;
  }, [loadCachedPhoneModel]);

  const setRotation = useCallback((x: number, y: number, z: number) => {
    const state = stateRef.current;
    if (!state.phonePivot) return;
    const config = deviceConfigs[state.currentDeviceModel] || deviceConfigs.iphone;
    const modelRot = config.modelRotation || { x: 0, y: 0, z: 0 };
    state.phonePivot.rotation.x = (x + modelRot.x) * Math.PI / 180;
    state.phonePivot.rotation.y = (y + modelRot.y) * Math.PI / 180;
    state.phonePivot.rotation.z = (z + modelRot.z) * Math.PI / 180;
  }, []);

  const setFrameColor = useCallback((presetId?: string, deviceType?: string) => {
    const state = stateRef.current;
    applyFrameColor(state.phoneModel, presetId, deviceType || state.currentDeviceModel || 'iphone');
  }, []);

  const renderToCanvasInternal = useCallback((
    targetCanvas: HTMLCanvasElement,
    width: number,
    height: number,
    screenshotSettings?: { scale: number; x: number; y: number; rotation3D?: { x: number; y: number; z: number } }
  ) => {
    const state = stateRef.current;
    if (!state.renderer || !state.scene || !state.camera || !state.phonePivot) return;

    const originalBackground = state.scene.background;
    const originalPosition = state.phonePivot.position.clone();
    const originalScale = state.phonePivot.scale.clone();
    const originalRotation = state.phonePivot.rotation.clone();

    // Apply scale and position from screenshot settings (matches original three-renderer.js)
    if (screenshotSettings) {
      const ss = screenshotSettings;
      const screenshotScale = ss.scale / 100;
      state.phonePivot.scale.setScalar(screenshotScale);

      const availableSpaceY = (1 - screenshotScale) * 2;
      const availableSpaceX = (1 - screenshotScale) * 0.9;
      const xOffset = ((ss.x - 50) / 50) * availableSpaceX;
      const yOffset = -((ss.y - 50) / 50) * availableSpaceY;
      state.phonePivot.position.set(
        xOffset,
        yOffset,
        0
      );

      // Apply rotation
      if (ss.rotation3D) {
        const config = deviceConfigs[state.currentDeviceModel] || deviceConfigs.iphone;
        const modelRot = config.modelRotation || { x: 0, y: 0, z: 0 };
        state.phonePivot.rotation.set(
          (ss.rotation3D.x + modelRot.x) * Math.PI / 180,
          (ss.rotation3D.y + modelRot.y) * Math.PI / 180,
          (ss.rotation3D.z + modelRot.z) * Math.PI / 180
        );
      }
    }

    state.scene.background = null;
    state.renderer.setClearColor(0x000000, 0);
    state.renderer.setSize(width, height);
    state.camera.aspect = width / height;
    state.camera.updateProjectionMatrix();
    state.renderer.clear();
    state.renderer.render(state.scene, state.camera);

    const ctx = targetCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(state.renderer.domElement, 0, 0, width, height);
    }

    // Restore preview size and original transforms
    state.renderer.setSize(400, 700);
    state.camera.aspect = 400 / 700;
    state.camera.updateProjectionMatrix();
    state.scene.background = originalBackground;
    state.phonePivot.position.copy(originalPosition);
    state.phonePivot.scale.copy(originalScale);
    state.phonePivot.rotation.copy(originalRotation);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      const state = stateRef.current;
      if (state.renderer) {
        state.renderer.dispose();
        if (state.renderer.domElement?.parentElement) {
          state.renderer.domElement.parentElement.removeChild(state.renderer.domElement);
        }
      }
      stateRef.current.isInitialized = false;
      setThreeRenderer(null);
    };
  }, []);

  // Drag-to-rotate on the container element
  const setupDragRotate = useCallback((container: HTMLElement, onDrag: (dx: number, dy: number, mode: 'rotate' | 'move') => void) => {
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    let mode: 'rotate' | 'move' = 'rotate';

    const onMouseDown = (e: MouseEvent) => {
      if ((container as HTMLElement).closest('.element-dragging')) return;
      isDragging = true;
      mode = e.altKey ? 'move' : 'rotate';
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      onDrag(dx, dy, mode);
    };
    const onMouseUp = () => { isDragging = false; };
    const onTouchStart = (e: TouchEvent) => { isDragging = true; mode = 'rotate'; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; };
    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      const dx = e.touches[0].clientX - lastX;
      const dy = e.touches[0].clientY - lastY;
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
      onDrag(dx, dy, mode);
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onMouseUp);

    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onMouseUp);
    };
  }, []);

  return { initScene, loadPhoneModel, updateScreenTexture, setRotation, setFrameColor, setupDragRotate, stateRef };
}
