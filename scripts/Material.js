class Material extends THREE.ShaderMaterial{
    constructor(shader){
        super({
            uniforms: shader.data.uniforms,
            vertexShader: shader.data.vertexShader,
            fragmentShader: shader.data.fragmentShader,
            lights:true,
            defines: {
                USE_MAP : "",
                USE_BUMPMAP: "",
                USE_SPECULARMAP: "",
                USE_AOMAP: "",
                USE_COLOR: ""
            },
            fog: false,
            type: shader.type
        });
        if(app.gui.params.normalMap){
            this.defines["USE_NORMALMAP"] = "";
            var newNormalMap = app.textureMap[app.gui.params.texture][4].clone();
            this.uniforms.normalMap.value = newNormalMap;
            this.normalMap = newNormalMap;
            this.uniforms.normalScale.value = new THREE.Vector2(1, 1);
            this.normalMap.needsUpdate = true;
            this.uniforms.normalMap.value.needsUpdate = true;
        }
        this.color = new THREE.Color(app.textureMap[app.gui.params.texture][1]);
        this.uniforms.diffuse.value = new THREE.Color(app.textureMap[app.gui.params.texture][1]);

        var newTexture = app.textureMap[app.gui.params.texture][2].clone();
        this.uniforms.map.value = newTexture;
        this.map = newTexture;

        var newBumpMap = app.textureMap[app.gui.params.texture][3].clone();
        this.uniforms.bumpMap.value = newBumpMap;
        this.bumpMap = newBumpMap;

        var newAOMap = app.textureMap[app.gui.params.texture][6].clone();
        this.uniforms.aoMap.value = newAOMap;
        this.aoMap = newAOMap;

/*
        var envMap = app.skyboxMap["skyBox"][1].clone();
        this.uniforms.envMap.value = envMap;
        this.envMap = envMap;
*/

        if(this.uniforms.specularMap) {
            var newSpecularMap = app.textureMap[app.gui.params.texture][2].clone();
            this.uniforms.specularMap.value = newSpecularMap;
            this.specularMap = newSpecularMap;
            this.uniforms.specularMap.needsUpdate = true;
            this.uniforms.specular.needsUpdate = true;
            this.specularMap.needsUpdate = true;
        }

        if(this.uniforms.shininess){
            this.uniforms.shininess.value = 128;
            this.uniforms.shininess.needsUpdate = true;
        }

        this.uniforms.bumpScale.value = 1;
        this.side = THREE.FrontSide;

        this.uniforms.map.needsUpdate = true;
        this.map.needsUpdate = true;

        this.uniforms.bumpMap.needsUpdate = true;
        this.bumpMap.needsUpdate = true;

        this.uniforms.aoMap.needsUpdate = true;
        this.aoMap.needsUpdate = true;

/*        this.uniforms.envMap.needsUpdate = true;
        this.envMap.needsUpdate = true;*/

        this.uniforms.bumpScale.needsUpdate = true;

        this.needsUpdate = true;
    }
    static SHADER = {
        PHONG : {data: THREE.ShaderLib.phong, type: "PHONG" },
        PBR : {data: THREE.ShaderLib.standard, type: "PBR" }
    };
    applyMaps(mapName){
        this.color = new THREE.Color(app.textureMap[mapName][1]);
        this.uniforms.diffuse.value = new THREE.Color(app.textureMap[mapName][1]);

        var newTexture = app.textureMap[mapName][2].clone();
        this.uniforms.map.value = newTexture;
        this.map = newTexture;
        this.map.needsUpdate = true;

        if(app.gui.params.normalMap){
            var newNormalMap = app.textureMap[mapName][4].clone();
            this.uniforms.normalMap.value = newNormalMap;
            this.normalMap = newNormalMap;
            this.normalMap.needsUpdate = true;
        } else {
            this.normalMap = null;
            var newBumpMap = app.textureMap[mapName][3].clone();
            this.uniforms.bumpMap.value = newBumpMap;
            this.bumpMap = newBumpMap;
            this.bumpMap.needsUpdate = true;
        }

        var newSpecularMap = app.textureMap[mapName][2].clone();
        if(this.uniforms.specularMap) {
            this.uniforms.specularMap.value = newSpecularMap;
            this.specularMap = newSpecularMap;
            this.specularMap.needsUpdate = true;
        }

        var newAOMap = app.textureMap[mapName][6].clone();
        this.uniforms.aoMap.value = newAOMap;
        this.aoMap = newAOMap;
        this.aoMap.needsUpdate = true;

        this.uniformsNeedUpdate = true;
        this.needsUpdate = true;
    }
    applyRepeat(valueX, valueY){
        if(this.uniforms.map.value) this.uniforms.map.value.repeat.set(valueX, valueY);
        if(this.map) this.map.repeat.set(valueX, valueY);
        this.uniforms.map.needsUpdate = true;
        this.map.needsUpdate = true;

        //Ambient Occlusion
        var i2,u,v;
        if(this.uniforms.aoMap.value) {
            this.uniforms.aoMap.value.repeat.set(valueX, valueY);
            for (var j = 0; j < app.meshes.length; j++) {
                var mesh = app.meshes[j];
                for (var i = 0; i < mesh.geometry.attributes.uv.array.length / 2; i++) {
                    i2 = i * 2;
                    u = mesh.material.defaultAttributeValues.uv[i2] * this.aoMap.repeat.x;
                    v = mesh.material.defaultAttributeValues.uv[i2 + 1] * this.aoMap.repeat.y;
                    mesh.geometry.attributes.uv.array[i2] = u;
                    mesh.geometry.attributes.uv2.array[i2] = u;
                    mesh.geometry.attributes.uv.array[i2 + 1] = v;
                    mesh.geometry.attributes.uv2.array[i2 + 1] = v;
                }
                mesh.geometry.attributes.uv.needsUpdate = true;
                mesh.geometry.attributes.uv2.needsUpdate = true;

            }
            this.uniforms.aoMap.value.needsUpdate = true;
            this.uniforms.aoMap.needsUpdate = true;

        }
        if(this.uniforms.bumpMap.value) {
            this.uniforms.bumpMap.value.repeat.set(valueX, valueY);
            this.uniforms.bumpMap.needsUpdate = true;
        }
        if(this.uniforms.normalMap.value) {
            this.uniforms.normalMap.value.repeat.set(valueX, valueY);
            this.uniforms.normalMap.needsUpdate = true;
        }
        if(this.uniforms.specularMap && this.uniforms.specularMap.value) {
            this.uniforms.specularMap.value.repeat.set(valueX, valueY);
            this.uniforms.specularMap.needsUpdate = true;
        }

        this.uniformsNeedUpdate = true;
        this.needsUpdate = true;
    }
    setTexturesRotation(angle = 0){
        debugger;
        var rotation = (angle * (Math.PI/180));
        this.uniforms.map.value.rotation = rotation;
        this.map.rotation = rotation;
        if(app.gui.params.normalMap) {
            this.uniforms.normalMap.value.rotation = rotation;
        } else {
            this.uniforms.bumpMap.value.rotation = rotation;
        }
        this.uniforms.aoMap.value.rotation = rotation;
    }
    setTexturesCenter(centerX, centerY){
    }

}