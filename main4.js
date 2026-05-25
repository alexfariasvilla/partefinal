import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";
import * as Tone from "tone";

/**  CONFIGURACIÓN  */
const CONFIG = {
  WORLD_SIZE: 200,
  WORLD_RADIUS: 95,
  PLAYER_SPEED: 4.5,
  PLAYER_RADIUS: 0.5,
  PLAYER_HEIGHT: 1.7,
  ZOMBIE_SPEED: 1.8,
  ZOMBIE_COUNT: 15,
  ZOMBIE_SPAWN_DISTANCE: 40,
  ZOMBIE_HEALTH: 3,
  ZOMBIE_DAMAGE: 15,
  ZOMBIE_ATTACK_COOLDOWN: 1.5,
  TREE_COUNT: 80,
  GRAVE_COUNT: 30,
  ROCK_COUNT: 25,
  MAX_HEALTH: 100,
  AXE_DAMAGE: 50,
  AXE_RANGE: 3.5,
  AXE_SWING_DURATION: 350,
};

/**  GAME STATE  */
const gameState = {
  health: CONFIG.MAX_HEALTH,
  kills: 0,
  startTime: Date.now(),
  isAlive: true,
  isSwinging: false,
  lastSwingTime: 0,
  gameTime: 0,
  swingCooldown: 0.5,
  lastSwingEndTime: 0,
};

/**  AUDIO HTML (Música de fondo)  */
const ambientAudioSystem = {
  element: null,
  isPlaying: false,

  init() {
    this.element = document.getElementById("ambientAudio");
    if (!this.element) {
      console.warn("⚠️ Audio element not found");
      return;
    }
    this.element.volume = 0.25;
    console.log("✅ Audio ambiental cargado");
  },

  play() {
    if (!this.element || this.isPlaying) return;
    this.element.play().catch(err => {
      console.log("⏸️ Audio play delayed - user interaction required");
    });
    this.isPlaying = true;
  },

  pause() {
    if (!this.element) return;
    this.element.pause();
    this.isPlaying = false;
  },

  stop() {
    if (!this.element) return;
    this.element.pause();
    this.element.currentTime = 0;
    this.isPlaying = false;
  }
};

/**  SISTEMA DE AUDIO TONE.JS  */
const audioSystem = {
  initialized: false,
  synth: null,
  masterGain: null,
  
  async init() {
    if (this.initialized) return;
    try {
      await Tone.start();
      console.log("Tone.js inicializado");
      
      this.masterGain = new Tone.Gain(0.3);
      this.masterGain.toDestination();
      
      this.synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "square" },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 },
      }).connect(this.masterGain);
      
      this.initialized = true;
    } catch (e) {
      console.warn("Error inicializando Tone.js:", e);
    }
  },

  playAxeHit() {
    if (!this.initialized) return;
    try {
      const now = Tone.now();
      this.synth.triggerAttackRelease("G4", "0.1", now);
      this.synth.triggerAttackRelease("D4", "0.15", now + 0.05);
    } catch (e) {
      console.log("Error playing axe hit:", e);
    }
  },

  playAxeSwing() {
    if (!this.initialized) return;
    try {
      const now = Tone.now();
      this.synth.triggerAttackRelease("C3", "0.05", now);
      this.synth.triggerAttackRelease("E3", "0.08", now + 0.02);
    } catch (e) {
      console.log("Error playing axe swing:", e);
    }
  },

  playZombieGrowl() {
    if (!this.initialized) return;
    try {
      const now = Tone.now();
      this.synth.triggerAttackRelease("A1", "0.3", now);
      this.synth.triggerAttackRelease("D2", "0.4", now + 0.1);
    } catch (e) {
      console.log("Error playing growl:", e);
    }
  },

  playPlayerDamage() {
    if (!this.initialized) return;
    try {
      this.synth.triggerAttackRelease("A2", "0.2");
    } catch (e) {
      console.log("Error playing damage sound:", e);
    }
  },

  playGameOver() {
    if (!this.initialized) return;
    try {
      const now = Tone.now();
      this.synth.triggerAttackRelease("G3", "0.2", now);
      this.synth.triggerAttackRelease("E3", "0.3", now + 0.25);
      this.synth.triggerAttackRelease("C3", "0.4", now + 0.6);
    } catch (e) {
      console.log("Error playing game over:", e);
    }
  }
};

