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
    constructor() {
        this.stats = new Stats();
        this.stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom

        this.params = {
            speed : 0.001,
            pointLightPower: 0,
            directionalLightPower: 0.7,
            bumpScaleX : 1.0,
            bumpScaleY : 1.0,
            shaderBumpScaleX : 1.0,
            shaderBumpScaleY : 1.0,
            stdBumpScaleX : 1.0,
            stdBumpScaleY : 1.0,
            ao: 1,
            roughness : 0.8,
            metalness : 0,
            shininess : 128,
            texture: "metal3",
            skyBox: "bethnal",
            texOriginX: 0.5,
            texOriginY: 0.5,
            texRotation: 0,
            repeatU : 1,
            repeatV : 1,
            offsetU: 0,
            offsetV: 0,
            normalMap: true,
            envMap: true,
            shape: "Sphere",
            near : 500,
            far : 25000,
            fov : 30,
            add: function(){ console.log() },
        };
        this.gui = new dat.GUI();
        this.minMaxGUIHelper = new MinMaxGUIHelper(app.camera, 'near', 'far', 0.1);

        //lights
        this.lights = this.gui.addFolder('Lights');
        this.lights.add(this.params, 'pointLightPower', 0.0, 3.0).onChange(function(value) {
            for (var i = 0; i < app.light.pointLights.length ; i++) {
                app.light.pointLights[i].intensity = value > 0.2 ? value: 0;

                app.light.pointLights[i].bulb.material.emissiveIntensity = value  > 0.2 ? value + 0.2: 0;
                app.light.pointLights[i].bulb.material.opacity = value > 0.2 ? 1: 0.5;
            }
        });
        this.lights.add(this.params, 'directionalLightPower', 0.0, 3.0).onChange(function(value) {
            app.light.directionalLight.intensity = value > 0.2 ? value: 0;

            app.light.directionalLight.bulb.material.emissiveIntensity = value > 0.2 ? value + 0.2: 0;
            app.light.directionalLight.bulb.material.opacity = value > 0.2 ? 1: 0.5;

        });

        //objects
        this.objects = this.gui.addFolder('Objects');
        this.objects.add(this.params, 'speed', -0.1, 0.1).name('speed');
        this.objects.add(this.params, 'shape', Shape.getShapes() ).name("basic shape").onChange(function(value) {
            app.selectedShape = value;
            Shape.changeShape(value);
        });

        //material
        this.material = this.gui.addFolder('Material');

        this.material.phong = this.material.addFolder('Phong');
        this.material.phong.add(this.params, 'shininess', 1, 500.0).onChange(function(value) {
            var meshes = app.meshes;
            for (var i = 0; i < meshes.length; i++) {
                if(meshes[i].material.uniforms.shininess) {
                   meshes[i].material.uniforms.shininess.value = value;
                   meshes[i].material.uniformsNeedUpdate = true;
                   meshes[i].material.needsUpdate = true;
                }
            }
        });
        this.material.PBR = this.material.addFolder('PBR');
        this.material.PBR.add(this.params, 'roughness', 0, 1.0).onChange(function(value) {
            var mesh;
            for (var j = 0; j < app.meshes.length; j++) {
                mesh = app.meshes[j];
                if (mesh.material.uniforms.roughness) {
                    mesh.material.uniforms.roughness.value = value;
                    mesh.material.uniformsNeedUpdate = true;
                    mesh.material.needsUpdate = true;
                }
            }
        });
        this.material.PBR.add(this.params, 'metalness', 0, 1.0).onChange(function(value) {
            var mesh;
            for (var j = 0; j < app.meshes.length; j++) {
                mesh = app.meshes[j];
                if (mesh.material.uniforms.metalness) {
                    mesh.material.uniforms.metalness.value = value;
                    mesh.material.uniformsNeedUpdate = true;
                    mesh.material.needsUpdate = true;
                }
            }
        });
        this.material.add(this.params, 'envMap', 0, 1000.0).name("Environment Map").onChange(function(value) {
            var mesh, materialType;
            for (var j = 0; j < app.meshes.length; j++) {
                mesh = app.meshes[j];
                materialType = mesh.material.type;
                mesh.material.dispose();
                mesh.material = new Material(SHADER[materialType]);
                mesh.material.defaultAttributeValues.uv = new Float32Array(mesh.geometry.attributes.uv.array);
                mesh.material.needsUpdate = true;
                mesh.material.uniformsNeedsUpdate = true;
            }
        });
        this.material.add(this.params, 'normalMap', 0, 1000.0).name("Normal Map").onChange(function(value) {
            var mesh, materialType;
            for (var j = 0; j < app.meshes.length; j++) {
                mesh = app.meshes[j];
                materialType = mesh.material.type;
                mesh.material.dispose();
                mesh.material = new Material(SHADER[materialType]);
                mesh.material.defaultAttributeValues.uv = new Float32Array(mesh.geometry.attributes.uv.array);
                mesh.material.needsUpdate = true;
                mesh.material.uniformsNeedsUpdate = true;
            }
        });
        this.material.add(this.params, 'bumpScaleX', -1.0, 1.0).name("bump scale X").onChange(function(value) {
            var mesh, bumpScaleY;
            for (var j = 0; j < app.meshes.length; j++) {
                mesh = app.meshes[j];
                if (app.gui.params.normalMap) {
                    bumpScaleY = mesh.material.uniforms.normalScale.value.y;
                    mesh.material.uniforms.normalScale.value.set(value, bumpScaleY);
                } else {
                    mesh.material.uniforms.bumpScale.value = value;
                    mesh.material.uniforms.bumpMap.needsUpdate = true;
                }
                mesh.material.needsUpdate = true;
                mesh.material.uniformsNeedUpdate = true;
            }
        });
        this.material.add(this.params, 'bumpScaleY', -1.0, 1.0).name("bump scale Y").onChange(function(value) {
            var mesh, bumpScaleX;
            for (var j = 0; j < app.meshes.length; j++) {
                mesh = app.meshes[j];
                if (!!app.gui.params.normalMap) {
                    bumpScaleX = mesh.material.uniforms.normalScale.value.x;
                    mesh.material.uniforms.normalScale.value.set(bumpScaleX, value);
                    mesh.material.uniforms.normalMap.needsUpdate = true;
                } else {
                    mesh.material.uniforms.bumpScale.value = value;
                    mesh.material.uniforms.bumpMap.needsUpdate = true;
                }
                mesh.material.uniformsNeedUpdate = true;
                mesh.material.needsUpdate = true;
            }
        });
        this.material.add(this.params, 'ao', 0, 1.0).name("AO").onChange(function(value) {
            var mesh, bumpScaleX;
            for (var j = 0; j < app.meshes.length; j++) {
                mesh = app.meshes[j];
                mesh.material.uniforms.aoMapIntensity.value = value;

                mesh.material.uniformsNeedsUpdate = true;
                mesh.material.needsUpdate = true;
            }
        });

        //textures
        this.textures = this.gui.addFolder('Textures');
        this.textures.add(this.params,'add').name("load texture");
        this.textures.add(this.params, 'skyBox', app.textures.getSkyboxKeys() ).onChange(function(value) {
            app.scene.background = app.skyboxMap[value][1];
            var mesh, materialType;
            for (var j = 0; j < app.meshes.length; j++) {
                mesh = app.meshes[j];
                materialType = mesh.material.type;
                mesh.material.dispose();
                mesh.material = new Material(SHADER[materialType]);
                mesh.material.defaultAttributeValues.uv = new Float32Array(mesh.geometry.attributes.uv.array);
                mesh.material.needsUpdate = true;
                mesh.material.uniformsNeedsUpdate = true;
            }
        });
        this.textures.add(this.params, 'texture', app.textures.getTextureKeys() ).onChange(function(value) {
            var mesh;
            for (var j = 0; j < app.meshes.length; j++) {
                mesh = app.meshes[j];

                mesh.material.applyMaps(value);
                mesh.material.setTexturesCenter(app.gui.params.texOriginY, app.gui.params.texOriginY);
                mesh.material.applyRepeat(app.gui.params.repeatU, app.gui.params.repeatV);

                mesh.material.updateUvs(mesh);
                mesh.needsUpdate = true;
            }
        });
        this.textures.add(this.params, 'texOriginX',0, 1).name("origin X").onChange(function(value) {
            var mesh;
            for (var j = 0; j < app.meshes.length; j++) {
                mesh = app.meshes[j];
                mesh.material.setTexturesCenter(app.gui.params.texOriginX, app.gui.params.texOriginY);
                mesh.material.setTexturesRotation(app.gui.params.texRotation);
                mesh.material.applyOffset(app.gui.params.offsetU, app.gui.params.offsetV, mesh);
                mesh.material.updateUvs(mesh);
                mesh.material.needsUpdate = true;

            }
        });
        this.textures.add(this.params, 'texOriginY',0, 1).name("origin Y").onChange(function(value) {
            var mesh;
            for (var j = 0; j < app.meshes.length; j++) {
                mesh = app.meshes[j];
                mesh.material.setTexturesCenter(app.gui.params.texOriginX, value);
                mesh.material.updateUvs(mesh);
                mesh.material.uniformsNeedUpdate = true;
                mesh.material.needsUpdate = true;

            }
        });

        this.textures.add(this.params, 'texRotation',0, 360).name("rotation").onChange(function(value) {
            var mesh;
            for (var j = 0; j < app.meshes.length; j++) {
                mesh = app.meshes[j];
                mesh.material.setTexturesRotation(value, mesh);
                mesh.material.updateUvs(mesh);

                mesh.material.uniformsNeedUpdate = true;
                mesh.material.needsUpdate = true;
            }
        });

        this.textures.add(this.params, 'repeatU',1, 50).name("repeat U").onChange(function(value) {
            var mesh, repeatV;
            for (var j = 0; j < app.meshes.length; j++) {
                mesh = app.meshes[j];
                repeatV = mesh.material.map.repeat.y;
                mesh.material.applyRepeat(value, repeatV, mesh);
                mesh.material.updateUvs(mesh);

                mesh.material.needsUpdate = true;
                mesh.material.uniformsNeedsUpdate = true;
            }
        });

        this.textures.add(this.params, 'repeatV',1, 50).name("repeat V").onChange(function(value) {
            var mesh, repeatU;
            for (var j = 0; j < app.meshes.length; j++) {
                mesh = app.meshes[j];
                repeatU = mesh.material.map.repeat.x;
                mesh.material.applyRepeat(repeatU, value, mesh);
                mesh.material.updateUvs(mesh);

                mesh.material.needsUpdate = true;
                mesh.material.uniformsNeedsUpdate = true;

            }
        });
        this.textures.add(this.params, 'offsetU',0, 1).name("offset U").onChange(function(value) {
            var mesh, offsetV;
            debugger;
            for (var j = 0; j < app.meshes.length; j++) {
                mesh = app.meshes[j];
                offsetV = mesh.material.map.offset.y;
                mesh.material.applyOffset(value, offsetV, mesh);
                mesh.material.updateUvs(mesh);

                mesh.material.needsUpdate = true;
                mesh.material.uniformsNeedsUpdate = true;
            }
        });

        this.textures.add(this.params, 'offsetV',0, 1).name("offset V").onChange(function(value) {
            var mesh, offsetU;
            debugger;
            for (var j = 0; j < app.meshes.length; j++) {
                mesh = app.meshes[j];
                offsetU = mesh.material.map.offset.x;
                mesh.material.applyOffset(offsetU, value, mesh);
                mesh.material.updateUvs(mesh);

                mesh.material.needsUpdate = true;
                mesh.material.uniformsNeedsUpdate = true;

            }
        });

        //camera
        this.view = this.gui.addFolder('Camera');
        this.view.add(app.camera, 'fov', 1, 180).onChange(this.updateCamera);
        this.view.add(this.minMaxGUIHelper, 'min', 0.1, 10000, 0.1).name('near').onChange(this.updateCamera);
        this.view.add(this.minMaxGUIHelper, 'max', 0.1, 25000, 0.1).name('far').onChange(this.updateCamera);
    }
    updateCamera() {
        app.camera.updateProjectionMatrix();
    }
    async init() {

        return this;
    }
}
