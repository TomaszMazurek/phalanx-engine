var i, textures, shaders, textureMap, shaderMap, stats,  gui, params;
var scene, camera, renderer, controls;
var geometry, material, plane, texture,
    normalMap, specularMap, roughnessMap,
    mesh, phongMaterial, stdMaterial, normalMaterial,
    meshPhong, meshStandard, meshNormal,
    light, selectedShape, shape,
    near,far, fov;

var materialMap =  {
    wireframe: [undefined, undefined],
    phong: [undefined, undefined],
    pbr: [undefined, undefined],
    lambert: [undefined, undefined],
};

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
                applyMaterial(value);
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

/*
    sphereDir.material.emissiveIntensity = params.directionalLight  > 0.2 ? params.directionalLight + 0.2: 0;
    sphereDir.material.opacity = params.directionalLight > 0.2 ? 1: 0.5;

    sphere1.material.emissiveIntensity = params.pointLight1Power  > 0.2 ? params.pointLight2Power + 0.2: 0;
    sphere1.material.opacity = params.pointLight1Power > 0.2 ? 1: 0.5;

    sphere2.material.emissiveIntensity = params.pointLight2Power > 0.2 ? params.pointLight2Power + 0.2: 0;
    sphere2.material.opacity = params.pointLight2Power > 0.2 ? 1: 0.5;
*/

    shape.phong.rotation.x += params.speed;
    shape.phong.rotation.y += params.speed;
    shape.phong.material.bumpScale = params.bumpScale;
    //shape.phong.material.reflectivity = params.roughness;
    shape.phong.material.shininess = params.shininess * 100 + 20 * params.shininess;

    shape.standard.rotation.x += params.speed;
    shape.standard.rotation.y += params.speed;
    shape.standard.material.bumpScale = params.bumpScale;
    shape.standard.material.roughness = params.roughness;
    //shape.standard.material.metalness = params.shininess;

    //meshNormal.rotation.x += params.speed;
    //meshNormal.rotation.y += params.speed;

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
    //var planeGeometry = new THREE.PlaneGeometry( 2000, 2000);
    var planeGeometry = new THREE.BoxGeometry(2000, 2000, 10, 100, 100, 5);
    var planeMaterial = new THREE.MeshPhongMaterial( {
        color: new THREE.Color(textureMap['cobble3'][1]),
        map        :  textureMap['cobble3'][2],
        bumpMap  :  textureMap['cobble3'][3],
        normalMap  :  textureMap['cobble3'][4],
        bumpScale  :  1 }
        );
    planeMaterial.map.repeat.set(8, 8);
    planeMaterial.bumpMap.repeat.set(8, 8);
    planeMaterial.normalMap.repeat.set(8, 8);

    plane = new THREE.Mesh( planeGeometry, planeMaterial );
    plane.rotation.x = Math.PI / 2;
    plane.position.y = -150;
    plane.receiveShadow = true;
    scene.add( plane );

    //BoxGeometry(width : Float, height : Float, depth : Float, widthSegments : Integer, heightSegments : Integer, depthSegments : Integer)
    //var planeGeometry = new THREE.PlaneGeometry( 2000, 2000);
    var leftWallGeometry = new THREE.BoxGeometry(2000, 1000, 10, 100, 100, 5);
    var leftWallMaterial = new THREE.MeshPhongMaterial( {
         color: new THREE.Color(textureMap['bricks1'][1]),
        map        :  textureMap['bricks1'][2],
        bumpMap  :  textureMap['bricks1'][3],
        normalMap  :  textureMap['bricks1'][4],
        bumpScale  :  1 }
    );
    leftWallMaterial.map.repeat.set(8, 4);
    leftWallMaterial.bumpMap.repeat.set(8, 4);
    leftWallMaterial.normalMap.repeat.set(8, 4);

    var leftWall = new THREE.Mesh( leftWallGeometry, leftWallMaterial );
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.x = -1000;
    leftWall.position.y = 350;
    leftWall.receiveShadow = true;
    scene.add( leftWall );

    //BoxGeometry(width : Float, height : Float, depth : Float, widthSegments : Integer, heightSegments : Integer, depthSegments : Integer)
    //var planeGeometry = new THREE.PlaneGeometry( 2000, 2000);
    var backWallGeometry = new THREE.BoxGeometry(2000, 1000, 10, 100, 100, 5);
    var backWallMaterial = new THREE.MeshPhongMaterial( {
        map : textureMap['bricks2'][2],
        bumpMap  :  textureMap['bricks2'][3],
        normalMap  :  textureMap['bricks2'][4],
        bumpScale  :  1
    });
    backWallMaterial.map.repeat.set(8, 4);
    backWallMaterial.bumpMap.repeat.set(8, 4);
    backWallMaterial.normalMap.repeat.set(8, 4);
    var backWall = new THREE.Mesh( backWallGeometry, backWallMaterial );
    backWall.position.z = -1000;
    backWall.position.y = 350;
    backWall.receiveShadow = true;
    scene.add( backWall );

    //BoxGeometry(width : Float, height : Float, depth : Float, widthSegments : Integer, heightSegments : Integer, depthSegments : Integer)
    //var planeGeometry = new THREE.PlaneGeometry( 2000, 2000);
    var rightWallGeometry = new THREE.BoxGeometry(2000, 1000, 10, 100, 100, 5);
    var rightWallMaterial = new THREE.MeshPhongMaterial( {
        color: new THREE.Color(textureMap['bricks3'][1]),
        map        :  textureMap['bricks3'][2],
        bumpMap  :  textureMap['bricks3'][3],
        normalMap  :  textureMap['bricks3'][4],
        bumpScale  :  0.2
    });
    rightWallMaterial.map.repeat.set(8, 4);
    rightWallMaterial.bumpMap.repeat.set(8, 4);
    rightWallMaterial.normalMap.repeat.set(8, 4);
    var rightWall = new THREE.Mesh( rightWallGeometry, rightWallMaterial );
    rightWall.rotation.y = Math.PI / 2;
    rightWall.position.x = 1000;
    rightWall.position.y = 350;
    rightWall.receiveShadow = true;
    scene.add( rightWall );