ambientAudioSystem.init();

document.addEventListener("click", () => {
  audioSystem.init();
  if (!ambientAudioSystem.isPlaying) {
    ambientAudioSystem.play();
  }
}, { once: true });

/**  HUD SYSTEM  */
const hudSystem = {
  canvas: null,
  texture: null,
  hudMesh: null,
  gameOverCanvas: null,
  gameOverTexture: null,
  gameOverMesh: null,
  lastDamageTime: 0,
  
  init(controller) {
    // === HUD NORMAL ===
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 256;
    
    this.texture = new THREE.CanvasTexture(this.canvas);
    const hudMaterial = new THREE.MeshBasicMaterial({ 
      map: this.texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false
    });
    
    const hudGeometry = new THREE.PlaneGeometry(0.8, 0.4);
    this.hudMesh = new THREE.Mesh(hudGeometry, hudMaterial);
    this.hudMesh.position.set(1.8, 1.3, -1.0);
    this.hudMesh.rotation.x = 0;
    this.hudMesh.renderOrder = 9999;
    controller.add(this.hudMesh);
    
    // === GAME OVER SCREEN ===
   this.gameOverCanvas = document.createElement('canvas');
    this.gameOverCanvas.width = 1024;
    this.gameOverCanvas.height = 768;
    
    this.gameOverTexture = new THREE.CanvasTexture(this.gameOverCanvas);
    const gameOverMaterial = new THREE.MeshBasicMaterial({ 
      map: this.gameOverTexture,
      transparent: true,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false
    });
    
    const gameOverGeometry = new THREE.PlaneGeometry(2.0, 1.5);
    this.gameOverMesh = new THREE.Mesh(gameOverGeometry, gameOverMaterial);
    this.gameOverMesh.position.set(0, 0, -1.5);
    this.gameOverMesh.renderOrder = 10000;
    this.gameOverMesh.visible = false;
    controller.add(this.gameOverMesh);
    
    console.log("✅ HUD discreto inicializado en VR");
  },
  
  update(health, kills, gameTime) {
    if (!this.canvas) return;
    
    const ctx = this.canvas.getContext('2d');
    const currentTime = Date.now();
    const timeSinceDamage = currentTime - this.lastDamageTime;
    const isDamaged = timeSinceDamage < 400;
    
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // === DISEÑO MINIMALISTA ===
    // Fondo oscuro muy sutil
    ctx.fillStyle = 'rgba(10, 10, 15, 0.7)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Borde delgado elegante
    ctx.strokeStyle = isDamaged ? '#ff3333' : '#444444';
    ctx.lineWidth = 2;
    ctx.strokeRect(3, 3, this.canvas.width - 6, this.canvas.height - 6);
    
    // === SALUD EN LA PARTE SUPERIOR DERECHA ===
    ctx.font = 'bold 28px Arial';
    ctx.fillStyle = health > 50 ? '#00ff00' : health > 25 ? '#ffff00' : '#ff4444';
    ctx.textAlign = 'right';
    ctx.fillText(`${health}%`, this.canvas.width - 30, 50);
    
    // === BARRA DE VIDA CENTRADA ===
    const barWidth = 450;
    const barHeight = 20;
    const barX = (this.canvas.width - barWidth) / 2;
    const barY = 100;
    
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    const healthPercent = Math.max(0, health / CONFIG.MAX_HEALTH);
    ctx.fillStyle = health > 50 ? '#00dd00' : health > 25 ? '#ffdd00' : '#ff4444';
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
    
    ctx.strokeStyle = isDamaged ? '#ff3333' : '#555555';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
    
    // === STATS EN LA PARTE INFERIOR ===
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'left';
    
    // Kills
    ctx.fillStyle = '#00dd00';
    ctx.fillText(`K: ${kills}`, 30, 230);
    
    // Tiempo
    const minutes = Math.floor(gameTime / 60);
    const seconds = gameTime % 60;
    ctx.fillStyle = '#00dddd';
    ctx.fillText(`T: ${minutes}:${seconds.toString().padStart(2, '0')}`, this.canvas.width - 150, 230);
    
    this.texture.needsUpdate = true;
  },
  
  showGameOver(kills, time) {
    if (!this.gameOverCanvas) return;
    
    const ctx = this.gameOverCanvas.getContext('2d');
    
    // Fondo oscuro con gradiente
    const gradient = ctx.createLinearGradient(0, 0, 0, this.gameOverCanvas.height);
    gradient.addColorStop(0, 'rgba(20, 0, 0, 0.95)');
    gradient.addColorStop(1, 'rgba(0, 0, 10, 0.95)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.gameOverCanvas.width, this.gameOverCanvas.height);
    
    // Borde rojo destacado
    ctx.strokeStyle = '#ff3333';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, this.gameOverCanvas.width - 20, this.gameOverCanvas.height - 20);
    
    // === GAME OVER ===
    ctx.font = 'bold 150px Arial';
    ctx.fillStyle = '#ff3333';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 5;
    ctx.fillText('GAME OVER', this.gameOverCanvas.width / 2, 80);
    
    ctx.shadowColor = 'transparent';
    
    // === STATS FINALES ===
    ctx.font = 'bold 60px Arial';
    ctx.fillStyle = '#00ff00';
    ctx.fillText(`KILLS: ${kills}`, this.gameOverCanvas.width / 2, 280);
    
    ctx.fillStyle = '#00ffff';
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    ctx.fillText(`TIME: ${minutes}:${seconds.toString().padStart(2, '0')}`, this.gameOverCanvas.width / 2, 380);
    
    // === BOTÓN DE REINTENTAR ===
    const buttonY = 500;
    const buttonWidth = 400;
    const buttonHeight = 100;
    const buttonX = (this.gameOverCanvas.width - buttonWidth) / 2;
    
    // Fondo del botón
    ctx.fillStyle = '#00dd00';
    ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
    
    // Borde del botón
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 4;
    ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);
    
    // Texto del botón
    ctx.font = 'bold 60px Arial';
    ctx.fillStyle = '#000000';
    ctx.fillText('REINTENTAR', this.gameOverCanvas.width / 2, buttonY + 20);
    
    // Instrucción
    ctx.font = 'bold 30px Arial';
    ctx.fillStyle = '#ffff00';
    ctx.fillText('Presiona Trigger para reintentar', this.gameOverCanvas.width / 2, 650);
    
    this.gameOverTexture.needsUpdate = true;
    this.gameOverMesh.visible = true;
  },
  
  hideGameOver() {
    this.gameOverMesh.visible = false;
  },
  
  recordDamage() {
    this.lastDamageTime = Date.now();
  }
};

