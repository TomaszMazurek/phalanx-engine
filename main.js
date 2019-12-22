var i,
    objects = [],
    textures, textureMap, shaderMap,
    sceneInstance, guiInstance,
    geometry, material, plane, texture,
    normalMap, specularMap, roughnessMap,
    mesh, phongMaterial, shaderMaterial, stdMaterial, normalMaterial,
    meshPhong,meshShader, meshStandard, meshNormal,
    selectedShape, shape,
    near,far, fov;


async function init() {
    var texturesInstance = new Textures();
    textureMap = await texturesInstance.populate();

    var shadersInstance = new Shaders();
    shaderMap = await shadersInstance.populate();

    sceneInstance = new Scene();
    guiInstance = new GUI(sceneInstance);

    shape = new Shape(sceneInstance);
    shape.update();

    document.getElementById("scene-container").appendChild( sceneInstance.renderer.domElement );
    document.body.appendChild( guiInstance.stats.domElement );
    document.body.appendChild( guiInstance.gui.domElement );
    sceneInstance.controls.update();
    return new Promise(function (resolve, reject) {
          animate();
          resolve();
    });
}
function animate() {
    guiInstance.stats.begin();

    for (var j = 0; j < sceneInstance.scene.children.length; j++) {
        var child = sceneInstance.scene.children[j];
        if (child.name === "meshObject") {
            child.rotation.x += guiInstance.params.speed;
            child.rotation.y += guiInstance.params.speed;
        }
    }
    guiInstance.stats.end();

    requestAnimationFrame( animate );
    sceneInstance.controls.update();
    sceneInstance.renderer.render( sceneInstance.scene, sceneInstance.camera );

}
init();