/*
    //normal object
    var geometry = new THREE.BoxGeometry(150, 150, 150 );
    var bufferGeometry = new THREE.BufferGeometry().fromGeometry( geometry );

    normalMaterial = new THREE.ShaderMaterial({
        uniforms: {
            colorB: {type: 'vec3', value: new THREE.Color(0xACB6E5)},
            colorA: {type: 'vec3', value: new THREE.Color(0x74ebd5)}
        },
        vertexShader: shaderMap["wireframe"][1],
        fragmentShader: shaderMap["wireframe"][2]
    });

    materialMap["wireframe"][0] = normalMaterial;
    meshNormal = new THREE.Mesh( bufferGeometry, normalMaterial );
    meshNormal.castShadow = true;
    scene.add( meshNormal );*/
}
function applyMaterial(value){
    //phong
    meshPhong.material = new THREE.MeshPhongMaterial( {
        map: textureMap[value][2],
        bumpMap: textureMap[value][3],
        normalMap : textureMap[value][4],
        specularMap : textureMap[value][5],
        aoMap : textureMap[value][6]
    });
    materialMap["phong"][0] = meshPhong.material;
    meshPhong.material.needsUpdate = true;

    //PBR
    meshStandard.material = new THREE.MeshStandardMaterial( {
        map: textureMap[value][2],
        bumpMap : textureMap[value][3],
        normalMap : textureMap[value][4],
        roughnessMap : textureMap[value][5],
        aoMap : textureMap[value][6]
    });
    materialMap["pbr"][0] = meshStandard.material;
    meshStandard.material.needsUpdate = true;

    //Lambert
/*    meshNormal.material = new THREE.MeshLambertMaterial( {
        map: textureMap[value][2],
        aoMap : textureMap[value][6]
    });*/
    //materialMap["lambert"][0] = meshNormal.material;
    //meshNormal.material.needsUpdate = true;

    meshPhong.material.color = new THREE.Color(textureMap[value][1]);
    meshStandard.material.color = new THREE.Color(textureMap[value][1]);
    //meshNormal.material.color = new THREE.Color(textureMap[value][1]);
    meshPhong.material.name = value;
    meshStandard.material.name = value;
    //meshNormal.material.name = value;
}
init();