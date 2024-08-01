import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DragControls } from 'three/examples/jsm/controls/DragControls.js';

let scene, camera, renderer, cube, controls, raycaster, mouse;
let initialGeometry, initialMaterials;
let removedFaceIndices = [];
let removedFaceData = [];
let hierarchyScene, hierarchyCamera, hierarchyRenderer, hierarchyCube;
let isDragging = false;
let dragOffset = new THREE.Vector3();
let faceColors = [0xff0000, 0x00ff00, 0x0000ff];
let handles = [], dragControls;
let initialHandlePositions = [];

const transparentMaterial = new THREE.MeshPhongMaterial({ 
    color: 0xffffff, 
    transparent: true, 
    opacity: 0 
});

function initThreeJS() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, (window.innerWidth - 350) / (window.innerHeight - 50), 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('threeCanvas'), antialias: true });
    renderer.setSize(window.innerWidth - 350, window.innerHeight - 50);
    renderer.setClearColor(0xffffff);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight1.position.set(1, 1, 1.5);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight2.position.set(-1, -1, -1);
    scene.add(directionalLight2);

    camera.position.z = 5;
    controls = new OrbitControls(camera, renderer.domElement);
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    updateCubeDimensionsDisplay();

    renderer.domElement.addEventListener('click', onSingleClick, false);

    animate();
}

function initHierarchy() {
    hierarchyScene = new THREE.Scene();
    hierarchyCamera = new THREE.PerspectiveCamera(75, 200 / 150, 0.1, 1000);
    hierarchyRenderer = new THREE.WebGLRenderer({ canvas: document.getElementById('hierarchyCanvas'), antialias: true, alpha: true });
    hierarchyRenderer.setSize(200, 150);
    hierarchyRenderer.setClearColor(0x000000, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    hierarchyScene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight1.position.set(1, 1, 1);
    hierarchyScene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight2.position.set(-1, -1, -1);
    hierarchyScene.add(directionalLight2);

    hierarchyCamera.position.z = 5;

    const geometry = new THREE.BoxGeometry(3 * 0.3048, 4 * 0.3048, 1 * 0.3048);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    hierarchyCube = new THREE.Mesh(geometry, material);
    hierarchyCube.name = 'hierarchyCube';
    hierarchyScene.add(hierarchyCube);

    makeHierarchyCubeDraggable();
    animateHierarchy();
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

function animateHierarchy() {
    requestAnimationFrame(animateHierarchy);
    hierarchyRenderer.render(hierarchyScene, hierarchyCamera);
}

function showDialog() {
    document.getElementById('dialog').style.display = 'block';
}

function submitDimensions() {
    const length = parseFloat(document.getElementById('length').value);
    const breadth = parseFloat(document.getElementById('breadth').value);
    const height = parseFloat(document.getElementById('height').value);

    if (length && breadth && height !== undefined) {
        document.getElementById('dialog').style.display = 'none';
        createGeometry(length, breadth, height);
    } else {
        alert('Please enter all dimensions');
    }
}

function createGeometry(length, breadth, height) {
    if (cube) {
        scene.remove(cube);
    }

    const outerThickness = 9 * 0.0254; // Converted to meters

    // Calculate the inner dimensions of the cube
    const innerLength = length - 2 * outerThickness;
    const innerBreadth = breadth - 2 * outerThickness;
    const innerHeight = height - 2 * outerThickness;

    let materials = [];
    const colors = [
        faceColors[0], // Front
        faceColors[0], // Back
        faceColors[1], // Top
        faceColors[1], // Bottom
        faceColors[2], // Left
        faceColors[2]  // Right
    ];

    for (let i = 0; i < 6; i++) {
        materials.push(new THREE.MeshPhongMaterial({ color: colors[i], side: THREE.DoubleSide }));
    }

    const newGeometry = new THREE.BoxGeometry(innerLength, innerHeight, innerBreadth);

    cube = new THREE.Mesh(newGeometry, materials);
    scene.add(cube);

    // Create the outer box's geometry with the original input dimensions
    const outerBoxGeometry = new THREE.BoxGeometry(length, height, breadth);
    const outerMaterials = [];
    for (let i = 0; i < 6; i++) {
        outerMaterials.push(new THREE.MeshPhongMaterial({
            color: colors[i],
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        }));
    }

    const outerBox = new THREE.Mesh(outerBoxGeometry, outerMaterials);
    outerBox.name = 'outerBox';
    scene.add(outerBox);

    const maxDimension = Math.max(length, height, breadth);
    camera.position.set(maxDimension * 2, maxDimension * 2, maxDimension * 2);
    camera.lookAt(scene.position);
    controls.target.set(0, 0, 0);

    // Store initial geometry and materials for resetting and undoing
    initialGeometry = newGeometry.clone();
    initialMaterials = materials.map(m => m.clone());

    // Add handles for resizing
    addResizeHandles(innerLength, innerHeight, innerBreadth);

    console.log(`Geometry created with dimensions: Length = ${length}ft, Breadth = ${breadth}ft, Height = ${height}ft`);

    updateCubeDimensionsDisplay();
}

function addResizeHandles(length, height, breadth) {
    handles.forEach(handle => scene.remove(handle));
    handles = [];
    initialHandlePositions = [];

    const handleGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const handleMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });

    const positions = [
        [length / 2, height / 2, breadth / 2],
        [length / 2, height / 2, -breadth / 2],
        [-length / 2, height / 2, breadth / 2],
        [-length / 2, height / 2, -breadth / 2],
        [length / 2, -height / 2, breadth / 2],
        [length / 2, -height / 2, -breadth / 2],
        [-length / 2, -height / 2, breadth / 2],
        [-length / 2, -height / 2, -breadth / 2],
    ];

    positions.forEach(position => {
        const handle = new THREE.Mesh(handleGeometry, handleMaterial);
        handle.position.set(position[0], position[1], position[2]);
        scene.add(handle);
        handles.push(handle);
        initialHandlePositions.push(new THREE.Vector3().copy(handle.position));
    });

    dragControls = new DragControls(handles, camera, renderer.domElement);
    dragControls.addEventListener('drag', onDrag);
    dragControls.addEventListener('dragstart', onDragStart);
    dragControls.addEventListener('dragend', onDragEnd);
}

