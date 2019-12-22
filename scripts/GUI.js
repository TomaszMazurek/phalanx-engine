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
    constructor(scene) {
        this.scene = scene;
        this.stats = new Stats();
        this.stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom

        this.params = {
            speed : 0.001,
            pointLightPower: 0,
            pointLightShadow: true,
            directionalLightPower: 0.7,
            directionalLightShadow: true,
            phongBumpScaleX : 1.0,
            phongBumpScaleY : 1.0,
            shaderBumpScaleX : 1.0,
            shaderBumpScaleY : 1.0,
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
            repeatU : 1,
            repeatV : 1,
            normalMap: true,
            shape: "Box",
            near : 500,
            far : 25000,
            fov : 30,
            add: function(){ console.log() },
        };
        this.gui = new dat.GUI();
        this.minMaxGUIHelper = new MinMaxGUIHelper(scene.camera, 'near', 'far', 0.1);

        //lights
        this.lights = this.gui.addFolder('Lights');
        this.lights.add(this.params, 'pointLightPower', 0.0, 3.0).onChange(function(value) {
            for (i = 0; i < scene.light.pointLights.length ; i++) {
                scene.light.pointLights[i].intensity = value > 0.2 ? value: 0;

                scene.light.pointLights[i].bulb.material.emissiveIntensity = value  > 0.2 ? value + 0.2: 0;
                scene.light.pointLights[i].bulb.material.opacity = value > 0.2 ? 1: 0.5;

                scene.light.pointLights[i].shadow.camera.near = this.params.near;
                scene.light.pointLights[i].shadow.camera.far = this.params.far;
                scene.light.pointLights[i].shadow.camera.fov = this.params.fov;
            }
        });
        this.lights.add(this.params, 'pointLightShadow').onChange(function(value) {
            for (i = 0; i < scene.light.pointLights.length ; i++) {
                scene.light.pointLights[i].castShadow = value;
            }
        });
        this.lights.add(this.params, 'directionalLightPower', 0.0, 3.0).onChange(function(value) {
            scene.light.directionalLight.intensity = value > 0.2 ? value: 0;

            scene.light.directionalLight.bulb.material.emissiveIntensity = value > 0.2 ? value + 0.2: 0;
            scene.light.directionalLight.bulb.material.opacity = value > 0.2 ? 1: 0.5;

            scene.light.directionalLight.shadow.camera.near = this.params.near;
            scene.light.directionalLight.shadow.camera.far = this.params.far;
            scene.light.directionalLight.shadow.camera.fov = this.params.fov;

        });
        this.lights.add(this.params, 'directionalLightShadow').onChange(function(value) {
            scene.light.directionalLight.castShadow = value;
        });

        //objects
        this.objects = this.gui.addFolder('Objects');
        this.objects.add(this.params,'add').name("load object");
        this.objects.add(this.params, 'speed', -0.1, 0.1).name('speed');
        this.objects.add(this.params, 'shape', Shape.getShapes() ).name("basic shape").onChange(function(value) {
            selectedShape = value;
            shape.changeShape(value);
        });

        //material
        this.material = this.gui.addFolder('Material');

        this.material.phong = this.material.addFolder('Phong');
        this.material.phong.add(this.params, 'shininess', 0, 500.0).onChange(function(value) {
            for (var j = 0; j < sceneInstance.scene.children.length; j++) {
                var child = sceneInstance.scene.children[j];
                if (child.name === "meshObject" && child.material.phong) {
                    child.material.uniforms.shininess.value = value;
                    child.material.needsUpdate = true;
                }
            }
        });
        this.material.phong.add(this.params, 'phongBumpScaleX', -1.0, 1.0).name("bump scale X").onChange(function(value) {
            if(this.params.normalMap){
                var bumpScaleY = meshPhong.material.normalScale.y;
                meshPhong.material.normalScale.set(value,bumpScaleY);
            } else {
                meshPhong.material.bumpScale = value;
                meshPhong.material.bumpMap.needsUpdate = true;
            }
            meshPhong.material.needsUpdate = true;
        });
        this.material.phong.add(this.params, 'phongBumpScaleY', -1.0, 1.0).name("bump scale Y").onChange(function(value) {
            if(!!this.params.normalMap){
                var bumpScaleX = meshPhong.material.normalScale.x;
                meshPhong.material.normalScale.set(bumpScaleX, value);
                meshPhong.material.normalMap.needsUpdate = true;
            } else {
                meshPhong.material.bumpScale = value;
                meshPhong.material.bumpMap.needsUpdate = true;
            }
            meshPhong.material.needsUpdate = true;
        });

/*        this.material.shader = this.material.addFolder('Shader');
        this.material.shader.add(this.params, 'shininess', 0, 500.0).onChange(function(value) {
            meshShader.material.uniforms.shininess.value = value;
            meshShader.material.uniforms.needsUpdate = true;
        });
        this.material.shader.add(this.params, 'shaderNormalMap', 0, 1000.0).name("Normal Map").onChange(function(value) {
            for (var j = 0; j < sceneInstance.scene.children.length; j++) {
                var child = sceneInstance.scene.children[j];
                if (child.name === "meshObject") {
                    child.material.dispose();
                    child.material = new Shader();
                    child.material.defaultAttributeValues.uv = new Float32Array(child.geometry.attributes.uv.array);
                    child.material.needsUpdate = true;
                }
            }
        });
        this.material.shader.add(this.params, 'shaderBumpScaleX', -1.0, 1.0).name("bump scale X").onChange(function(value) {
            if(this.params.shaderNormalMap){
                var bumpScaleY = meshShader.material.uniforms.normalScale.value.y;
                meshShader.material.uniforms.normalScale.value.set(value,bumpScaleY);
            } else {
                shape.shader.material.uniforms.bumpScale.value = value;
                shape.shader.material.uniforms.bumpMap.needsUpdate = true;
            }
            shape.shader.material.needsUpdate = true;
        });
        this.material.shader.add(this.params, 'shaderBumpScaleY', -1.0, 1.0).name("bump scale Y").onChange(function(value) {
            if(!!this.params.shaderNormalMap){
                var bumpScaleX = meshShader.material.uniforms.normalScale.value.x;
                meshShader.material.uniforms.normalScale.value.set(bumpScaleX, value);
                meshShader.material.uniforms.normalMap.needsUpdate = true;
            } else {
                shape.shader.material.uniforms.bumpScale.value = value;
                shape.shader.material.uniforms.bumpMap.needsUpdate = true;
            }
            meshShader.material.needsUpdate = true;
        });*/

        this.material.PBR = this.material.addFolder('PBR');
        this.material.PBR.add(this.params, 'roughness', 0, 1.0).onChange(function(value) {
            meshStandard.material.roughness = value;
            meshStandard.material.needsUpdate = true;
        });
        this.material.PBR.add(this.params, 'metalness', 0, 1.0).onChange(function(value) {
            meshStandard.material.metalness = value;
            meshStandard.material.needsUpdate = true;
        });
/*        this.material.PBR.add(this.params, 'stdNormalMap', 0, 1000.0).name("Normal Map").onChange(function(value) {
            if(value) {
                meshStandard.material.normalMap = textureMap[this.params.texture][4].clone();
                meshStandard.material.normalMap.repeat.set(this.params.repeatU, this.params.repeatV);
                meshStandard.material.normalMap.needsUpdate = true;
            } else {
                meshStandard.material.normalMap = null;
                meshStandard.material.bumpMap = textureMap[this.params.texture][4].clone();
                meshStandard.material.bumpMap.needsUpdate = true;
            }
            meshStandard.material.needsUpdate = true;

        });*/
        this.material.PBR.add(this.params, 'stdBumpScaleX', -1.0, 1.0).name("bump scale X").onChange(function(value) {
            if(this.params.normalMap){
                var bumpScaleY = meshStandard.material.normalScale.y;

                meshStandard.material.normalScale.set(value,bumpScaleY);
            } else {
                meshStandard.material.bumpScale = value;
            }
            meshStandard.material.needsUpdate = true;
        });
        this.material.PBR.add(this.params, 'stdBumpScaleY', -1.0, 1.0).name("bump scale Y").onChange(function(value) {
            if(this.params.normalMap){
                var bumpScaleX = meshStandard.material.normalScale.x;
                meshStandard.material.normalScale.set(bumpScaleX, value);
            } else {
                var bumpScaleX = meshStandard.material.bumpScale.x;
                meshStandard.material.bumpScale = value;
            }
            meshStandard.material.needsUpdate = true;
        });

        this.material.add(this.params, 'normalMap', 0, 1000.0).name("Normal Map").onChange(function(value) {
            for (var j = 0; j < sceneInstance.scene.children.length; j++) {
                var child = sceneInstance.scene.children[j];
                if (child.name === "meshObject") {
                    var bumpMap = textureMap[guiInstance.params.texture][4].clone();
                    var materialType = child.material.type;
                    child.material.dispose();
                    child.material = new Material(Material.SHADER[materialType]);
                    child.material.defaultAttributeValues.uv = new Float32Array(child.geometry.attributes.uv.array);
                    child.material.needsUpdate = true;
                    child.material.uniformsNeedsUpdate = true;
                }
            }
        });
        this.material.add(this.params, 'ao', 0, 1.0).name("AO").onChange(function(value) {
            meshPhong.material.aoMapIntensity = value;
            meshShader.material.uniforms.aoMapIntensity.value = value;
            meshStandard.material.aoMapIntensity = value;

            meshPhong.material.needsUpdate = true;
            meshShader.material.uniformsNeedsUpdate = true;
            meshStandard.material.needsUpdate = true;
        });

        //textures
        this.textures = this.gui.addFolder('Textures');
        this.textures.add(this.params, 'texture', [ 'wood1', 'wood2','wood3','wood4', 'cobble1','cobble2',
            'cobble3','roof1', 'roof2','roof3', 'bricks1','bricks2', 'bricks3', 'iceTexture'] ).onChange(function(value) {
            for (var j = 0; j < sceneInstance.scene.children.length; j++) {
                var child = sceneInstance.scene.children[j];
                if (child.name === "meshObject") {
                    child.material.applyMaps(value);
                    child.material.applyMaps(value);

                    child.material.applyRepeat(guiInstance.params.repeatU, guiInstance.params.repeatV);
                    child.material.applyRepeat(guiInstance.params.repeatU, guiInstance.params.repeatV);

                    child.needsUpdate = true;
                    child.needsUpdate = true;
                }
            }
        });
        this.textures.add(this.params, 'texOriginX',0, 360).name("origin X").onChange(function(value) {
            for (var j = 0; j < sceneInstance.scene.children.length; j++) {
                var child = sceneInstance.scene.children[j];
                if (child.name === "meshObject") {
                    child.material.setTexturesCenter(value, guiInstance.params.texOriginY);
                    child.material.setTexturesCenter(value, guiInstance.params.texOriginY);

                    child.material.needsUpdate = true;
                    child.material.needsUpdate = true;
                }
            }
        });
        this.textures.add(this.params, 'texOriginY',0, 360).name("origin Y").onChange(function(value) {
            shape.phong.material.setTexturesCenter( this.params.texOriginX, value);
            shape.standard.material.setTexturesCenter( this.params.texOriginY, value);

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
            for (var j = 0; j < sceneInstance.scene.children.length; j++) {
                var child = sceneInstance.scene.children[j];
                if (child.name === "meshObject") {
                    var repeatV = child.material.map.repeat.y;
                    child.material.applyRepeat(value, repeatV);
                    child.material.applyRepeat(value, repeatV);

                    child.material.needsUpdate = true;
                    child.material.uniformsNeedsUpdate = true;

                    child.material.needsUpdate = true;
                    child.material.uniformsNeedsUpdate = true;
                }
            }
        });

        this.textures.add(this.params, 'repeatV',1, 50).name("repeat V").onChange(function(value) {
            for (var j = 0; j < sceneInstance.scene.children.length; j++) {
                var child = sceneInstance.scene.children[j];
                if (child.name === "meshObject") {
                    var repeatU = child.material.map.repeat.x;
                    child.material.applyRepeat(repeatU, value);
                    child.material.applyRepeat(repeatU, value);

                    child.material.needsUpdate = true;
                    child.material.uniformsNeedsUpdate = true;
                    child.material.needsUpdate = true;
                    child.material.needsUpdate = true;
                }
            }
        });

        //camera
        this.view = this.gui.addFolder('Camera');
        this.view.add(this.scene.camera, 'fov', 1, 180).onChange(this.updateCamera);
        this.view.add(this.minMaxGUIHelper, 'min', 0.1, 10000, 0.1).name('near').onChange(this.updateCamera);
        this.view.add(this.minMaxGUIHelper, 'max', 0.1, 25000, 0.1).name('far').onChange(this.updateCamera);
    }
    updateCamera() {
        this.scene.camera.updateProjectionMatrix();
    }
    async init() {

        return this;
    }
}
