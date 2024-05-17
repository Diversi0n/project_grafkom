import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Octree } from 'three/addons/math/Octree.js';
import { Capsule } from 'three/addons/math/Capsule.js';

//INIT===============================================

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.rotation.order = 'YXZ';

const container = document.getElementById('container');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
container.appendChild(renderer.domElement);

window.addEventListener('resize', onWindowResize);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

const clock = new THREE.Clock();
const GRAVITY = 30;
const STEPS_PER_FRAME = 1;

const worldOctree = new Octree();
let carOctree = new Octree();

const playerCollider = new Capsule(new THREE.Vector3(-9, 0.8, 5), new THREE.Vector3(-9, 1.2, 5), 0.8);

const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();

let playerOnFloor = false;
let mouseTime = 0;

const keyStates = {};

document.addEventListener('keydown', (event) => {
    keyStates[event.code] = true;
});

document.addEventListener('keyup', (event) => {
    keyStates[event.code] = false;
});

container.addEventListener('mousedown', () => {
    document.body.requestPointerLock();
    mouseTime = performance.now();
});

document.body.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement === document.body) {
        camera.rotation.y -= event.movementX / 1000;
        camera.rotation.x -= event.movementY / 1000;
    }
});

function playerCollisions() {
    const result = worldOctree.capsuleIntersect(playerCollider);
    const result2 = carOctree.capsuleIntersect(playerCollider);

    playerOnFloor = false;

    if (result) {
        playerOnFloor = result.normal.y > 0;

        if (!playerOnFloor) {
            playerVelocity.addScaledVector(result.normal, -result.normal.dot(playerVelocity));
        }

        playerCollider.translate(result.normal.multiplyScalar(result.depth));
    }

    if (result2) playerCollider.translate(result2.normal.multiplyScalar(result2.depth));
}

function getPlayerDirection(objectCollider, playerCollider) {
    const carCenter = objectCollider.getCenter(new THREE.Vector3());
    const playerCenter = playerCollider.getCenter(new THREE.Vector3());

    return carCenter.sub(playerCenter).normalize();
}

let automaticRiding = false;
let ridingCar = false;
let ridingTimer = 0;

function updatePlayer(deltaTime) {
    let damping = Math.exp(-4 * deltaTime) - 1;

    if (!playerOnFloor) {
        playerVelocity.y -= GRAVITY * deltaTime;
        damping *= 0.1;
    }

    playerVelocity.addScaledVector(playerVelocity, damping);

    const deltaPosition = playerVelocity.clone().multiplyScalar(deltaTime);
    playerCollider.translate(deltaPosition);

    playerCollisions();

    if (!ridingCar) camera.position.copy(playerCollider.end);

    if (ridingTimer != 0) {
        ridingTimer++;
        if (ridingTimer == 100) ridingTimer = 0;
    }

    if (keyStates['KeyT'] && ridingTimer == 0) {
        automaticRiding = !automaticRiding;
        ridingTimer++;
        if (automaticRiding) {
            carOctree = new Octree();
        } else {
            carOctree = new Octree();
            carOctree.fromGraphNode(car);
        }
    }

    if ((keyStates['KeyF'] || keyStates['Space']) && ridingCar && ridingTimer == 0) {
        teleportPlayerToRightSide(car, 2)
        carOctree = new Octree();
        carOctree.fromGraphNode(car);
        ridingCar = false;
        ridingTimer++;
    } else if (carCapsule && carCapsule.collider && isPlayerAroundObject(carCapsule.collider, playerCollider, 6) && keyStates['KeyF'] && !ridingCar && ridingTimer == 0) {
        ridingCar = true;
        ridingTimer++;
    }
}

function getForwardVector() {
    camera.getWorldDirection(playerDirection);
    playerDirection.y = 0;
    playerDirection.normalize();
    return playerDirection;
}

function getSideVector() {
    camera.getWorldDirection(playerDirection);
    playerDirection.y = 0;
    playerDirection.normalize();
    playerDirection.cross(camera.up);
    return playerDirection;
}

function controls(deltaTime) {
    const speedDelta = deltaTime * (playerOnFloor ? 25 : 8);

    if (keyStates['KeyW']) {
        playerVelocity.add(getForwardVector().multiplyScalar(speedDelta));
    }

    if (keyStates['KeyS']) {
        playerVelocity.add(getForwardVector().multiplyScalar(-speedDelta));
    }

    if (keyStates['KeyA']) {
        playerVelocity.add(getSideVector().multiplyScalar(-speedDelta));
    }

    if (keyStates['KeyD']) {
        playerVelocity.add(getSideVector().multiplyScalar(speedDelta));
    }

    if (playerOnFloor) {
        if (keyStates['Space']) {
            playerVelocity.y = 10;
        }
    }
}

