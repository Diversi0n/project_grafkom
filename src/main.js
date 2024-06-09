import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Octree } from 'three/addons/math/Octree.js';
import { Capsule } from 'three/addons/math/Capsule.js';

// INIT===============================================

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
const STEPS_PER_FRAME = 2;  // Increase steps per frame for smoother physics

const worldOctree = new Octree();
let carOctree = new Octree();

const playerCollider = new Capsule(new THREE.Vector3(-9, 0.8, 5), new THREE.Vector3(-9, 1.2, 5), 0.8);

const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();

let playerOnFloor = false;
let mouseTime = 0;
const keyStates = {};

let knife, kar98k;
let currentWeapon = 'knife';

const loader = new GLTFLoader();
loader.load('/Knife/karambit.glb', (gltf) => {
    knife = gltf.scene;
    knife.scale.set(0.1, 0.1, 0.1);
    knife.position.set(0.5, -0.5, -1);
    knife.rotation.set(4.5, Math.PI, -21);

    knife.userData.initialPosition = knife.position.clone();
    knife.userData.initialRotation = knife.rotation.clone();

    knife.traverse((node) => {
        if (node.isMesh) {
            node.renderOrder = 9999;
            node.material.depthTest = false;
        }
    });

    camera.add(knife);
    scene.add(camera);
}, undefined, (error) => {
    console.error('Error loading knife:', error);
});

loader.load('/Gun/kar98k.glb', (gltf) => {
    kar98k = gltf.scene;
    kar98k.scale.set(0.4, 0.4, 0.4);
    kar98k.position.set(0.5, -0.5, -1);
    kar98k.rotation.set(0, Math.PI / 2, 0);

    kar98k.userData.initialPosition = kar98k.position.clone();
    kar98k.userData.initialRotation = kar98k.rotation.clone();

    kar98k.traverse((node) => {
        if (node.isMesh) {
            if (node.material.map) {
                node.material.map.encoding = THREE.sRGBEncoding;
            }
            node.material.needsUpdate = true;
        }
    });

    camera.add(kar98k);
    kar98k.visible = false; // Initially hide the gun
}, undefined, (error) => {
    console.error('Error loading gun:', error);
});


document.addEventListener('keydown', (event) => {
    keyStates[event.code] = true;

    if (event.code === 'KeyE' && !isWeaponSwitching) {
        toggleWeapon();
    }
});

document.addEventListener('keyup', (event) => {
    keyStates[event.code] = false;
});

container.addEventListener('click', (event) => {
    if (document.pointerLockElement !== document.body) {
        document.body.requestPointerLock();
    }
});

document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === document.body) {
        document.addEventListener('mousedown', onDocumentMouseDown);
    } else {
        document.removeEventListener('mousedown', onDocumentMouseDown);
    }
});

function onDocumentMouseDown(event) {
    if (event.button === 0) {
        mouseTime = performance.now();
        startSpin();
    }
}

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

    camera.position.copy(playerCollider.end);
    camera.position.y += 0.6;
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

let building1, building2, building3, building4, chamber, longwall1, longwall2, longwall3, longwall4;
let mixer_chamber;
let rumahnpc = [];
let lamp = [];
let lampCollider = [];

// Building 1================
loader.load('/Building/building1.glb', function (gltf) {
    building1 = gltf.scene;
    building1.position.set(-16, 0, -13);
    building1.scale.set(2, 2, 2);
    building1.rotation.set(0, 0, 0);
    building1.traverse((node) => {
        if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
        }
    });
    scene.add(building1);
    worldOctree.fromGraphNode(building1);
});

// Building 2================
loader.load('/Building/building1.glb', function (gltf) {
    building2 = gltf.scene;
    building2.position.set(-16, 0, -5);
    building2.scale.set(2, 2, 2);
    building2.rotation.set(0, 0, 0);
    building2.traverse((node) => {
        if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
        }
    });
    scene.add(building2);
    worldOctree.fromGraphNode(building2);
});

// Building 3================
loader.load('/Building/building2.glb', function (gltf) {
    building3 = gltf.scene;
    building3.position.set(-15.5, 0, -17);
    building3.scale.set(2.1, 2.1, 2.1);
    building3.rotation.set(0, 0, 0);
    building3.traverse((node) => {
        if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
        }
    });
    scene.add(building3);
    worldOctree.fromGraphNode(building3);
});

// Building 4================
loader.load('/Building/house_valo.glb', function (gltf) {
    building4 = gltf.scene;
    building4.position.set(-16, -0.2, 15);
    building4.scale.set(1, 1, 1);
    building4.rotation.set(0, 0, 0);
    building4.traverse((node) => {
        if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
        }
    });
    scene.add(building4);
    worldOctree.fromGraphNode(building4);
});

//longwall1 =========================
loader.load( '/Wall/longwall.glb', function ( gltf ) {
    longwall1 = gltf.scene;
    longwall1.scale.set(2, 2, 2);
    longwall1.rotation.set(0, 0, 0);
    longwall1.position.set(-10, 0, -24.7);
    longwall1.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
    });

	scene.add( longwall1 );
    worldOctree.fromGraphNode( longwall1 )
});

