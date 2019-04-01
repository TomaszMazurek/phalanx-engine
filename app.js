var scene, camera, renderer, stats, controls, gui, textureEvent,
    params = {
        speed : 0.001,
        pointLight1Power: 1.2,
        pointLight1Shadow: true,
        pointLight2Power: 1.2,
        pointLight2Shadow: true,
        directionalLight: 1.2,
        directionalLightShadow: true,
        bumpScale : 1.0,
        roughness : 0.5,
        shininess : 0.5,
        texture: "wood1",
        near : 500,
        far : 25000,
        fov : 30
};
var geometry, material, plane, texture,
    normalMap, specularMap, roughnessMap,
    mesh, phongMaterial, stdMaterial, normalMaterial,
    meshPhong, meshStandard, meshNormal,
    pointLight1, pointLight2, directionalLight,
    near,far, fov;


var textureLoader = new THREE.TextureLoader();
var textureMap = {
    wood1: ["textures/wood/wood1/", 0xFFEEB0, undefined, undefined, undefined, undefined, undefined],
    wood2: ["textures/wood/wood2/", 0xa0522d, undefined, undefined, undefined, undefined, undefined],
    wood3: ["textures/wood/wood3/", 0xCD8500, undefined, undefined, undefined, undefined, undefined],
    cobble1: ["textures/cobblestone/cobble1/", 0x92806d, undefined, undefined, undefined, undefined, undefined],
    cobble2: ["textures/cobblestone/cobble2/", 0x878481, undefined, undefined, undefined, undefined, undefined],
    cobble3: ["textures/cobblestone/cobble3/", 0x95908c, undefined, undefined, undefined, undefined, undefined],
    roof1: ["textures/roofing/roof1/", 0xdeaf8a, undefined, undefined, undefined, undefined, undefined],
    roof2: ["textures/roofing/roof2/", 0xc5976d, undefined, undefined, undefined, undefined, undefined],
    roof3: ["textures/roofing/roof3/", 0xa37862, undefined, undefined, undefined, undefined, undefined],
    bricks1: ["textures/bricks/bricks1/", 0xaf7c63, undefined, undefined, undefined, undefined, undefined],
    bricks2: ["textures/bricks/bricks2/", 0xb4705f, undefined, undefined, undefined, undefined, undefined],
    bricks3: ["textures/bricks/bricks3/", 0xb18a6f, undefined, undefined, undefined, undefined, undefined],
    iceTexture: ["textures/others/iceTexture/", 0x6bb7e9, undefined, undefined, undefined, undefined, undefined],
    checker: ["textures/others/checker", 0x6bb7e9, undefined, undefined, undefined, undefined, undefined]
};

