var app = {
        gui: null,
        controls: null,
        textureMap: null,
        skyboxMap: null,
        shaderMap: null,
        renderer: null,
        camera: null,
        scene: null,
        light: null,
        skyboxScene: null,
        meshes: null,
        selectedShape: null
    };

async function init() {
    app.textures = new Textures();
    var textures =  await app.textures.populate();
    app.textureMap = textures.textureMap;
    app.skyboxMap = textures.skyboxMap;

    var shadersInstance = new Shaders();
    app.shaderMap = await shadersInstance.populate();
//renderer
    app.renderer = new THREE.WebGLRenderer({alpha: true});
    app.renderer.outputEncoding = THREE.sRGBEncoding;
    app.renderer.setSize( window.innerWidth, window.innerHeight );
    app.renderer.shadowMap.enabled = true;
    app.renderer.shadowMapSoft = true;

//scene
    app.scene = new THREE.Scene();
    app.scene.background = app.skyboxMap["bethnal"][1];
//light
    app.light = new Light(app.scene);
//camera
    app.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 5000);
    app.camera.position.z = 1000;
//controls
    app.controls = new THREE.OrbitControls( app.camera, document.getElementById("scene-container"));
//GUI
    app.gui = new GUI();
//meshes
    app.meshes = Shape.create();

    document.getElementById("scene-container").appendChild( app.renderer.domElement );
    document.body.appendChild( app.gui.stats.domElement );
    document.body.appendChild( app.gui.gui.domElement );
    app.controls.update();
    return new Promise(function (resolve, reject) {
          animate();
          resolve();
    });
}
function animate() {
    app.gui.stats.begin();

    for (var j = 0; j < app.meshes.length; j++) {
        app.meshes[j].rotation.x += app.gui.params.speed;
        app.meshes[j].rotation.y += app.gui.params.speed;
    }
    app.gui.stats.end();

    requestAnimationFrame( animate );
    app.controls.update();
    app.renderer.clear();
    app.renderer.render( app.scene, app.camera );
}
init();