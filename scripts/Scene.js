var scene, camera, renderer, controls;

(function createScene() {
    renderer = new THREE.WebGLRenderer();
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.shadowMap.enabled = true;
    renderer.shadowMapSoft = true;

    scene = new THREE.Scene();
    scene.background = new THREE.Color( 'skyblue' );

    camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.2, 25000);
    camera.position.z = 1000;

    controls = new THREE.OrbitControls( camera, document.getElementById("scene-container"));
})()