function init() {
    createScene();
    createUI();
    createLight();
    createShadow();
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

    directionalLight.intensity = params.directionalLight;
    directionalLight.castShadow = params.directionalLightShadow;

    directionalLight.shadowCameraNear = params.near;
    directionalLight.shadowCameraFar = params.far;
    directionalLight.shadowCameraFov = params.fov;

    pointLight1.intensity = params.pointLight1Power;
    pointLight1.castShadow = params.pointLight1Shadow;

    pointLight1.shadowCameraNear = params.near;
    pointLight1.shadowCameraFar = params.far;
    pointLight1.shadowCameraFov = params.fov;

    pointLight2.intensity = params.pointLight2Power;
    pointLight2.castShadow = params.pointLight2Shadow;

    pointLight2.shadowCameraNear = params.near;
    pointLight2.shadowCameraFar = params.far;
    pointLight2.shadowCameraFov = params.fov;

    stats.end();

    requestAnimationFrame( animate );
    controls.update();
    renderer.render( scene, camera );

}
function createScene() {
    renderer = new THREE.WebGLRenderer();
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.shadowMapEnabled = true;
    renderer.shadowMapSoft = true;

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
    //scene.add( new THREE.AmbientLight( 0x404040 ) );

    // White directional light at half intensity shining from the top.
    directionalLight = new THREE.DirectionalLight(0xdfebff, 1.75);
    directionalLight.position.set(300, 600, 50);
    directionalLight.position.multiplyScalar(1.3);

    scene.add(directionalLight);

    var dirLightHelper = new THREE.DirectionalLightHelper( directionalLight, 100 );
    scene.add( dirLightHelper );

    pointLight1 = new THREE.SpotLight( 0xffffff );
    pointLight1.position.set( 200,300, 400);
    pointLight1.angle = 180;
    scene.add( pointLight1 );

    var sphereSize = 10;
    var pointLightHelper1 = new THREE.PointLightHelper( pointLight1, sphereSize );
    scene.add( pointLightHelper1 );

    pointLight2 = new THREE.SpotLight( 0xffffff );
    pointLight2.position.set( -200,300, -400);
    pointLight2.angle = 180;

    scene.add( pointLight2 );

    var sphereSize = 10;
    var pointLightHelper2 = new THREE.PointLightHelper( pointLight2, sphereSize );
    scene.add( pointLightHelper2 );
}
function createShadow(){

    var d = 2000;

//directionaLight
    directionalLight.castShadow = true;
    directionalLight.shadowCameraVisible = true;

    directionalLight.shadowMapWidth = 1024;
    directionalLight.shadowMapHeight = 1024;

    directionalLight.shadowCameraNear = params.near;
    directionalLight.shadowCameraFar = params.far;
    directionalLight.shadowCameraFov = params.fov;

    directionalLight.shadowCameraLeft = -d;
    directionalLight.shadowCameraRight = d;
    directionalLight.shadowCameraTop = d;
    directionalLight.shadowCameraBottom = -d;

    directionalLight.shadowDarkness = 0.2;

//point light 1
    pointLight1.castShadow = true;
    pointLight1.shadowCameraVisible = true;

    pointLight1.shadowMapWidth = 1024;
    pointLight1.shadowMapHeight = 1024;

    pointLight1.shadowCameraNear = params.near;
    pointLight1.shadowCameraFar = params.far;
    pointLight1.shadowCameraFov = params.fov;

    pointLight1.shadowCameraLeft = -d;
    pointLight1.shadowCameraRight = d;
    pointLight1.shadowCameraTop = d;
    pointLight1.shadowCameraBottom = -d;

    pointLight1.shadowDarkness = 0.2;
    pointLight1.shadowBias = 0.001;

//point light 2
    pointLight2.castShadow = true;
    pointLight2.shadowCameraVisible = true;

    pointLight2.shadowMapWidth = 1024;
    pointLight2.shadowMapHeight = 1024;

    pointLight2.shadowCameraNear = params.near;
    pointLight2.shadowCameraFar = params.far;
    pointLight2.shadowCameraFov = params.fov;

    pointLight2.shadowCameraLeft = -d;
    pointLight2.shadowCameraRight = d;
    pointLight2.shadowCameraTop = d;
    pointLight2.shadowCameraBottom = -d;

    pointLight2.shadowDarkness = 0.2;
    pointLight2.shadowBias = 0.001;

}
function createObjects() {
    texture = new THREE.TextureLoader().load( "textures/wood/wood1/Base_Color.jpg" );
    normalMap = new THREE.TextureLoader().load( "textures/wood/wood1/Normal.jpg" );
    roughnessMap = new THREE.TextureLoader().load( "textures/wood/wood1/Roughness.jpg" );

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

    //BoxGeometry(width : Float, height : Float, depth : Float, widthSegments : Integer, heightSegments : Integer, depthSegments : Integer)
    //var planeGeometry = new THREE.PlaneGeometry( 2000, 2000);
    var planeGeometry = new THREE.BoxGeometry(2000, 2000, 10, 100, 100, 5);
    var planeMaterial = new THREE.MeshPhongMaterial( {
        color: 0xCD8500,
        side: THREE.DoubleSide,
        map: new THREE.TextureLoader().load( "textures/wood/wood3/Base_Color.jpg",    async function ( map ) {
            textureMap["checker"][2] = map;
            map.name = "checker";
            map.wrapS = map.wrapT = THREE.RepeatWrapping;
            map.anisotropy = 16;
            map.repeat.set(4, 4);
        })} );
    plane = new THREE.Mesh( planeGeometry, planeMaterial );
    plane.rotation.x = Math.PI / 2;
    plane.position.y = -150;
    plane.material.normalMap = new THREE.TextureLoader().load( "textures/wood/wood3/Normal.jpg" );
    plane.material.normalMap.wrapS = plane.material.normalMap.wrapT = THREE.RepeatWrapping;
    plane.material.normalMap.repeat.set(4, 4);
    plane.material.bumpMap = new THREE.TextureLoader().load( "textures/wood/wood3/Bump.jpg" );
    plane.material.bumpMap.wrapS = plane.material.bumpMap.wrapT = THREE.RepeatWrapping;
    plane.material.bumpMap.repeat.set(4, 4);
    plane.receiveShadow = true;
    scene.add( plane );
}
function createUI(){
//stats
    stats = new Stats();
    stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom
//dat
    gui = new dat.GUI();

    var objects = gui.addFolder('Objects');
    objects.add(params, 'speed', -0.1, 0.1).name('speed');

    function updateCamera() {
        camera.updateProjectionMatrix();
    }
    var view = gui.addFolder('Camera');

    view.add(camera, 'fov', 1, 180).onChange(updateCamera);
    const minMaxGUIHelper = new MinMaxGUIHelper(camera, 'near', 'far', 0.1);
    view.add(minMaxGUIHelper, 'min', 0.1, 10000, 0.1).name('near').onChange(updateCamera);
    view.add(minMaxGUIHelper, 'max', 0.1, 25000, 0.1).name('far').onChange(updateCamera);

    var lights = gui.addFolder('Lights');
    lights.add(params, 'pointLight1Power', 0.0, 3.0);
    lights.add(params, 'pointLight1Shadow');
    lights.add(params, 'pointLight2Power', 0.0, 3.0);
    lights.add(params, 'pointLight2Shadow');
    lights.add(params, 'directionalLight', 0.0, 3.0);
    lights.add(params, 'directionalLightShadow');

    var textures = gui.addFolder('Textures');
    textures.add(params, 'bumpScale', -1.0, 1.0);
    textures.add(params, 'roughness', 0.0, 1.0);
    textures.add(params, 'shininess', 0.0, 1.0);

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
            textureLoader.load( textureMap[key][0] + "Base_Color.jpg",
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
            textureLoader.load( textureMap[key][0] + "Bump.jpg",
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
            textureLoader.load( textureMap[key][0] + "Normal.jpg",
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
            textureLoader.load( textureMap[key][0] + "Roughness.jpg",
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
            textureLoader.load( textureMap[key][0] + "Ambient_Occlusion.jpg",
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
    meshNormal.material = new THREE.MeshLambertMaterial( {
        map: textureMap[value][2],
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
class MinMaxGUIHelper {
    constructor(obj, minProp, maxProp, minDif) {
        this.obj = obj;
        this.minProp = minProp;
        this.maxProp = maxProp;
        this.minDif = minDif;
    }
    get min() {
        return this.obj[this.minProp];
    }
    set min(v) {
        this.obj[this.minProp] = v;
        this.obj[this.maxProp] = Math.max(this.obj[this.maxProp], v + this.minDif);
    }
    get max() {
        return this.obj[this.maxProp];
    }
    set max(v) {
        this.obj[this.maxProp] = v;
        this.min = this.min;  // this will call the min setter
    }
}

var textureMapPromise = new Promise(async function(resolve, reject) {
    await populateTextureMap();
    resolve();
});
textureMapPromise.then(function(value) {
    init();
    animate();
});
