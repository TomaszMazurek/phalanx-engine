var i, textures, shaders, textureMap, shaderMap, stats,  gui, params;
var scene, camera, renderer, controls;
var geometry, material, plane, texture,
    normalMap, specularMap, roughnessMap,
    mesh, phongMaterial, stdMaterial,
    meshPhong, meshStandard,
    light, selectedShape, shape,
    near,far, fov;


async function init() {
    textures = new Textures();
    textureMap = await textures.populate();

    shaders = new Shaders();
    shaderMap = await shaders.populate();

    var sceneObject = new Scene();
    scene = sceneObject.scene;
    camera = sceneObject.camera;
    renderer = sceneObject.renderer;
    controls = sceneObject.controls;

        return new GUI(camera).init().then(function (result) {
            gui = result.gui;
            stats = result.stats;
            params = result.params;
            selectedShape = params.shape;

            result.textureEvent.onChange(function(value) {
                shape.phong.material.applyMaps(value);
                shape.standard.material.applyMaps(value);

                shape.phong.material.applyRepeat(params.repeatU, params.repeatV);
                shape.standard.material.applyRepeat(params.repeatU, params.repeatV);

                shape.phong.needsUpdate = true;
                shape.standard.needsUpdate = true;
            });
            result.shapeEvent.onChange(function(value) {
                selectedShape = value;
                shape.changeShape();
            });
            light = new Light();
            light.createAmbientLight();
            light.createHemisphereLight();
            light.createDirectionalLight();
            light.createPointLight(0xffffff, new THREE.Vector3(300, 300, 300));
            light.createPointLight(0xffffff, new THREE.Vector3(-300, 300, -300));
            shape = new Shape();
            shape.phong.needsUpdate = true;
            shape.standard.needsUpdate = true;
            createObjects();

            document.getElementById("scene-container").appendChild( renderer.domElement );
            document.body.appendChild( stats.domElement );
            document.body.appendChild( gui.domElement );
            controls.update();
            return new Promise(function (resolve, reject) {
                  animate();
                  resolve();
            });
        });
}
function animate() {

    stats.begin();

    shape.phong.rotation.x += params.speed;
    shape.phong.rotation.y += params.speed;

    shape.standard.rotation.x += params.speed;
    shape.standard.rotation.y += params.speed;

    light.directionalLight.intensity = params.directionalLight > 0.2 ? params.directionalLight: 0;
    light.directionalLight.castShadow = params.directionalLightShadow;

    light.directionalLight.shadow.camera.near = params.near;
    light.directionalLight.shadow.camera.far = params.far;
    light.directionalLight.shadow.camera.fov = params.fov;

    light.directionalLight.bulb.material.emissiveIntensity = params.directionalLight  > 0.2 ? params.directionalLight + 0.2: 0;
    light.directionalLight.bulb.material.opacity = params.directionalLight > 0.2 ? 1: 0.5;

    for (i = 0; i < light.pointLights.length ; i++) {
        light.pointLights[i].intensity = params.pointLight1Power > 0.2 ? params.pointLight1Power: 0;
        light.pointLights[i].castShadow = params.pointLight1Shadow;

        light.pointLights[i].shadow.camera.near = params.near;
        light.pointLights[i].shadow.camera.far = params.far;
        light.pointLights[i].shadow.camera.fov = params.fov;

        light.pointLights[i].bulb.material.emissiveIntensity = params.pointLight1Power  > 0.2 ? params.pointLight1Power + 0.2: 0;
        light.pointLights[i].bulb.material.opacity = params.pointLight1Power > 0.2 ? 1: 0.5;
    }

    stats.end();

    requestAnimationFrame( animate );
    controls.update();
    renderer.render( scene, camera );

}
function createObjects() {

    //BoxGeometry(width : Float, height : Float, depth : Float, widthSegments : Integer, heightSegments : Integer, depthSegments : Integer)
    var planeGeometry = new THREE.BoxGeometry(2000, 2000, 10, 100, 100, 5);
    var planeMaterial = new THREE.MeshPhongMaterial( {
        color: new THREE.Color(textureMap['cobble3'][1]),
        map        :  textureMap['cobble3'][2].clone(),
        bumpMap  :  textureMap['cobble3'][3].clone(),
        normalMap  :  textureMap['cobble3'][4].clone(),
        bumpScale  :  1 }
        );

    planeMaterial.map.repeat.set(8, 8);
    planeMaterial.map.needsUpdate = true;
    planeMaterial.bumpMap.repeat.set(8, 8);
    planeMaterial.bumpMap.needsUpdate = true;
    planeMaterial.normalMap.repeat.set(8, 8);
    planeMaterial.normalMap.needsUpdate = true;

    plane = new THREE.Mesh( planeGeometry, planeMaterial );
    plane.rotation.x = Math.PI / 2;
    plane.position.y = -150;
    plane.receiveShadow = true;
    scene.add( plane );

    //BoxGeometry(width : Float, height : Float, depth : Float, widthSegments : Integer, heightSegments : Integer, depthSegments : Integer)
    var leftWallGeometry = new THREE.BoxGeometry(2000, 1000, 10, 100, 100, 5);
    var leftWallMaterial = new THREE.MeshPhongMaterial( {
         color: new THREE.Color(textureMap['bricks1'][1]),
        map        :  textureMap['bricks1'][2].clone(),
        bumpMap  :  textureMap['bricks1'][3].clone(),
        normalMap  :  textureMap['bricks1'][4].clone(),
        bumpScale  :  1 }
    );
    leftWallMaterial.map.repeat.set(8, 8);
    leftWallMaterial.map.needsUpdate = true;
    leftWallMaterial.bumpMap.repeat.set(8, 8);
    leftWallMaterial.bumpMap.needsUpdate = true;
    leftWallMaterial.normalMap.repeat.set(8, 8);
    leftWallMaterial.normalMap.needsUpdate = true;

    var leftWall = new THREE.Mesh( leftWallGeometry, leftWallMaterial );
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.x = -1000;
    leftWall.position.y = 350;
    leftWall.receiveShadow = true;
    scene.add( leftWall );

    //BoxGeometry(width : Float, height : Float, depth : Float, widthSegments : Integer, heightSegments : Integer, depthSegments : Integer)
    var backWallGeometry = new THREE.BoxGeometry(2000, 1000, 10, 100, 100, 5);
    var backWallMaterial = new THREE.MeshPhongMaterial( {
        color: new THREE.Color(textureMap['bricks2'][1]),
        map : textureMap['bricks2'][2].clone(),
        bumpMap  :  textureMap['bricks2'][3].clone(),
        normalMap  :  textureMap['bricks2'][4].clone(),
        bumpScale  :  1
    });

    backWallMaterial.map.repeat.set(8, 8);
    backWallMaterial.map.needsUpdate = true;
    backWallMaterial.bumpMap.repeat.set(8, 8);
    backWallMaterial.bumpMap.needsUpdate = true;
    backWallMaterial.normalMap.repeat.set(8, 8);
    backWallMaterial.normalMap.needsUpdate = true;

    var backWall = new THREE.Mesh( backWallGeometry, backWallMaterial );
    backWall.position.z = -1000;
    backWall.position.y = 350;
    backWall.receiveShadow = true;
    scene.add( backWall );

    //BoxGeometry(width : Float, height : Float, depth : Float, widthSegments : Integer, heightSegments : Integer, depthSegments : Integer)
    var rightWallGeometry = new THREE.BoxGeometry(2000, 1000, 10, 100, 100, 5);
    var rightWallMaterial = new THREE.MeshPhongMaterial( {
        color: new THREE.Color(textureMap['bricks3'][1]),
        map        :  textureMap['bricks3'][2].clone(),
        bumpMap  :  textureMap['bricks3'][3].clone(),
        normalMap  :  textureMap['bricks3'][4].clone(),
        bumpScale  :  0.2
    });

    rightWallMaterial.map.repeat.set(8, 8);
    rightWallMaterial.map.needsUpdate = true;
    rightWallMaterial.bumpMap.repeat.set(8, 8);
    rightWallMaterial.bumpMap.needsUpdate = true;
    rightWallMaterial.normalMap.repeat.set(8, 8);
    rightWallMaterial.normalMap.needsUpdate = true;

    var rightWall = new THREE.Mesh( rightWallGeometry, rightWallMaterial );
    rightWall.rotation.y = Math.PI / 2;
    rightWall.position.x = 1000;
    rightWall.position.y = 350;
    rightWall.receiveShadow = true;
    scene.add( rightWall );
}
init();