/**  DOM ELEMENTOS (Para Game Over)  */
const hudHealth = document.getElementById("healthValue");
const hudHealthFill = document.getElementById("healthFill");
const hudKills = document.getElementById("killCount");
const hudTime = document.getElementById("timeValue");
const gameOverScreen = document.getElementById("gameOver");
const finalKills = document.getElementById("finalKills");
const finalTime = document.getElementById("finalTime");

/**  RENDERER & SCENE  */
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0f);
scene.fog = new THREE.FogExp2(0x1a1a2e, 0.015);

/**  CÁMARA & JUGADOR  */
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  500
);
const player = new THREE.Group();
player.position.set(0, CONFIG.PLAYER_HEIGHT, 0);
player.add(camera);
scene.add(player);

/**  CIELO DINÁMICO  */
const skySystem = {
  moonLight: null,
  moon: null,
  stars: null,
  
  init() {
    // Luz de luna
    this.moonLight = new THREE.DirectionalLight(0x6b8cff, 0.8);
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.set(2048, 2048);
    this.moonLight.shadow.camera.left = -100;
    this.moonLight.shadow.camera.right = 100;
    this.moonLight.shadow.camera.top = 100;
    this.moonLight.shadow.camera.bottom = -100;
    scene.add(this.moonLight);

    // Luna
    const moonGeometry = new THREE.SphereGeometry(15, 32, 32);
    const moonMaterial = new THREE.MeshBasicMaterial({ color: 0xffffcc });
    this.moon = new THREE.Mesh(moonGeometry, moonMaterial);
    scene.add(this.moon);

    // Estrellas
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 5000;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      const r = 300 + Math.random() * 200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i + 1] = r * Math.cos(phi);
      starPositions[i + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.5,
      transparent: true,
      opacity: 0.8,
    });
    this.stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(this.stars);

    // Luz ambiental
    const ambientLight = new THREE.AmbientLight(0x2a2a4a, 0.3);
    scene.add(ambientLight);
  },

  update(gameTime) {
    if (!this.moon || !this.moonLight) return;

    // Luna se mueve en círculo alrededor del mapa
    const moonOrbitRadius = 150;
    const moonSpeed = 0.0001;
    const moonAngle = gameTime * moonSpeed;
    
    this.moon.position.x = Math.cos(moonAngle) * moonOrbitRadius;
    this.moon.position.y = 80 + Math.sin(moonAngle * 0.5) * 30;
    this.moon.position.z = Math.sin(moonAngle) * moonOrbitRadius;

    // Luz sigue a la luna
    this.moonLight.position.copy(this.moon.position);
    this.moonLight.position.multiplyScalar(0.8);
  },
};
skySystem.init();
/**  SUELO CON TEXTURA  */
const textureLoader = new THREE.TextureLoader();
const groundTexture = textureLoader.load(
  "https://threejs.org/examples/textures/terrain/grasslight-big.jpg"
);
groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
groundTexture.repeat.set(20, 20);

