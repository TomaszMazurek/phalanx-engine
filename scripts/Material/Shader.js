class Shader extends THREE.ShaderMaterial{
    constructor(){
        super({
            uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.phong.uniforms),
            vertexShader: THREE.ShaderLib.phong.vertexShader,
            fragmentShader: THREE.ShaderLib.phong.fragmentShader,
            lights:true,
            defines: {
                USE_MAP : "",
                USE_BUMPMAP: "",
                USE_SPECULARMAP: "",
                USE_AOMAP: "",
                USE_COLOR: ""
            },
            fog: false
        });

        if(params.shaderNormalMap){
            this.defines["USE_NORMALMAP"] = "";
            var newNormalMap = textureMap[params.texture][4].clone();
            this.uniforms.normalMap.value = newNormalMap;
            this.normalMap = newNormalMap;
            this.uniforms.normalScale.value = new THREE.Vector2(1, 1);
            this.normalMap.needsUpdate = true;
            this.uniforms.normalMap.value.needsUpdate = true;
        }
        this.color = new THREE.Color(textureMap[params.texture][1]);
        this.uniforms.diffuse.value = new THREE.Color(textureMap[params.texture][1]);

        var newTexture = textureMap[params.texture][2].clone();
        this.uniforms.map.value = newTexture;
        this.map = newTexture;

        var newBumpMap = textureMap[params.texture][3].clone();
        this.uniforms.bumpMap.value = newBumpMap;
        this.bumpMap = newBumpMap;

        var newAOMap = textureMap[params.texture][6].clone();
        this.uniforms.aoMap.value = newAOMap;
        this.aoMap = newAOMap;

        var newSpecularMap = textureMap[params.texture][2].clone();
        this.uniforms.specularMap.value = newSpecularMap;
        this.specularMap = newSpecularMap;

        //this.uniforms.specular.value = new THREE.Color(textureMap['wood1'][1]);

        this.uniforms.bumpScale.value = 1;
        this.uniforms.shininess.value = 128;
        this.side = THREE.DoubleSide;

        this.uniforms.map.needsUpdate = true;
        this.map.needsUpdate = true;

        this.uniforms.bumpMap.needsUpdate = true;
        this.bumpMap.needsUpdate = true;

        this.uniforms.aoMap.needsUpdate = true;
        this.aoMap.needsUpdate = true;

        this.uniforms.specularMap.needsUpdate = true;
        this.specularMap.needsUpdate = true;

        this.uniforms.specular.needsUpdate = true;
        this.uniforms.bumpScale.needsUpdate = true;
        this.uniforms.shininess.needsUpdate = true;

        this.needsUpdate = true;

    }

    applyMaps(mapName){
        this.color = new THREE.Color(textureMap[mapName][1]);
        this.uniforms.diffuse.value = new THREE.Color(textureMap[mapName][1]);

        //this.uniforms.specular.value = new THREE.Color(textureMap[mapName][1]);
        //this.uniforms.specular.needsUpdate = true;

        var newTexture = textureMap[mapName][2].clone();
        this.uniforms.map.value = newTexture;
        this.map = newTexture;
        this.map.needsUpdate = true;

        if(params.shaderNormalMap){
            var newNormalMap = textureMap[mapName][4].clone();
            this.uniforms.normalMap.value = newNormalMap;
            this.normalMap = newNormalMap;
            this.normalMap.needsUpdate = true;
        } else {
            this.normalMap = null;
            var newBumpMap = textureMap[mapName][3].clone();
            this.uniforms.bumpMap.value = newBumpMap;
            this.bumpMap = newBumpMap;
            this.bumpMap.needsUpdate = true;
        }

        var newSpecularMap = textureMap[mapName][2].clone();
        this.uniforms.specularMap.value = newSpecularMap;
        this.specularMap = newSpecularMap;
        this.specularMap.needsUpdate = true;

        var newAOMap = textureMap[mapName][6].clone();
        this.uniforms.aoMap.value = newAOMap;
        this.aoMap = newAOMap;
        this.aoMap.needsUpdate = true;

        this.uniformsNeedUpdate = true;
        this.needsUpdate = true;
    }

    applyRepeat(valueX, valueY){
        this.uniforms.map.value.repeat.set(valueX, valueY);
        this.map.repeat.set(valueX, valueY);
        this.uniforms.map.needsUpdate = true;
        this.map.needsUpdate = true;

        //Ambient Occlusion
        var i2,u,v;
        this.uniforms.aoMap.value.repeat.set(valueX, valueY);
        for (var i = 0; i < shape.shader.geometry.attributes.uv.array.length/2; i++) {
            i2 = i*2;
            u = this.defaultAttributeValues.uv[i2] * this.aoMap.repeat.x;
            v = this.defaultAttributeValues.uv[i2+1] * this.aoMap.repeat.y;
            shape.shader.geometry.attributes.uv.array[i2] = u;
            shape.shader.geometry.attributes.uv2.array[i2] = u;
            shape.shader.geometry.attributes.uv.array[i2+1] = v;
            shape.shader.geometry.attributes.uv2.array[i2+1] = v;
        }

        shape.shader.geometry.attributes.uv.needsUpdate = true;
        shape.shader.geometry.attributes.uv2.needsUpdate = true;

        this.uniforms.aoMap.value.needsUpdate = true;
        this.uniforms.aoMap.needsUpdate = true;

        this.uniforms.bumpMap.value.repeat.set(valueX, valueY);
        if(params.phongNormalMap) {
            this.uniforms.normalMap.value.repeat.set(valueX, valueY);
            this.uniforms.normalMap.needsUpdate = true;
        }
        this.uniforms.bumpMap.needsUpdate = true;

        this.uniforms.specularMap.value.repeat.set(valueX, valueY);
        this.uniforms.specularMap.needsUpdate = true;

        this.uniformsNeedUpdate = true;
        this.needsUpdate = true;
    }

    setTexturesRotation(angle = 0){

    }
    setTexturesCenter(centerX, centerY){

    }

}