function teleportPlayerIfOob() {
    if (camera.position.y <= -25) {
        playerCollider.start.set(-9, 0.8, 5);
        playerCollider.end.set(-9, 1.2, 5);
        playerCollider.radius = 0.8;
        camera.position.copy(playerCollider.end);
        camera.rotation.set(0, 0, 0);
    }
}

const loader = new GLTFLoader();

let road, car, krustykrab, building1,building2, sun, moon;
let carCapsule;
let mixer_squidward, mixer_mrkrab, mixer_patrick, mixer_plankton;
let rumahnpc = [];
let lamp = [];
let lampCollider = [];

//Building 1================
loader.load( '/Building/venice_building.glb', function ( gltf ) {
    building1 = gltf.scene;
    building1.position.set(-25, -5, -40);
    building1.scale.set(3.5, 3.5, 3.5);
    building1.rotation.set(0, -0.8, 0);
    building1.traverse((node) => {
        if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
        }
    });
	scene.add( building1 );
    worldOctree.fromGraphNode( building1 );
});
//Building 2================
loader.load( '/Building/venice_building.glb', function ( gltf ) {
    building2 = gltf.scene;
    building2.position.set(0, -5, -40);
    building2.scale.set(3.5, 3.5, 3.5);
    building2.rotation.set(0, 0, 0);
    building2.traverse((node) => {
        if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
        }
    });
	scene.add( building2 );
    worldOctree.fromGraphNode( building2 );
});

// SUN
loader.load('/sun/sun.glb', function (gltf) {
    sun = gltf.scene;
    sun.position.set(350, 350, -10);
    sun.scale.set(0.1, 0.1, 0.1);
    scene.add(sun);
});

// MOON
loader.load('/moon/moon.glb', function (gltf) {
    moon = gltf.scene;
    moon.position.set(-350, -350, -10);
    scene.add(moon);
});

// FLOOR
//FLOOR======================
const floorSize = 200; // Size of the visible floor
const tileSize = 10; // Size of each tile
const numTiles = Math.ceil(floorSize / tileSize); // Number of tiles per side

// Create a larger plane to tile the floor texture
const floorGeometry = new THREE.PlaneGeometry(tileSize * numTiles, tileSize * numTiles, numTiles, numTiles);
const floorMaterial = new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: true });

// Apply a repeating texture to the floor material
const floorLoader = new THREE.TextureLoader();
const floorTexture = floorLoader.load('/Floor/tile.jpg'); // Replace 'floor_texture.jpg' with the path to your desired floor texture
floorTexture.wrapS = THREE.RepeatWrapping;
floorTexture.wrapT = THREE.RepeatWrapping;
floorTexture.repeat.set(numTiles, numTiles);
floorMaterial.map = floorTexture;

const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
floorMesh.rotation.x = - Math.PI / 2;
floorMesh.receiveShadow = true;
floorMesh.castShadow = true;
scene.add(floorMesh);

worldOctree.fromGraphNode(floorMesh);

// BACKGROUND
const backgroundGeometry = new THREE.SphereGeometry(500, 32, 32);

const backgroundTextureLoader = new THREE.TextureLoader();
const backgroundTexture = backgroundTextureLoader.load('/Background/ascentmap.jpg', (texture) => {
    texture.encoding = THREE.sRGBEncoding;
});

const backgroundMaterial = new THREE.MeshBasicMaterial({
    map: backgroundTexture,
    side: THREE.BackSide
});

const backgroundMesh = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
backgroundMesh.position.set(0, 0, 0);
scene.add(backgroundMesh);

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;

scene.background = new THREE.Color(0xa0a0a0);

// LIGHTING
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7.5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
scene.add(directionalLight);

let frameCount = 0;

function animate() {
    requestAnimationFrame(animate);

    const deltaTime = Math.min(0.05, clock.getDelta() * 1.15) / STEPS_PER_FRAME;

    for (let i = 0; i < STEPS_PER_FRAME; i++) {
        controls(deltaTime);
        updatePlayer(deltaTime);
        teleportPlayerIfOob();
    }

    renderer.render(scene, camera);
}

animate();