const groundGeometry = new THREE.CircleGeometry(CONFIG.WORLD_RADIUS, 64);
const groundMaterial = new THREE.MeshStandardMaterial({
  map: groundTexture,
  color: 0x3a4a2a,
  roughness: 0.9,
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

/**  MURO LÍMITE  */
const wallGeometry = new THREE.CylinderGeometry(
  CONFIG.WORLD_RADIUS,
  CONFIG.WORLD_RADIUS,
  15,
  64,
  1,
  true
);
const wallMaterial = new THREE.MeshBasicMaterial({
  color: 0x000000,
  side: THREE.BackSide,
  transparent: true,
  opacity: 0.8,
});
const wall = new THREE.Mesh(wallGeometry, wallMaterial);
wall.position.y = 7.5;
scene.add(wall);

/**  SISTEMA DE COLISIONES  */
const obstacles = [];

function checkObstacleCollision(x, z, radius = 2) {
  for (const obs of obstacles) {
    const dist = Math.hypot(x - obs.x, z - obs.z);
    if (dist < radius + obs.radius) return true;
  }
  return false;
}

/**  ÁRBOLES  */
function createTree(x, z) {
  const treeGroup = new THREE.Group();

  const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.4, 4, 8);
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3520 });
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
  trunk.position.y = 2;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  treeGroup.add(trunk);

  const foliageGeometry = new THREE.SphereGeometry(2, 8, 8);
  const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x1a3a1a });
  const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
  foliage.position.y = 5;
  foliage.castShadow = true;
  treeGroup.add(foliage);

  treeGroup.position.set(x, 0, z);
  scene.add(treeGroup);
  obstacles.push({ x, z, radius: 0.8, type: "tree" });
}

for (let i = 0; i < CONFIG.TREE_COUNT; i++) {
  const angle = Math.random() * Math.PI * 2;
  const distance = 15 + Math.random() * (CONFIG.WORLD_RADIUS - 20);
  const x = Math.cos(angle) * distance;
  const z = Math.sin(angle) * distance;
  if (!checkObstacleCollision(x, z, 5)) {
    createTree(x, z);
  }
}

/**  TUMBAS  */
function createGrave(x, z) {
  const graveGroup = new THREE.Group();

  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0x505050,
    roughness: 0.9,
  });

  const baseGeometry = new THREE.BoxGeometry(1.2, 0.3, 0.8);
  const base = new THREE.Mesh(baseGeometry, baseMaterial);
  base.position.y = 0.15;
  base.castShadow = true;
  base.receiveShadow = true;
  graveGroup.add(base);

  const stoneGeometry = new THREE.BoxGeometry(0.8, 1.5, 0.2);
  const stone = new THREE.Mesh(stoneGeometry, baseMaterial);
  stone.position.y = 1.05;
  stone.castShadow = true;
  graveGroup.add(stone);

  graveGroup.position.set(x, 0, z);
  graveGroup.rotation.y = Math.random() * Math.PI * 2;
  scene.add(graveGroup);
  obstacles.push({ x, z, radius: 0.8, type: "grave" });
}