function updateGeometry(length, height, breadth) {
    const outerThickness = 9 * 0.0254; // Converted to meters
    const innerLength = length - 2 * outerThickness;
    const innerHeight = height - 2 * outerThickness;
    const innerBreadth = breadth - 2 * outerThickness;

    // Update inner cube
    cube.geometry.dispose();
    cube.geometry = new THREE.BoxGeometry(innerLength, innerHeight, innerBreadth);

    // Update outer box
    const outerBox = scene.getObjectByName('outerBox');
    if (outerBox) {
        outerBox.geometry.dispose();
        outerBox.geometry = new THREE.BoxGeometry(length, height, breadth);
    }
}

function updateHandlePositions(length, height, breadth) {
    const positions = [
        [length / 2, height / 2, breadth / 2],
        [length / 2, height / 2, -breadth / 2],
        [-length / 2, height / 2, breadth / 2],
        [-length / 2, height / 2, -breadth / 2],
        [length / 2, -height / 2, breadth / 2],
        [length / 2, -height / 2, -breadth / 2],
        [-length / 2, -height / 2, breadth / 2],
        [-length / 2, -height / 2, -breadth / 2],
    ];

    handles.forEach((handle, index) => {
        handle.position.set(...positions[index]);
    });
}


function onDrag(event) {
    if (isDragging) {
        const handle = event.object;
        const handleIndex = handles.indexOf(handle);
        const initialPosition = initialHandlePositions[handleIndex];

        // Calculate the displacement from the initial position
        const displacement = new THREE.Vector3().subVectors(handle.position, initialPosition);

        // Determine which dimension is being changed
        let dimensionIndex;
        if (Math.abs(displacement.x) > Math.abs(displacement.y) && Math.abs(displacement.x) > Math.abs(displacement.z)) {
            dimensionIndex = 0; // X-axis (length)
        } else if (Math.abs(displacement.y) > Math.abs(displacement.z)) {
            dimensionIndex = 1; // Y-axis (height)
        } else {
            dimensionIndex = 2; // Z-axis (breadth)
        }

        // Get current dimensions
        let dimensions = [
            Math.abs(handles[0].position.x - handles[6].position.x),
            Math.abs(handles[0].position.y - handles[6].position.y),
            Math.abs(handles[0].position.z - handles[6].position.z)
        ];

        // Update the dimension based on the displacement
        dimensions[dimensionIndex] += 2 * displacement[['x', 'y', 'z'][dimensionIndex]];

        // Ensure minimum size
        dimensions = dimensions.map(d => Math.max(d, 0.1));

        // Update cube and outer box
        updateGeometry(dimensions[0], dimensions[1], dimensions[2]);

        // Update handle positions
        updateHandlePositions(dimensions[0], dimensions[1], dimensions[2]);

        updateCubeDimensionsDisplay();
    }
}


function onDragStart(event) {
    isDragging = true;
    controls.enabled = false;
    dragOffset.copy(event.object.position).sub(raycaster.ray.origin);
}

function onDragEnd() {
    isDragging = false;
    controls.enabled = true;
    // Update initial positions after drag
    initialHandlePositions = handles.map(handle => new THREE.Vector3().copy(handle.position));
}


