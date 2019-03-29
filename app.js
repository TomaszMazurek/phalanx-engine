var scene, camera, renderer, stats, controls, gui, textureEvent,
    params = {
        speed : 0.001,
        pointLight1Power: 1.2,
        pointLight2Power: 1.2,
        directionalLight: 1.2,
        bumpScale : 1.0,
        roughness : 0.5,
        shininess : 0.5,
        texture: "wood1"
};
var geometry, material, plane, texture,
    normalMap, specularMap, roughnessMap,
    mesh, phongMaterial, stdMaterial, normalMaterial,
    meshPhong, meshStandard, meshNormal,
    pointLight1, pointLight2, directionalLight;


var textureLoader = new THREE.TextureLoader();
var textureMap = {
    wood1: ["textures/wood/maps/wood1/", 0xFFEEB0, undefined, undefined, undefined, undefined, undefined],
    wood2: ["textures/wood/maps/wood2/", 0xa0522d, undefined, undefined, undefined, undefined, undefined],
    wood3: ["textures/wood/maps/wood3/", 0xCD8500, undefined, undefined, undefined, undefined, undefined],
    cobble1: ["textures/cobblestone/maps/cobble1/", 0x92806d, undefined, undefined, undefined, undefined, undefined],
    cobble2: ["textures/cobblestone/maps/cobble2/", 0x878481, undefined, undefined, undefined, undefined, undefined],
    cobble3: ["textures/cobblestone/maps/cobble3/", 0x95908c, undefined, undefined, undefined, undefined, undefined],
    roof1: ["textures/roofing/maps/roof1/", 0xdeaf8a, undefined, undefined, undefined, undefined, undefined],
    roof2: ["textures/roofing/maps/roof2/", 0xc5976d, undefined, undefined, undefined, undefined, undefined],
    roof3: ["textures/roofing/maps/roof3/", 0xa37862, undefined, undefined, undefined, undefined, undefined],
    bricks1: ["textures/bricks/maps/bricks1/", 0xaf7c63, undefined, undefined, undefined, undefined, undefined],
    bricks2: ["textures/bricks/maps/bricks2/", 0xb4705f, undefined, undefined, undefined, undefined, undefined],
    bricks3: ["textures/bricks/maps/bricks3/", 0xb18a6f, undefined, undefined, undefined, undefined, undefined],
    iceTexture: ["textures/others/maps/iceTexture/", 0x6bb7e9, undefined, undefined, undefined, undefined, undefined],
    checker: ["textures/others/maps/checker", 0x6bb7e9, undefined, undefined, undefined, undefined, undefined]
};