for (let i = 0; i < CONFIG.GRAVE_COUNT; i++) {
  const angle = Math.random() * Math.PI * 2;
  const distance = 10 + Math.random() * (CONFIG.WORLD_RADIUS - 15);
  const x = Math.cos(angle) * distance;
  const z = Math.sin(angle) * distance;
  if (!checkObstacleCollision(x, z, 5)) {
    createGrave(x, z);
  }
}

/**  ROCAS  */
function createRock(x, z) {
  const rockGeometry = new THREE.DodecahedronGeometry(
    1 + Math.random() * 0.5,
    0
  );
  const rockMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a4a4a,
    roughness: 1,
  });
  const rock = new THREE.Mesh(rockGeometry, rockMaterial);
  rock.position.set(x, 0.5, z);
  rock.rotation.set(Math.random(), Math.random(), Math.random());
  rock.castShadow = true;
  rock.receiveShadow = true;
  scene.add(rock);
  obstacles.push({ x, z, radius: 1.2, type: "rock" });
}

for (let i = 0; i < CONFIG.ROCK_COUNT; i++) {
  const angle = Math.random() * Math.PI * 2;
  const distance = 10 + Math.random() * (CONFIG.WORLD_RADIUS - 15);
  const x = Math.cos(angle) * distance;
  const z = Math.sin(angle) * distance;
  if (!checkObstacleCollision(x, z, 5)) {
    createRock(x, z);
  }
}
/**  HACHA VR MEJORADA  */
const axeSystem = {
  group: null,
  blade: null,
  handle: null,
  light: null,
  previousPosition: new THREE.Vector3(),
  currentPosition: new THREE.Vector3(),
  isActive: false,

  init() {
    this.group = new THREE.Group();

    // Mango
    const handleGeometry = new THREE.CylinderGeometry(0.04, 0.06, 0.8, 8);
    const handleMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a2810,
      roughness: 0.8,
    });
    this.handle = new THREE.Mesh(handleGeometry, handleMaterial);
    this.handle.position.y = -0.2;
    this.handle.castShadow = true;
    this.group.add(this.handle);

    // Cabeza del hacha - mejorada
    const bladeGeometry = new THREE.BoxGeometry(0.4, 0.3, 0.08);
    const bladeMaterial = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      metalness: 0.9,
      roughness: 0.2,
    });
    this.blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    this.blade.position.y = 0.25;
    this.blade.castShadow = true;
    this.group.add(this.blade);

    // Luz del hacha
    this.light = new THREE.PointLight(0xff6600, 0.3, 5);
    this.light.position.y = 0.25;
    this.group.add(this.light);

    this.group.position.set(0.15, -0.3, -0.5);
    this.group.rotation.x = Math.PI / 4;

    return this.group;
  },

  getBladeWorldPosition() {
    const pos = new THREE.Vector3();
    this.blade.getWorldPosition(pos);
    return pos;
  },

  getBladeWorldBoundingBox() {
    const box = new THREE.Box3().setFromObject(this.blade);
    return box;
  },
};

const axeGroup = axeSystem.init();

/**  VR SETUP  */
document.body.appendChild(VRButton.createButton(renderer));

const controllerRight = renderer.xr.getController(1);
player.add(controllerRight);
controllerRight.add(axeGroup);
// Inicializar HUD en el controlador derecho
hudSystem.init(controllerRight);

const controllerModelFactory = new XRControllerModelFactory();
const gripRight = renderer.xr.getControllerGrip(1);
gripRight.add(controllerModelFactory.createControllerModel(gripRight));
player.add(gripRight);

const controllerLeft = renderer.xr.getController(0);
player.add(controllerLeft);

// Trigger para atacar
controllerRight.addEventListener("selectstart", () => {
  if (!gameState.isSwinging && gameState.isAlive) {
    audioSystem.init();
    swingAxe();
  }
});
controllerRight.addEventListener("selectstart", () => {
  if (!gameState.isAlive) {
    location.reload();
  }
});

