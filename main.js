var textureMap, stats,  gui, params;
var geometry, material, plane, texture,
    normalMap, specularMap, roughnessMap,
    mesh, phongMaterial, stdMaterial, normalMaterial,
    meshPhong, meshStandard, meshNormal,
    pointLight1, pointLight2, directionalLight,
    sphere1, sphere2, sphereDir,
    near,far, fov;

var shaderMap =  {
    wireframe: [undefined, undefined]
};

var materialMap =  {
    wireframe: [undefined, undefined],
    phong: [undefined, undefined],
    pbr: [undefined, undefined],
    lambert: [undefined, undefined],
};

async function init() {
    var textures = new Textures();
    textureMap = await textures.populateTextureMap();
   debugger;
        return new GUI(camera).init().then(function (result) {
            gui = result.gui;
            stats = result.stats;
            params = result.params;
            result.textureEvent.onChange(function(value) {
                applyMaterial(value);
            });
            createLight();
            createShadow();
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

    sphereDir.material.emissiveIntensity = params.directionalLight  > 0.2 ? params.directionalLight + 0.2: 0;
    sphereDir.material.opacity = params.directionalLight > 0.2 ? 1: 0.5;

    sphere1.material.emissiveIntensity = params.pointLight1Power  > 0.2 ? params.pointLight2Power + 0.2: 0;
    sphere1.material.opacity = params.pointLight1Power > 0.2 ? 1: 0.5;

    sphere2.material.emissiveIntensity = params.pointLight2Power > 0.2 ? params.pointLight2Power + 0.2: 0;
    sphere2.material.opacity = params.pointLight2Power > 0.2 ? 1: 0.5;

    meshPhong.rotation.x += params.speed;
    meshPhong.rotation.y += params.speed;
    meshPhong.material.bumpScale = params.bumpScale;
    meshPhong.material.reflectivity = params.roughness;
    meshPhong.material.shininess = params.shininess * 100 + 20 * params.shininess;

    meshStandard.rotation.x += params.speed;
    meshStandard.rotation.y += params.speed;
    meshStandard.material.bumpScale = params.bumpScale;
    meshStandard.material.roughness = params.roughness;
    meshStandard.material.metalness = params.shininess;

    meshNormal.rotation.x += params.speed;
    meshNormal.rotation.y += params.speed;

    directionalLight.intensity = params.directionalLight > 0.2 ? params.directionalLight: 0;
    directionalLight.castShadow = params.directionalLightShadow;

    directionalLight.shadow.camera.near = params.near;
    directionalLight.shadow.camera.far = params.far;
    directionalLight.shadow.camera.fov = params.fov;

    pointLight1.intensity = params.pointLight1Power > 0.2 ? params.pointLight1Power: 0;
    pointLight1.castShadow = params.pointLight1Shadow;

    pointLight1.shadow.camera.near = params.near;
    pointLight1.shadow.camera.far = params.far;
    pointLight1.shadow.camera.fov = params.fov;

    pointLight2.intensity = params.pointLight2Power > 0.2 ? params.pointLight2Power: 0;
    pointLight2.castShadow = params.pointLight2Shadow;

    pointLight2.shadow.camera.near = params.near;
    pointLight2.shadow.camera.far = params.far;
    pointLight2.shadow.camera.fov = params.fov;

    stats.end();

    requestAnimationFrame( animate );
    controls.update();
    renderer.render( scene, camera );

}

function createLight() {
    scene.add( new THREE.HemisphereLight( 0xffffff, 0x080820, 0.5 ) );
    //--------------------------light-------------------------------
    //scene.add( new THREE.AmbientLight( 0x404040 ) );

    // White directional light at half intensity shining from the top.
    directionalLight = new THREE.DirectionalLight(0xffffff);
    directionalLight.position.set(300, 600, 50);
    directionalLight.position.multiplyScalar(1.3);

    scene.add(directionalLight);

    var sphereDirGeometry = new THREE.SphereGeometry( 50 );
    var sphereDirMaterial = new THREE.MeshLambertMaterial( {color: 0x444444, emissive: new THREE.Color(0xffffff), opacity: 0.3, transparent: true} );
    sphereDir = new THREE.Mesh( sphereDirGeometry, sphereDirMaterial );
    sphereDir.position.set(directionalLight.position.x, directionalLight.position.y, directionalLight.position.z );
    scene.add(sphereDir);

    pointLight1 = new THREE.PointLight( 0xffffff );
    pointLight1.position.set( 200,300, 400);
    pointLight1.angle = 180;
    scene.add( pointLight1 );

    var sphere1Geometry = new THREE.SphereGeometry( 10 );
    var sphere1Material = new THREE.MeshLambertMaterial( {color: 0x444444, emissive: new THREE.Color(0xffffff), opacity: 0.3, transparent: true} );
    sphere1 = new THREE.Mesh( sphere1Geometry, sphere1Material );
    sphere1.position.set(pointLight1.position.x, pointLight1.position.y, pointLight1.position.z );
    scene.add(sphere1);

    pointLight2 = new THREE.PointLight( 0xffffff );
    pointLight2.position.set( -200,300, -400);
    pointLight2.angle = 180;

    scene.add( pointLight2 );

    var sphere2Geometry = new THREE.SphereGeometry( 10 );
    var sphere2Material = new THREE.MeshLambertMaterial( {color: 0x444444, emissive: new THREE.Color(0xffffff), opacity: 0.3, transparent: true} );
    sphere2 = new THREE.Mesh( sphere2Geometry, sphere2Material );
    sphere2.position.set(pointLight2.position.x, pointLight2.position.y, pointLight2.position.z );
    scene.add(sphere2);
}
function createShadow(){

    var d = 2000;

//directionaLight
    directionalLight.castShadow = true;

    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;

    directionalLight.shadow.camera.near = params.near;
    directionalLight.shadow.camera.far = params.far;
    directionalLight.shadow.camera.fov = params.fov;

    directionalLight.shadow.camera.left = -d;
    directionalLight.shadow.camera.right = d;
    directionalLight.shadow.camera.top = d;
    directionalLight.shadow.camera.bottom = -d;

    directionalLight.shadow.bias = 0.001;

//point light 1
    pointLight1.castShadow = true;

    pointLight1.shadow.mapSize.width = 1024;
    pointLight1.shadow.mapSize.height = 1024;

    pointLight1.shadow.camera.near = params.near;
    pointLight1.shadow.camera.far = params.far;
    pointLight1.shadow.camera.fov = params.fov;

    pointLight1.shadow.camera.left = -d;
    pointLight1.shadow.camera.right = d;
    pointLight1.shadow.camera.top = d;
    pointLight1.shadow.camera.bottom = -d;

    pointLight1.shadow.bias = 0.001;

//point light 2
    pointLight2.castShadow = true;

    pointLight2.shadow.mapSize.width = 1024;
    pointLight2.shadow.mapSize.height = 1024;

    pointLight2.shadow.camera.near = params.near;
    pointLight2.shadow.camera.far = params.far;
    pointLight2.shadow.camera.fov = params.fov;

    pointLight2.shadow.camera.left = -d;
    pointLight2.shadow.camera.right = d;
    pointLight2.shadow.camera.top = d;
    pointLight2.shadow.camera.bottom = -d;

    pointLight2.shadow.bias = 0.001;

}
function createObjects() {
    var shaderMaterial = new WireframeMaterial();
    debugger;
    //phong object
    geometry = new THREE.BoxGeometry( 150, 150, 150 );
    phongMaterial = new THREE.MeshPhongMaterial({
        color      :  new THREE.Color('#FFEEB0'),
//        emissive   :  new THREE.Color("rgb(7,3,5)"),
//        specular   :  new THREE.Color(0xFFEEB0),
        shininess  :  0.1,
        map        :  textureMap['wood1'][2],
        bumpMap  :  textureMap['wood1'][3],
        normalMap  :  textureMap['wood1'][4],
        bumpScale  :  0.2 });
    meshPhong = new THREE.Mesh( geometry, phongMaterial );
    meshPhong.position.set(300,0,0);
    meshPhong.castShadow = true;
    meshPhong.receiveShadow = false;
    scene.add( meshPhong );

    //standard object
    geometry = new THREE.BoxGeometry( 150, 150, 150  );
    stdMaterial = new THREE.MeshStandardMaterial( {
        color: new THREE.Color('#FFEEB0'),
        map        :  textureMap['wood1'][2],
        bumpMap  :  textureMap['wood1'][3],
        normalMap  :  textureMap['wood1'][4],
        roughnessMap: textureMap['wood1'][5],
        metalness : 0.1,
        roughness : 0.8,
        bumpScale  :  0.2 } );
    meshStandard = new THREE.Mesh( geometry, stdMaterial );
    meshStandard.position.set(-300,0,0);
    meshStandard.castShadow = true;
    meshStandard.receiveShadow = false;
    scene.add( meshStandard );

    //BoxGeometry(width : Float, height : Float, depth : Float, widthSegments : Integer, heightSegments : Integer, depthSegments : Integer)
    //var planeGeometry = new THREE.PlaneGeometry( 2000, 2000);
    var planeGeometry = new THREE.BoxGeometry(2000, 2000, 10, 100, 100, 5);
    var planeMaterial = new THREE.MeshPhongMaterial( {
        color: 0x92806d,
        side: THREE.DoubleSide,
        map: new THREE.TextureLoader().load( "textures/cobblestone/cobble3/Base_Color.jpg",    async function ( map ) {
            map.name = "checker";
            map.wrapS = map.wrapT = THREE.RepeatWrapping;
            map.anisotropy = 16;
            map.offset.set( 0, 0 );
            map.repeat.set(8, 8);
        })} );
    plane = new THREE.Mesh( planeGeometry, planeMaterial );
    plane.rotation.x = Math.PI / 2;
    plane.position.y = -150;
    plane.material.normalMap = new THREE.TextureLoader().load( "textures/cobblestone/cobble3/Normal.jpg" );
    plane.material.normalMap.wrapS = plane.material.normalMap.wrapT = THREE.RepeatWrapping;
    plane.material.normalMap.offset.set( 0, 0 );
    plane.material.normalMap.repeat.set(8, 8);
    plane.material.bumpMap = new THREE.TextureLoader().load( "textures/cobblestone/cobble3/Bump.jpg" );
    plane.material.bumpMap.wrapS = plane.material.bumpMap.wrapT = THREE.RepeatWrapping;
    plane.material.bumpMap.offset.set( 0, 0 );
    plane.material.bumpMap.repeat.set(8, 8);
    plane.receiveShadow = true;
    scene.add( plane );

    //BoxGeometry(width : Float, height : Float, depth : Float, widthSegments : Integer, heightSegments : Integer, depthSegments : Integer)
    //var planeGeometry = new THREE.PlaneGeometry( 2000, 2000);
    var leftWallGeometry = new THREE.BoxGeometry(2000, 1000, 10, 100, 100, 5);
    var leftWallMaterial = new THREE.MeshPhongMaterial( {
        color: 0xaf7c63,
        side: THREE.DoubleSide,
        map: new THREE.TextureLoader().load( "textures/bricks/bricks1/Base_Color.jpg",    async function ( map ) {
            textureMap["checker"][2] = map;
            map.name = "checker";
            map.wrapS = map.wrapT = THREE.RepeatWrapping;
            map.anisotropy = 16;
            map.offset.set( 0, 0 );
            map.repeat.set(8, 4);
            //map.repeat.set(8, 8);
        }),
        normalMap : new THREE.TextureLoader().load( "textures/bricks/bricks1/Normal.jpg",    async function ( map ) {
            textureMap["checker"][2] = map;
            map.name = "checker";
            map.wrapS = map.wrapT = THREE.RepeatWrapping;
            map.anisotropy = 16;
            map.offset.set( 0, 0 );
            map.repeat.set(8, 4);
            //map.repeat.set(8, 8);
        }),
        bumpMap : new THREE.TextureLoader().load( "textures/bricks/bricks1/Bump.jpg",    async function ( map ) {
            textureMap["checker"][2] = map;
            map.name = "checker";
            map.wrapS = map.wrapT = THREE.RepeatWrapping;
            map.anisotropy = 16;
            map.offset.set( 0, 0 );
            map.repeat.set(8, 4);
            //map.repeat.set(8, 8);
        })
} );
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
        color: 0x92806d,
        side: THREE.DoubleSide,
        map: new THREE.TextureLoader().load( "textures/bricks/bricks2/Base_Color.jpg",    async function ( map ) {
            textureMap["checker"][2] = map;
            map.name = "checker";
            map.wrapS = map.wrapT = THREE.RepeatWrapping;
            map.anisotropy = 16;
            map.repeat.set(8, 4);
        }), normalMap: new THREE.TextureLoader().load( "textures/bricks/bricks2/Normal.jpg",    async function ( map ) {
            textureMap["checker"][2] = map;
            map.name = "checker";
            map.wrapS = map.wrapT = THREE.RepeatWrapping;
            map.anisotropy = 16;
            map.repeat.set(8, 4);
        }), bumpMap: new THREE.TextureLoader().load( "textures/bricks/bricks2/Bump.jpg",    async function ( map ) {
            textureMap["checker"][2] = map;
            map.name = "checker";
            map.wrapS = map.wrapT = THREE.RepeatWrapping;
            map.anisotropy = 16;
            map.repeat.set(8, 4);
        }),

    } );
    var backWall = new THREE.Mesh( backWallGeometry, backWallMaterial );
    backWall.position.z = -1000;
    backWall.position.y = 350;
    backWall.receiveShadow = true;
    scene.add( backWall );

    //BoxGeometry(width : Float, height : Float, depth : Float, widthSegments : Integer, heightSegments : Integer, depthSegments : Integer)
    //var planeGeometry = new THREE.PlaneGeometry( 2000, 2000);
    var rightWallGeometry = new THREE.BoxGeometry(2000, 1000, 10, 100, 100, 5);
    var rightWallMaterial = new THREE.MeshPhongMaterial( {
        color: 0x92806d,
        side: THREE.DoubleSide,
        map: new THREE.TextureLoader().load( "textures/bricks/bricks3/Base_Color.jpg",    async function ( map ) {
            textureMap["checker"][2] = map;
            map.name = "checker";
            map.wrapS = map.wrapT = THREE.RepeatWrapping;
            map.anisotropy = 16;
            map.repeat.set(8, 4);
        }),
        normalMap: new THREE.TextureLoader().load( "textures/bricks/bricks3/Normal.jpg",    async function ( map ) {
            textureMap["checker"][2] = map;
            map.name = "checker";
            map.wrapS = map.wrapT = THREE.RepeatWrapping;
            map.anisotropy = 16;
            map.repeat.set(8, 4);
        }),
        bumpMap: new THREE.TextureLoader().load( "textures/bricks/bricks3/Bump.jpg",    async function ( map ) {
            textureMap["checker"][2] = map;
            map.name = "checker";
            map.wrapS = map.wrapT = THREE.RepeatWrapping;
            map.anisotropy = 16;
            map.repeat.set(8, 4);
        }),

    } );
    var rightWall = new THREE.Mesh( rightWallGeometry, rightWallMaterial );
    rightWall.rotation.y = Math.PI / 2;
    rightWall.position.x = 1000;
    rightWall.position.y = 350;
    rightWall.receiveShadow = true;
    scene.add( rightWall );


    //normal object
    var geometry = new THREE.BoxGeometry(150, 150, 150 );
    var bufferGeometry = new THREE.BufferGeometry().fromGeometry( geometry );

    normalMaterial = new THREE.ShaderMaterial({
        uniforms: {
            colorB: {type: 'vec3', value: new THREE.Color(0xACB6E5)},
            colorA: {type: 'vec3', value: new THREE.Color(0x74ebd5)}
        },
        vertexShader: shaderMap["wireframe"][0],
        fragmentShader: shaderMap["wireframe"][1]
    });

    materialMap["wireframe"][0] = normalMaterial;
    meshNormal = new THREE.Mesh( bufferGeometry, normalMaterial );
    meshNormal.castShadow = true;
    scene.add( meshNormal );
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
    meshNormal.material = new THREE.MeshLambertMaterial( {
        map: textureMap[value][2],
        aoMap : textureMap[value][6]
    });
    materialMap["lambert"][0] = meshNormal.material;
    meshNormal.material.needsUpdate = true;

    meshPhong.material.color = new THREE.Color(textureMap[value][1]);
    meshStandard.material.color = new THREE.Color(textureMap[value][1]);
    meshNormal.material.color = new THREE.Color(textureMap[value][1]);
    meshPhong.material.name = value;
    meshStandard.material.name = value;
    meshNormal.material.name = value;
}
function startApp() {
    init();
//    animate();
}
startApp();