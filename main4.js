/**  RENDERER & SCENE  */
const canvas = document.getElementById("scene");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

renderer.xr.enabled = true;

// MÁS BRILLO GLOBAL
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 2.2;

const scene = new THREE.Scene();

// Fondo más claro
scene.background = new THREE.Color(0x404050);

// Menos niebla oscura
scene.fog = new THREE.FogExp2(0x404050, 0.006);

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

/**  CIELO DINÁMICO BRILLANTE  */
const skySystem = {
  moonLight: null,
  moon: null,
  stars: null,

  init() {

    // LUZ PRINCIPAL MUCHO MÁS FUERTE
    this.moonLight = new THREE.DirectionalLight(
      0xffffff,
      2.8
    );

    this.moonLight.castShadow = true;

    this.moonLight.shadow.mapSize.set(2048, 2048);

    this.moonLight.shadow.camera.left = -100;
    this.moonLight.shadow.camera.right = 100;
    this.moonLight.shadow.camera.top = 100;
    this.moonLight.shadow.camera.bottom = -100;

    scene.add(this.moonLight);

    // LUNA
    const moonGeometry = new THREE.SphereGeometry(
      15,
      32,
      32
    );

    const moonMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffee,
    });

    this.moon = new THREE.Mesh(
      moonGeometry,
      moonMaterial
    );

    scene.add(this.moon);

    // ESTRELLAS
    const starGeometry = new THREE.BufferGeometry();

    const starCount = 5000;

    const starPositions = new Float32Array(
      starCount * 3
    );

    for (let i = 0; i < starCount * 3; i += 3) {

      const r = 300 + Math.random() * 200;

      const theta = Math.random() * Math.PI * 2;

      const phi = Math.acos(2 * Math.random() - 1);

      starPositions[i] =
        r * Math.sin(phi) * Math.cos(theta);

      starPositions[i + 1] =
        r * Math.cos(phi);

      starPositions[i + 2] =
        r * Math.sin(phi) * Math.sin(theta);
    }

    starGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        starPositions,
        3
      )
    );

    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.5,
      transparent: true,
      opacity: 0.8,
    });

    this.stars = new THREE.Points(
      starGeometry,
      starMaterial
    );

    scene.add(this.stars);

    // LUZ AMBIENTAL MUCHO MÁS BRILLANTE
    const ambientLight = new THREE.AmbientLight(
      0xffffff,
      2.0
    );

    scene.add(ambientLight);

    // LUZ EXTRA GENERAL
    const hemiLight = new THREE.HemisphereLight(
      0xffffff,
      0x444444,
      1.8
    );

    hemiLight.position.set(0, 100, 0);

    scene.add(hemiLight);
  },

  update(gameTime) {

    if (!this.moon || !this.moonLight) return;

    // Movimiento de la luna
    const moonOrbitRadius = 150;

    const moonSpeed = 0.0001;

    const moonAngle = gameTime * moonSpeed;

    this.moon.position.x =
      Math.cos(moonAngle) * moonOrbitRadius;

    this.moon.position.y =
      80 + Math.sin(moonAngle * 0.5) * 30;

    this.moon.position.z =
      Math.sin(moonAngle) * moonOrbitRadius;

    // La luz sigue la luna
    this.moonLight.position.copy(
      this.moon.position
    );

    this.moonLight.position.multiplyScalar(0.8);
  },
};

skySystem.init();