/**  ATAQUE CON HACHA MEJORADO  */
function swingAxe() {
  audioSystem.playAxeSwing();
  gameState.isSwinging = true;
  gameState.lastSwingTime = Date.now();

  const originalRotation = {
    x: axeGroup.rotation.x,
    y: axeGroup.rotation.y,
    z: axeGroup.rotation.z,
  };

  const swingDuration = CONFIG.AXE_SWING_DURATION;
  const startTime = Date.now();
  const hitZones = [];

  function animateSwing() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / swingDuration, 1);

    // Animación más dinámica del swing
    if (progress < 0.5) {
      const swingProgress = progress * 2;
      axeGroup.rotation.x = originalRotation.x + Math.PI * swingProgress;
      axeGroup.rotation.z = Math.sin(swingProgress * Math.PI) * 0.3;
    } else {
      const returnProgress = (progress - 0.5) * 2;
      axeGroup.rotation.x =
        originalRotation.x + Math.PI - Math.PI * returnProgress;
      axeGroup.rotation.z = Math.sin((1 - returnProgress) * Math.PI) * 0.3;
    }

    // Guardar posición para detección de colisiones continua
    const bladePos = axeSystem.getBladeWorldPosition();
    hitZones.push({
      pos: bladePos.clone(),
      time: elapsed,
    });

    if (progress < 1) {
      requestAnimationFrame(animateSwing);
    } else {
      axeGroup.rotation.x = originalRotation.x;
      axeGroup.rotation.y = originalRotation.y;
      axeGroup.rotation.z = originalRotation.z;
      gameState.isSwinging = false;

      // Detección final de colisiones
      detectAxeCollisions(hitZones);
    }
  }

  animateSwing();
}

function detectAxeCollisions(hitZones) {
  if (hitZones.length === 0) return;

  const hitZombies = new Set();

  zombies.forEach((zombie) => {
    if (!zombie.isAlive) return;

    const zombiePos = zombie.mesh.position;
    let isHit = false;

    // Verificar colisión con múltiples puntos del swing
    for (const zone of hitZones) {
      const dist = zone.pos.distanceTo(zombiePos);
      if (dist < CONFIG.AXE_RANGE) {
        isHit = true;
        break;
      }
    }

    if (isHit && !hitZombies.has(zombie)) {
      hitZombies.add(zombie);
      audioSystem.playAxeHit();
      zombie.health -= CONFIG.AXE_DAMAGE;

      // Efecto visual mejorado
      const originalScale = zombie.mesh.scale.clone();
      zombie.mesh.scale.multiplyScalar(0.9);
      const originalColor = zombie.mesh.children[0].material.color.getHex();
      zombie.mesh.children[0].material.color.setHex(0xff4444);

      setTimeout(() => {
        if (zombie.mesh && zombie.isAlive) {
          zombie.mesh.scale.copy(originalScale);
          if (zombie.mesh.children[0]) {
            zombie.mesh.children[0].material.color.setHex(originalColor);
          }
        }
      }, 150);

      if (zombie.health <= 0) {
        killZombie(zombie);
      }
    }
  });
}
/**  ZOMBIES MEJORADOS  */
const zombies = [];

function createZombie(x, z) {
  const zombieGroup = new THREE.Group();

  // Cuerpo
  const bodyGeometry = new THREE.CapsuleGeometry(0.3, 1.2, 8, 16);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a6a4a,
    roughness: 0.9,
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 1;
  body.castShadow = true;
  body.receiveShadow = true;
  zombieGroup.add(body);

  // Cabeza
  const headGeometry = new THREE.SphereGeometry(0.25, 8, 8);
  const headMaterial = new THREE.MeshStandardMaterial({ color: 0x5a7a5a });
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.position.y = 1.8;
  head.castShadow = true;
  zombieGroup.add(head);

  // Ojos rojos brillantes
  const eyeGeometry = new THREE.SphereGeometry(0.06, 8, 8);
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff1111 });
  const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  leftEye.position.set(-0.1, 1.85, 0.22);
  zombieGroup.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  rightEye.position.set(0.1, 1.85, 0.22);
  zombieGroup.add(rightEye);

  // Luz roja del zombie
  const zombieLight = new THREE.PointLight(0xff2222, 1.2, 6);
  zombieLight.position.y = 1.5;
  zombieGroup.add(zombieLight);

  zombieGroup.position.set(x, 0, z);
  scene.add(zombieGroup);

  return {
    mesh: zombieGroup,
    health: CONFIG.ZOMBIE_HEALTH,
    lastAttackTime: 0,
    lastGrowlTime: 0,
    isAlive: true,
    detectionRange: 35,
    attackRange: 1.5,
  };
}