//longwall2 =========================
loader.load( '/Wall/longwall.glb', function ( gltf ) {
    longwall2 = gltf.scene;
    longwall2.scale.set(2, 2, 2);
    longwall2.rotation.set(0, Math.PI / 2, 0);
    longwall2.position.set(-24.5, 0, -6);
    longwall2.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
    });

	scene.add( longwall2 );
    worldOctree.fromGraphNode( longwall2 )
});

//longwall3 =========================
loader.load( '/Wall/longwall.glb', function ( gltf ) {
    longwall3 = gltf.scene;
    longwall3.scale.set(2, 2, 2);
    longwall3.rotation.set(0, 90 * (Math.PI / 180), 0);
    longwall3.position.set(-24.3, 0, 6.3);
    longwall3.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
    });

	scene.add( longwall3 );
    worldOctree.fromGraphNode( longwall3 )
});

//longwall1 =========================
loader.load( '/Wall/longwall.glb', function ( gltf ) {
    longwall4 = gltf.scene;
    longwall4.scale.set(2, 2, 2);
    longwall4.rotation.set(0, -1 * (Math.PI / 180), 0);
    longwall4.position.set(-10, 0, 25);
    longwall4.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
    });

	scene.add( longwall4 );
    worldOctree.fromGraphNode( longwall4 )
});

//chamber =========================
loader.load( '/Agent/cham.glb', function ( gltf ) {
    chamber = gltf.scene;
    chamber.scale.set(1.1, 1.1, 1.1);
    chamber.rotation.set(0, 0, 0);
    chamber.position.set(0, 0, -20);
    chamber.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
    });

	scene.add( chamber );
    worldOctree.fromGraphNode( chamber )

    // Create an AnimationMixer and pass in the model's animations
    mixer_chamber = new THREE.AnimationMixer(chamber);
    console.log('GLTF Animations: ', gltf.animations[0]);
    // Play the first animation in the model's animation array
    const action = mixer_chamber.clipAction(gltf.animations[0]);
    action.play();
});

// FLOOR======================
const floorSize = 50;
const tileSize = 10;
const numTiles = Math.ceil(floorSize / tileSize);

const floorGeometry = new THREE.PlaneGeometry(tileSize * numTiles, tileSize * numTiles, numTiles, numTiles);
const floorMaterial = new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: true });

const floorLoader = new THREE.TextureLoader();
const floorTexture = floorLoader.load('/Floor/tile.jpg');
floorTexture.wrapS = THREE.RepeatWrapping;
floorTexture.wrapT = THREE.RepeatWrapping;
floorTexture.repeat.set(numTiles, numTiles);
floorMaterial.map = floorTexture;

const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
floorMesh.rotation.x = -Math.PI / 2;
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
const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7.5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 512;  // Reduced shadow map size
directionalLight.shadow.mapSize.height = 512; // Reduced shadow map size
scene.add(directionalLight);

// Animation variables
let isSpinning = false;
let spinStartTime = 0;
const spinDuration = 500;
let isWeaponSwitching = false;

function startSpin() {
    if (!isSpinning) {
        isSpinning = true;
        spinStartTime = performance.now();
    }
}

function handleSpin() {
    if (isSpinning) {
        const elapsedTime = performance.now() - spinStartTime;
        if (elapsedTime < spinDuration) {
            const spinAngle = (elapsedTime / spinDuration) * Math.PI * 2;
            const twistAngle = Math.sin((elapsedTime / spinDuration) * Math.PI * 4) * 0.2;
            const spinKar = (elapsedTime / spinDuration) * Math.PI * 2;
            if (currentWeapon === 'knife') {
                knife.rotation.y = spinAngle;
                knife.rotation.z = twistAngle;
            } else {
                kar98k.rotation.x = spinKar;
            }
        } else {
            isSpinning = false;
            if (currentWeapon === 'knife') {
                knife.rotation.copy(knife.userData.initialRotation);
            } else {
                kar98k.rotation.copy(kar98k.userData.initialRotation);
            }
            isWeaponSwitching = false; // Allow weapon switching again
        }
    }
}

function preventKnifeClipping() {
    if (knife.position.y <= -1.5) {
        knife.position.copy(knife.userData.initialPosition);
    }
}

function preventGunClipping() {
    if (kar98k.position.y <= -1.5) {
        kar98k.position.copy(kar98k.userData.initialPosition);
    }
}

function toggleWeapon() {
    if (knife && kar98k && !isWeaponSwitching) {
        isWeaponSwitching = true;
        startSpin(); // Start the spin animation
        if (currentWeapon === 'knife') {
            knife.visible = false;
            kar98k.visible = true;
            currentWeapon = 'kar98k';
        } else {
            knife.visible = true;
            kar98k.visible = false;
            currentWeapon = 'knife';
        }
    }
}

function animate() {
    requestAnimationFrame(animate);

    const deltaTime = Math.min(0.05, clock.getDelta() * 1.15) / STEPS_PER_FRAME;

    for (let i = 0; i < STEPS_PER_FRAME; i++) {
        controls(deltaTime);
        updatePlayer(deltaTime);
        teleportPlayerIfOob();
    }

    handleSpin();
    preventKnifeClipping();
    preventGunClipping();  // Add this line

    // Update the mixer if it's defined
    if (mixer_chamber) {
        mixer_chamber.update(deltaTime);
    }

    renderer.render(scene, camera);
}

animate();
