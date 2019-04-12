class Shader extends THREE.ShaderMaterial{
    constructor(){
        super({
            uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.phong.uniforms),
            vertexShader: THREE.ShaderLib.phong.vertexShader,
            fragmentShader: THREE.ShaderLib.phong.fragmentShader,
            lights:true,
            defines: {USE_MAP : ""},
            fog: false
        });

        this.uniforms.color = new THREE.Color(textureMap['wood1'][1]);
        this.color = new THREE.Color(textureMap['wood1'][1]);
        var newTexture = textureMap['wood1'][2].clone()
        this.uniforms.map.value = newTexture;
        this.map = newTexture;
        var newBumpMap = textureMap['wood1'][3].clone();

        this.uniforms.bumpMap.value = newBumpMap;
        this.bumpMap = newBumpMap;

        var newNormalMap = textureMap['wood1'][4].clone();
        this.uniforms.normalMap.value = newNormalMap;
        this.normalMap = newNormalMap;

        var newAOMap = textureMap['wood1'][6].clone();
        this.uniforms.aoMap.value = newAOMap;
        this.aoMap = newAOMap;

        var newSpecularMap = textureMap['wood1'][2].clone();

        this.uniforms.specularMap.value = newSpecularMap;
        this.specularMap = newSpecularMap;

        this.uniforms.specular.value = new THREE.Color(textureMap['wood1'][1]);

        this.uniforms.bumpScale.value = 1;
        this.uniforms.shininess.value = 128;
        this.side = THREE.DoubleSide;

        this.uniforms.map.needsUpdate = true;
        this.map.needsUpdate = true;
        this.uniforms.bumpMap.needsUpdate = true;
        this.bumpMap.needsUpdate = true;
        this.uniforms.normalMap.needsUpdate = true;
        this.normalMap.needsUpdate = true;
        this.uniforms.aoMap.needsUpdate = true;
        this.aoMap.needsUpdate = true;
        this.uniforms.specular.needsUpdate = true;
        this.uniforms.bumpScale.needsUpdate = true;
        this.uniforms.shininess.needsUpdate = true;
    }

    applyMaps(mapName){

    }

    applyRepeat(valueX, valueY){

    }

    setTexturesRotation(angle = 0){

    }
    setTexturesCenter(centerX, centerY){

    }

}