function spawnZombie() {
  if (!gameState.isAlive) return;

  const angle = Math.random() * Math.PI * 2;
  const distance = CONFIG.ZOMBIE_SPAWN_DISTANCE + Math.random() * 20;
  const x = player.position.x + Math.cos(angle) * distance;
  const z = player.position.z + Math.sin(angle) * distance;

  const r = Math.hypot(x, z);
  if (r < CONFIG.WORLD_RADIUS - 5) {
    zombies.push(createZombie(x, z));
  }
}

// Spawn inicial
for (let i = 0; i < CONFIG.ZOMBIE_COUNT; i++) {
  spawnZombie();
}

// Spawn continuo
setInterval(() => {
  if (zombies.length < CONFIG.ZOMBIE_COUNT * 2 && gameState.isAlive) {
    spawnZombie();
  }
}, 5000);

function killZombie(zombie) {
  zombie.isAlive = false;
  gameState.kills++;
  hudKills.textContent = gameState.kills;

  // Animación de muerte mejorada
  let fallProgress = 0;
  const fallInterval = setInterval(() => {
    fallProgress += 0.06;
    zombie.mesh.rotation.x = (fallProgress * Math.PI) / 2;
    zombie.mesh.position.y = Math.max(0, 1 - fallProgress);
    zombie.mesh.scale.x = Math.max(0.5, 1 - fallProgress * 0.3);

    if (fallProgress >= 1) {
      clearInterval(fallInterval);
      setTimeout(() => {
        scene.remove(zombie.mesh);
        const index = zombies.indexOf(zombie);
        if (index > -1) zombies.splice(index, 1);
      }, 2000);
    }
  }, 16);
}

