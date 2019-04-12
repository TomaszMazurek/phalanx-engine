var i, textures, textureMap, shaderMap, stats,  gui, params;
var scene, camera, renderer, controls;
var geometry, material, plane, texture,
    normalMap, specularMap, roughnessMap,
    mesh, phongMaterial, shaderMaterial, stdMaterial,
    meshPhong,meshShader, meshStandard,
    light, selectedShape, shape,
    near,far, fov;


async function init() {
    var texturesInstance = new Textures();
    textureMap = await texturesInstance.populate();

    var shadersInstance = new Shaders();
    shaderMap = await shadersInstance.populate();

    var sceneInstance = new Scene();
    scene = sceneInstance.scene;
    camera = sceneInstance.camera;
    renderer = sceneInstance.renderer;
    controls = sceneInstance.controls;

    var GUIInstance = new GUI(camera);
        gui = GUIInstance.gui;
        stats = GUIInstance.stats;
        params = GUIInstance.params;
        selectedShape = params.shape;

        light = new Light();

        shape = new Shape();
        shape.phong.needsUpdate = true;
        shape.standard.needsUpdate = true;

        document.getElementById("scene-container").appendChild( renderer.domElement );
        document.body.appendChild( stats.domElement );
        document.body.appendChild( gui.domElement );
        controls.update();
        return new Promise(function (resolve, reject) {
              animate();
              resolve();
        });

}
function animate() {

    stats.begin();

    shape.phong.rotation.x += params.speed;
    shape.phong.rotation.y += params.speed;

    shape.shader.rotation.x += params.speed;
    shape.shader.rotation.y += params.speed;
    shape.shader.material.needsUpdate = true;

    shape.standard.rotation.x += params.speed;
    shape.standard.rotation.y += params.speed;

    stats.end();

    requestAnimationFrame( animate );
    controls.update();
    renderer.render( scene, camera );

}
init();