function init() {
    createUI()
    createScene();
    createLight();
    createObjects();
    document.getElementById("scene-container").appendChild( renderer.domElement );
    document.body.appendChild( stats.domElement );
    document.body.appendChild( gui.domElement );

    controls.update();
}
function animate() {

    stats.begin();

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
    meshNormal.material.bumpScale = params.bumpScale;
    meshNormal.material.roughness = params.roughness;

    pointLight1.intensity = params.pointLight1Power;
    pointLight2.intensity = params.pointLight2Power;
    directionalLight.intensity = params.directionalLight;

    stats.end();

    requestAnimationFrame( animate );
    controls.update();
    renderer.render( scene, camera );

}
function createScene() {
    renderer = new THREE.WebGLRenderer();
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    scene.background = new THREE.Color( 'skyblue' );

    camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.2, 25000);
    camera.position.z = 1000;

    renderer.shadowCameraNear = 3;
    renderer.shadowCameraFar = camera.far;
    renderer.shadowCameraFov = 50;

    controls = new THREE.OrbitControls( camera, document.getElementById("scene-container"));
}
function createLight() {

    //--------------------------light-------------------------------
    var ambientLight = new THREE.AmbientLight( 0x404040 );
    scene.add( ambientLight );

    // White directional light at half intensity shining from the top.
    directionalLight = new THREE.DirectionalLight( 0xffffff, 1.0 );
    directionalLight.position = new THREE.Vector3(1,1,1);
    directionalLight.shadowMapWidth = directionalLight.shadowMapHeight = 2048;
    directionalLight.shadowDarkness = 0.5;
    directionalLight.castShadow = true;
    directionalLight.shadowCameraVisible = true;

    directionalLight.shadow.mapSize.width = 512;  // default
    directionalLight.shadow.mapSize.height = 512; // default
    directionalLight.shadow.camera.near = 0.5;    // default
    directionalLight.shadow.camera.far = 500;     // default
    scene.add( directionalLight );

    pointLight1 = new THREE.PointLight(0xffffff, 1.0);
    pointLight1.position.set( -200, -100, 200 );
    pointLight1.castShadow = true;
    scene.add( pointLight1 );

    var sphereSize = 10;
    var pointLightHelper1 = new THREE.PointLightHelper( pointLight1, sphereSize );
    scene.add( pointLightHelper1 );

    pointLight2 = new THREE.PointLight( 0xffffff, 1.0 );
    pointLight2.position.set(200,-100, 200);
    pointLight2.castShadow = true;
    scene.add( pointLight2 );

    var sphereSize = 10;
    var pointLightHelper1 = new THREE.PointLightHelper( pointLight2, sphereSize );
    scene.add( pointLightHelper1 );
}
function createObjects() {
    texture = new THREE.TextureLoader().load( "textures/wood/wood.jpg" );
    normalMap = new THREE.TextureLoader().load( "textures/wood/maps/wood1/Normal.png" );
    roughnessMap = new THREE.TextureLoader().load( "textures/wood/maps/wood1/Roughness.png" );


    //phong object
    geometry = new THREE.BoxGeometry( 150, 150, 150 );
    phongMaterial = new THREE.MeshPhongMaterial({
        color      :  new THREE.Color('#FFEEB0'),
//        emissive   :  new THREE.Color("rgb(7,3,5)"),
//        specular   :  new THREE.Color(0xFFEEB0),
        shininess  :  0.1,
        bumpMap  :  normalMap,
        specularMap: roughnessMap,
        map        :  texture,
        bumpScale  :  0.2 });
    meshPhong = new THREE.Mesh( geometry, phongMaterial );
    meshPhong.position.set(200,0,0);
    meshPhong.castShadow = true;
    meshPhong.receiveShadow = false;
    scene.add( meshPhong );

    //standard object
    geometry = new THREE.BoxGeometry( 150, 150, 150  );
    stdMaterial = new THREE.MeshStandardMaterial( {
        color: new THREE.Color('#FFEEB0'),
        map: texture,
        bumpMap: normalMap,
        roughnessMap : roughnessMap,
        metalness : 0.1,
        roughness : 0.8,
        bumpScale  :  0.2 } );
    meshStandard = new THREE.Mesh( geometry, stdMaterial );
    meshStandard.position.set(-200,0,0);
    meshStandard.castShadow = true;
    meshStandard.receiveShadow = false;
    scene.add( meshStandard );


    //normal object
    geometry = new THREE.BoxGeometry(150, 150, 150 );
    normalMaterial = new THREE.MeshLambertMaterial({
        color      :  new THREE.Color('#FFEEB0'),
        //emissive   :  new THREE.Color("rgb(7,3,5)"),
        //specular   :  new THREE.Color('#cb4154'),
        //shininess  :  0.1,
        normalMap  :  normalMap,
        specularMap: roughnessMap,
        map        :  texture,
        bumpScale  :  0.2 });
    meshNormal = new THREE.Mesh( geometry, normalMaterial );
    meshNormal.position.set(0,200,0);
    meshNormal.castShadow = true;
    meshNormal.receiveShadow = false;
    scene.add( meshNormal );

    var planeGeometry = new THREE.PlaneGeometry( 2000, 2000);
    var planeMaterial = new THREE.MeshPhongMaterial( {
        color: 0xffffff,
        side: THREE.DoubleSide,
        map: new THREE.TextureLoader().load( "textures/others/maps/checker/checker.jpeg",    async function ( map ) {
            textureMap["checker"][2] = map;
            map.name = "checker";
            map.wrapS = map.wrapT = THREE.RepeatWrapping;
            map.anisotropy = 16;
            map.offset.set( 0, 0 );
            map.repeat.set( 1, 1 );
        })} );
    plane = new THREE.Mesh( planeGeometry, planeMaterial );
    plane.rotation.x = Math.PI / 2;
    plane.position.y = -150;
    plane.receiveShadow = true;
    /*
        plane.material.map.wrapS = THREE.RepeatWrapping;
        plane.material.map.wrapT = THREE.RepeatWrapping;
        plane.material.map.anisotropy = 16;
        plane.material.map.repeat.set( 1, 1 );*/

    scene.add( plane );
}
function createUI(){
//stats
    stats = new Stats();
    stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom
//dat
    gui = new dat.GUI();
    gui.add(params, 'speed', -0.1, 0.1).name('speed');
    gui.add(params, 'pointLight1Power', 0.0, 3.0);
    gui.add(params, 'pointLight2Power', 0.0, 3.0);
    gui.add(params, 'directionalLight', 0.0, 3.0);
    gui.add(params, 'bumpScale', -1.0, 1.0);
    gui.add(params, 'roughness', 0.0, 1.0);
    gui.add(params, 'shininess', 0.0, 1.0);
    textureEvent = gui.add(params, 'texture', [ 'wood1', 'wood2','wood3', 'cobble1','cobble2',
        'cobble3','roof1', 'roof2','roof3', 'bricks1','bricks2', 'bricks3', 'iceTexture'] );
    textureEvent.onChange(function(value) {
        applyMaterial(value);
    });
}
async function populateTextureMap(){
    await (async function populateTextures() {

        var keyArray = Object.keys(textureMap);
        var i = 0;
        var loadTex = async function() {
            var key = keyArray[i];
            textureLoader.load( textureMap[key][0] + "Base_Color.png",
                async function ( map ) {
                    textureMap[key][2] = map;
                    map.name = key;
                    map.wrapS = THREE.RepeatWrapping;
                    map.wrapT = THREE.RepeatWrapping;
                    map.anisotropy = 16;
                    map.repeat.set( 1, 1 );

                    if (i < keyArray.length - 1) {
                        i++;
                        await loadTex();
                    }
                });
        };
        await loadTex();
    })();
    await (async function populateBumpMaps() {
        var keyArray = Object.keys(textureMap);
        var i = 0;
        var loadTex = async function() {
            var key = keyArray[i];
            textureLoader.load( textureMap[key][0] + "Bump.png",
                async function ( map ) {
                    textureMap[key][3] = map;
                    if (i < keyArray.length - 1) {
                        i++;
                        await loadTex();
                    }
                });
        };
        await loadTex();
    })();
    await (async function populateNormalMaps() {
        var keyArray = Object.keys(textureMap);
        var i = 0;
        var loadTex = async function() {
            var key = keyArray[i];
            textureLoader.load( textureMap[key][0] + "Normal.png",
                async function ( map ) {
                    textureMap[key][4] = map;
                    if (i < keyArray.length - 1) {
                        i++;
                        await loadTex();
                    }
                });
        };
        await loadTex();
    })();
    await (async function populateRoughnessMaps() {
        var keyArray = Object.keys(textureMap);
        var i = 0;
        var loadTex = async function() {
            var key = keyArray[i];
            textureLoader.load( textureMap[key][0] + "Roughness.png",
                async function ( map ) {
                    textureMap[key][5] = map;
                    if (i < keyArray.length - 1) {
                        i++;
                        await loadTex();
                    }
                });
        };
        await loadTex();
    })();
    await (async function populateAOMaps() {
        var keyArray = Object.keys(textureMap);
        var i = 0;
        var loadTex = async function() {
            var key = keyArray[i];
            textureLoader.load( textureMap[key][0] + "Ambient_Occlusion.png",
                async function ( map ) {
                    textureMap[key][6] = map;
                    if (i < keyArray.length - 1) {
                        i++;
                        await loadTex();
                    }
                });
        };
        await loadTex();
    })();
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
    meshPhong.material.needsUpdate = true;

    //PBR
    meshStandard.material = new THREE.MeshStandardMaterial( {
        map: textureMap[value][2],
        bumpMap : textureMap[value][3],
        normalMap : textureMap[value][4],
        roughnessMap : textureMap[value][5],
        aoMap : textureMap[value][6]
    });
    meshStandard.material.needsUpdate = true;

    //Lambert
    meshNormal.material = new THREE.MeshStandardMaterial( {
        map: textureMap[value][2],
        bumpMap : textureMap[value][3],
        normalMap : textureMap[value][4],
        roughnessMap : textureMap[value][5],
        aoMap : textureMap[value][6]
    });
    meshNormal.material.needsUpdate = true;

    meshPhong.material.color = new THREE.Color(textureMap[value][1]);
    meshStandard.material.color = new THREE.Color(textureMap[value][1]);
    meshNormal.material.color = new THREE.Color(textureMap[value][1]);
    meshPhong.material.name = value;
    meshStandard.material.name = value;
    meshNormal.material.name = value;
}
var textureMapPromise = new Promise(async function(resolve, reject) {
    await populateTextureMap();
    resolve();
});
textureMapPromise.then(function(value) {
    init();
    animate();
});