function resetGeometry() {
    if (initialGeometry && initialMaterials) {
        // Remove the current cube from the scene
        if (cube) {
            scene.remove(cube);
        }

        // Recreate the cube with the initial geometry and materials
        cube = new THREE.Mesh(initialGeometry.clone(), initialMaterials.map(m => m.clone()));
        scene.add(cube);

        // Remove the current outer box from the scene
        const outerBox = scene.getObjectByName('outerBox');
        if (outerBox) {
            scene.remove(outerBox);
        }

        // Extract dimensions from initial geometry parameters
        const length = initialGeometry.parameters.width;
        const height = initialGeometry.parameters.height;
        const breadth = initialGeometry.parameters.depth;

        // Calculate the outer dimensions with thickness
        const outerThickness = 9 * 0.0254; // Converted to meters
        const outerLength = length + 2 * outerThickness;
        const outerHeight = height + 2 * outerThickness;
        const outerBreadth = breadth + 2 * outerThickness;

        // Create the outer box geometry with the original dimensions including thickness
        const outerBoxGeometry = new THREE.BoxGeometry(outerLength, outerHeight, outerBreadth);
        const outerMaterials = [];
        for (let i = 0; i < 6; i++) {
            outerMaterials.push(new THREE.MeshPhongMaterial({
                color: faceColors[i],
                transparent: true,
                opacity: 0.3,
                side: THREE.DoubleSide
            }));
        }

        // Create the new outer box and add it to the scene
        const newOuterBox = new THREE.Mesh(outerBoxGeometry, outerMaterials);
        newOuterBox.name = 'outerBox';
        scene.add(newOuterBox);

        // Re-add handles
        addResizeHandles(length, height, breadth);

        // Reset the removed face data
        removedFaceIndices = [];
        removedFaceData = [];

        // Update the camera and controls to fit the reset cube
        const maxDimension = Math.max(outerLength, outerHeight, outerBreadth);
        camera.position.set(maxDimension * 2, maxDimension * 2, maxDimension * 2);
        camera.lookAt(scene.position);
        controls.target.set(0, 0, 0);

        console.log('Geometry reset to initial state');
    }
}


// Example of how to undo the removal of a face
function undoRemoveFace() {
    if (removedFaceData.length === 0) {
        console.log('No face to undo');
        return;
    }

    const lastRemovedFace = removedFaceData.pop();
    const faceIndex = lastRemovedFace.index;
    const originalMaterial = lastRemovedFace.material;

    // Restore the face material
    cube.material[faceIndex] = originalMaterial;



    // Restore the outer box material
    const outerBox = scene.getObjectByName('outerBox');
    outerBox.material[faceIndex] = new THREE.MeshPhongMaterial({
        color: faceColors[faceIndex % faceColors.length],
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
    });

    removedFaceIndices.pop();

    console.log(`Face at index ${faceIndex} restored`);
}
function updateCubeDimensionsDisplay() 
{
    const cubeDimensions = document.getElementById('cubeDimensions');
    if (cube && cube.geometry) 
        {
        cubeDimensions.innerHTML = `
            <div>Length: ${(cube.geometry.parameters.width).toFixed(2)} ft</div>
            <div>Breadth: ${(cube.geometry.parameters.depth).toFixed(2)} ft</div>
            <div>Height: ${(cube.geometry.parameters.height).toFixed(2)} ft</div>
        `;
    } else {
        cubeDimensions.innerHTML = 'No cube created yet.';
    }
}

function makeHierarchyCubeDraggable() {
    hierarchyCube.userData.draggable = true;

    const hierarchyDragControls = new DragControls([hierarchyCube], hierarchyCamera, hierarchyRenderer.domElement);
    hierarchyDragControls.addEventListener('dragstart', event => {
        controls.enabled = false;
    });
    hierarchyDragControls.addEventListener('dragend', event => {
        controls.enabled = true;
        
    });
}

function onSingleClick(event) {
    if (!cube) return;

    mouse.x = ((event.clientX - renderer.domElement.offsetLeft) / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = -((event.clientY - renderer.domElement.offsetTop) / renderer.domElement.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(cube);
    const outerBox = scene.getObjectByName('outerBox');

    if (intersects.length > 0) {
        const intersectedFace = intersects[0].face;
        const faceIndex = intersectedFace.materialIndex;

        if (removedFaceIndices.includes(faceIndex)) return;


        // Store the original material
        const originalMaterial = cube.material[faceIndex];
        removedFaceData.push({ index: faceIndex, material: originalMaterial });

        // Set the material of the clicked face to the transparent material
        cube.material[faceIndex] = transparentMaterial;
        outerBox.material[faceIndex] = transparentMaterial;

        removedFaceIndices.push(faceIndex);

        console.log(`Face at index ${faceIndex} removed`);
    }
}
window.addEventListener('keydown', function(event) {
    if (event.ctrlKey && event.key === 'z') {
        undoRemoveFace();
    }
});

document.getElementById('createButton').addEventListener('click', showDialog);
document.getElementById('submitButton').addEventListener('click', submitDimensions);
document.getElementById('resetButton').addEventListener('click', resetGeometry);

initThreeJS();
initHierarchy();