/**  IA DE ZOMBIES MEJORADA  */
function updateZombies(dt) {
  if (!gameState.isAlive) return;

  const playerPos = player.position;
  const currentTime = Date.now() / 1000;

  zombies.forEach((zombie) => {
    if (!zombie.isAlive) return;

    const zombiePos = zombie.mesh.position;
    const dx = playerPos.x - zombiePos.x;
    const dz = playerPos.z - zombiePos.z;
    const distance = Math.hypot(dx, dz);

    // Sonido ocasional del zombie
    if (
      distance < zombie.detectionRange &&
      currentTime - zombie.lastGrowlTime > 3 + Math.random() * 4
    ) {
      audioSystem.playZombieGrowl();
      zombie.lastGrowlTime = currentTime;
    }

    // Perseguir al jugador
    if (distance > zombie.attackRange + 0.5) {
      const moveX = (dx / distance) * CONFIG.ZOMBIE_SPEED * dt;
      const moveZ = (dz / distance) * CONFIG.ZOMBIE_SPEED * dt;

      zombiePos.x += moveX;
      zombiePos.z += moveZ;

      // Mirar hacia el jugador
      zombie.mesh.lookAt(playerPos.x, zombiePos.y, playerPos.z);

      // Colisiones con obstáculos
      for (const obs of obstacles) {
        const obsDist = Math.hypot(zombiePos.x - obs.x, zombiePos.z - obs.z);
        const minDist = 0.5 + obs.radius;

        if (obsDist < minDist) {
          const pushDist = minDist - obsDist + 0.01;
          const pushX = (zombiePos.x - obs.x) / obsDist;
          const pushZ = (zombiePos.z - obs.z) / obsDist;
          zombiePos.x += pushX * pushDist;
          zombiePos.z += pushZ * pushDist;
        }
      }
    }
    // Atacar al jugador
    else if (
      currentTime - zombie.lastAttackTime >
      CONFIG.ZOMBIE_ATTACK_COOLDOWN
    ) {
      zombie.lastAttackTime = currentTime;
      damagePlayer(CONFIG.ZOMBIE_DAMAGE);

      // Efecto de ataque mejorado
      zombie.mesh.scale.set(1.15, 1.1, 1.15);
      setTimeout(() => {
        if (zombie.mesh && zombie.isAlive) {
          zombie.mesh.scale.set(1, 1, 1);
        }
      }, 250);
    }
  });
}
/**  MOVIMIENTO VR MEJORADO  */
function updateVRMovement(dt) {
  const session = renderer.xr.getSession();
  if (!session) return;

  for (const source of session.inputSources) {
    if (!source.gamepad) continue;

    const axes = source.gamepad.axes;
    if (axes.length < 2) continue;

    let moveX = 0,
      moveZ = 0;

    // Stick izquierdo para movimiento
    if (source.handedness === "left") {
      moveX = axes[2] || 0;
      moveZ = axes[3] || 0;
    } else if (axes[2] === undefined) {
      moveX = axes[0] || 0;
      moveZ = axes[1] || 0;
    }

    const deadzone = 0.15;
    if (Math.abs(moveX) < deadzone) moveX = 0;
    if (Math.abs(moveZ) < deadzone) moveZ = 0;

    if (moveX !== 0 || moveZ !== 0) {
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();

      const right = new THREE.Vector3();
      right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

      const newPos = player.position.clone();
      newPos.addScaledVector(forward, -moveZ * CONFIG.PLAYER_SPEED * dt);
      newPos.addScaledVector(right, moveX * CONFIG.PLAYER_SPEED * dt);

      // Límites del mundo
      const r = Math.hypot(newPos.x, newPos.z);
      if (r > CONFIG.WORLD_RADIUS - CONFIG.PLAYER_RADIUS) {
        const angle = Math.atan2(newPos.z, newPos.x);
        const maxR = CONFIG.WORLD_RADIUS - CONFIG.PLAYER_RADIUS;
        newPos.x = Math.cos(angle) * maxR;
        newPos.z = Math.sin(angle) * maxR;
      }

      // Colisiones con obstáculos
      for (const obs of obstacles) {
        const dist = Math.hypot(newPos.x - obs.x, newPos.z - obs.z);
        const minDist = CONFIG.PLAYER_RADIUS + obs.radius;

        if (dist < minDist) {
          const pushDist = minDist - dist + 0.01;
          const pushX = (newPos.x - obs.x) / dist;
          const pushZ = (newPos.z - obs.z) / dist;
          newPos.x += pushX * pushDist;
          newPos.z += pushZ * pushDist;
        }
      }

      player.position.x = newPos.x;
      player.position.z = newPos.z;
    }
  }
}

/**  SISTEMA DE DAÑO  */
function damagePlayer(damage) {
  if (!gameState.isAlive) return;

  gameState.health = Math.max(0, gameState.health - damage);
  hudHealth.textContent = gameState.health;
  hudHealthFill.style.width = `${
    (gameState.health / CONFIG.MAX_HEALTH) * 100
  }%`;

  // Sonido de daño
  audioSystem.playPlayerDamage();

  // Efecto de pantalla roja
  const originalColor = scene.background.getHex();
  scene.background.set(0x440000);
  setTimeout(() => {
    if (gameState.isAlive) {
      scene.background.set(originalColor);
    }
  }, 200);

  if (gameState.health <= 0) {
    gameOver();
  }
}

/**  GAME OVER  */
function gameOver() {
  gameState.isAlive = false;
  audioSystem.playGameOver();

  const survivalTime = Math.floor((Date.now() - gameState.startTime) / 1000);
  
  // Mostrar Game Over en VR
  hudSystem.showGameOver(gameState.kills, survivalTime);
}

/**  ACTUALIZAR TIEMPO  */
function updateGameTime() {
  if (!gameState.isAlive) return;

  const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
  gameState.gameTime = elapsed;
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  hudTime.textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**  LOOP PRINCIPAL  */
const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);

  if (renderer.xr.isPresenting) {
    updateVRMovement(dt);
  }
  hudSystem.update(gameState.health, gameState.kills, gameState.gameTime);
  updateZombies(dt);
  updateGameTime();
  skySystem.update(gameState.gameTime);

  renderer.render(scene, camera);
});

/**  RESIZE  */
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});