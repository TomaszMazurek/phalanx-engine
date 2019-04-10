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

class GUI {
    constructor(camera) {
        this.stats = new Stats();
        this.stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom

        this.params = {
            speed : 0.001,
            pointLightPower: 0.5,
            pointLightShadow: true,
            directionalLightPower: 0.7,
            directionalLightShadow: true,
            phongBumpScaleX : 1.0,
            phongBumpScaleY : 1.0,
            stdBumpScaleX : 1.0,
            stdBumpScaleY : 1.0,
            ao: 1,
            roughness : 0.8,
            metalness : 0,
            shininess : 128,
            texture: "wood1",
            texOriginX: 0,
            texOriginY: 0,
            texRotation: 0,
            repeatU : 2,
            repeatV : 2,
            phongNormalMap: true,
            stdNormalMap: true,
            shape: "Sphere",
            near : 500,
            far : 25000,
            fov : 30,
            add: function(){ console.log() },
        };
        this.gui = new dat.GUI();
        this.minMaxGUIHelper = new MinMaxGUIHelper(camera, 'near', 'far', 0.1);

        //lights
        this.lights = this.gui.addFolder('Lights');
        this.lights.add(this.params, 'pointLightPower', 0.0, 3.0).onChange(function(value) {
            for (i = 0; i < light.pointLights.length ; i++) {
                light.pointLights[i].intensity = value > 0.2 ? value: 0;

                light.pointLights[i].bulb.material.emissiveIntensity = value  > 0.2 ? value + 0.2: 0;
                light.pointLights[i].bulb.material.opacity = value > 0.2 ? 1: 0.5;

                light.pointLights[i].shadow.camera.near = params.near;
                light.pointLights[i].shadow.camera.far = params.far;
                light.pointLights[i].shadow.camera.fov = params.fov;
            }
        });
        this.lights.add(this.params, 'pointLightShadow').onChange(function(value) {
            for (i = 0; i < light.pointLights.length ; i++) {
                light.pointLights[i].castShadow = value;
            }
        });
        this.lights.add(this.params, 'directionalLightPower', 0.0, 3.0).onChange(function(value) {
            light.directionalLight.intensity = value > 0.2 ? value: 0;

            light.directionalLight.bulb.material.emissiveIntensity = value > 0.2 ? value + 0.2: 0;
            light.directionalLight.bulb.material.opacity = value > 0.2 ? 1: 0.5;

            light.directionalLight.shadow.camera.near = params.near;
            light.directionalLight.shadow.camera.far = params.far;
            light.directionalLight.shadow.camera.fov = params.fov;

        });
        this.lights.add(this.params, 'directionalLightShadow').onChange(function(value) {
            light.directionalLight.castShadow = value;
        });

        //objects
        this.objects = this.gui.addFolder('Objects');
        this.objects.add(this.params,'add').name("load object");
        this.objects.add(this.params, 'speed', -0.1, 0.1).name('speed');
        this.objects.add(this.params, 'shape', [ 'Box',  'Sphere', 'Cone', 'Cylinder', 'Torus', 'TorusKnot', 'Dodecahedron', 'Icosahedron',
            'Octahedron','Tetrahedron', 'Circle'] ).name("basic shape").onChange(function(value) {
            selectedShape = value;
            shape.changeShape();
        });

        //material
        this.material = this.gui.addFolder('Material');

        this.material.phong = this.material.addFolder('Phong');
        this.material.phong.add(this.params, 'shininess', 0, 500.0).onChange(function(value) {
            meshPhong.material.shininess = value;
            meshPhong.material.needsUpdate = true;
        });
        this.material.phong.add(this.params, 'phongNormalMap', 0, 1000.0).name("Normal Map").onChange(function(value) {
            if(value) {
                meshPhong.material.normalMap = textureMap[params.texture][4].clone();
                meshPhong.material.normalMap.repeat.set(params.repeatU, params.repeatV);
                meshPhong.material.normalMap.needsUpdate = true;
            } else {
                meshPhong.material.normalMap = null;
                meshPhong.material.bumpMap = textureMap[params.texture][4].clone();
                meshPhong.material.bumpMap.needsUpdate = true;
            }
            meshPhong.material.needsUpdate = true;

        });
        this.material.phong.add(this.params, 'phongBumpScaleX', -1.0, 1.0).name("bump scale X").onChange(function(value) {
            if(params.phongNormalMap){
                var bumpScaleY = meshPhong.material.normalScale.y;
                meshPhong.material.normalScale.set(value,bumpScaleY);
            } else {
                meshPhong.material.bumpScale = value;
                meshPhong.material.bumpMap.needsUpdate = true;
            }
            meshPhong.material.needsUpdate = true;
        });
        this.material.phong.add(this.params, 'phongBumpScaleY', -1.0, 1.0).name("bump scale Y").onChange(function(value) {
            if(!!params.phongNormalMap){
                var bumpScaleX = meshPhong.material.normalScale.x;
                meshPhong.material.normalScale.set(bumpScaleX, value);
                meshPhong.material.normalMap.needsUpdate = true;
            } else {
                meshPhong.material.bumpScale = value;
                meshPhong.material.bumpMap.needsUpdate = true;
            }
            meshPhong.material.needsUpdate = true;
        });

        this.material.PBR = this.material.addFolder('PBR');
        this.material.PBR.add(this.params, 'roughness', 0, 1.0).onChange(function(value) {
            meshStandard.material.roughness = value;
            meshStandard.material.needsUpdate = true;
        });
        this.material.PBR.add(this.params, 'metalness', 0, 1.0).onChange(function(value) {
            meshStandard.material.metalness = value;
            meshStandard.material.needsUpdate = true;
        });
        this.material.PBR.add(this.params, 'stdNormalMap', 0, 1000.0).name("Normal Map").onChange(function(value) {
            if(value) {
                meshStandard.material.normalMap = textureMap[params.texture][4].clone();
                meshStandard.material.normalMap.repeat.set(params.repeatU, params.repeatV);
                meshStandard.material.normalMap.needsUpdate = true;
            } else {
                meshStandard.material.normalMap = null;
                meshStandard.material.bumpMap = textureMap[params.texture][4].clone();
                meshStandard.material.bumpMap.needsUpdate = true;
            }
            meshStandard.material.needsUpdate = true;

        });
        this.material.PBR.add(this.params, 'stdBumpScaleX', -1.0, 1.0).name("bump scale X").onChange(function(value) {
            if(params.phongNormalMap){
                var bumpScaleY = meshStandard.material.normalScale.y;

                meshStandard.material.normalScale.set(value,bumpScaleY);
            } else {
                meshStandard.material.bumpScale = value;
            }
            meshStandard.material.needsUpdate = true;
        });
        this.material.PBR.add(this.params, 'stdBumpScaleY', -1.0, 1.0).name("bump scale Y").onChange(function(value) {
            if(params.phongNormalMap){
                var bumpScaleX = meshStandard.material.normalScale.x;
                meshStandard.material.normalScale.set(bumpScaleX, value);
            } else {
                var bumpScaleX = meshStandard.material.bumpScale.x;
                meshStandard.material.bumpScale = value;
            }
            meshStandard.material.needsUpdate = true;
        });
        this.material.add(this.params, 'ao', 0, 1.0).name("AO").onChange(function(value) {
            meshPhong.material.aoMapIntensity = value;
            meshStandard.material.aoMapIntensity = value;

            meshPhong.material.needsUpdate = true;
            meshStandard.material.needsUpdate = true;
        });

        //textures
        this.textures = this.gui.addFolder('Textures');
        this.textures.add(this.params, 'texture', [ 'wood1', 'wood2','wood3', 'cobble1','cobble2',
            'cobble3','roof1', 'roof2','roof3', 'bricks1','bricks2', 'bricks3', 'iceTexture'] ).onChange(function(value) {
            shape.phong.material.applyMaps(value);
            shape.standard.material.applyMaps(value);

            shape.phong.material.applyRepeat(params.repeatU, params.repeatV);
            shape.standard.material.applyRepeat(params.repeatU, params.repeatV);

            shape.phong.needsUpdate = true;
            shape.standard.needsUpdate = true;
        });
        this.textures.add(this.params, 'texOriginX',0, 360).name("origin X").onChange(function(value) {
            shape.phong.material.setTexturesCenter(value,params.texOriginY);
            shape.standard.material.setTexturesCenter(value, params.texOriginY);

            meshPhong.material.needsUpdate = true;
            meshStandard.material.needsUpdate = true;
        });
        this.textures.add(this.params, 'texOriginY',0, 360).name("origin Y").onChange(function(value) {
            shape.phong.material.setTexturesCenter(params.texOriginX, value);
            shape.standard.material.setTexturesCenter(params.texOriginY, value);

            meshPhong.material.needsUpdate = true;
            meshStandard.material.needsUpdate = true;
        });
        this.textures.add(this.params, 'texRotation',0, 360).name("rotation").onChange(function(value) {
            shape.phong.material.setTexturesRotation(value);
            shape.standard.material.setTexturesRotation(value);

            meshPhong.material.needsUpdate = true;
            meshStandard.material.needsUpdate = true;
        });
        this.textures.add(this.params, 'repeatU',1, 50).name("repeat U").onChange(function(value) {
            var repeatV = shape.phong.material.map.repeat.y;
            shape.phong.material.applyRepeat(value, repeatV);
            shape.standard.material.applyRepeat(value, repeatV);

            meshPhong.material.needsUpdate = true;
            meshStandard.material.needsUpdate = true;
        });
        this.textures.add(this.params, 'repeatV',1, 50).name("repeat V").onChange(function(value) {
            var repeatU = shape.phong.material.map.repeat.x;
            shape.phong.material.applyRepeat(repeatU, value);
            shape.standard.material.applyRepeat(repeatU, value);

            meshPhong.material.needsUpdate = true;
            meshStandard.material.needsUpdate = true;
        });

        //camera
        this.view = this.gui.addFolder('Camera');
        this.view.add(camera, 'fov', 1, 180).onChange(this.updateCamera);
        this.view.add(this.minMaxGUIHelper, 'min', 0.1, 10000, 0.1).name('near').onChange(this.updateCamera);
        this.view.add(this.minMaxGUIHelper, 'max', 0.1, 25000, 0.1).name('far').onChange(this.updateCamera);
    }

    updateCamera() {
        camera.updateProjectionMatrix();
    }

    async init() {

        return this;
    }
}
