class Phong extends Shader {
    constructor(){
        super();
        this.phong = true;
        this.uniforms = THREE.UniformsUtils.merge( [
            THREE.ShaderLib.phong.uniforms,
            {
                emissive: { value: new THREE.Color( 0x000000 ) },
                specular: { value: new THREE.Color( 0x111111 ) },
                shininess: { value: 30 }
            }]);
        this.vertexShader = THREE.ShaderLib.phong.vertexShader;
        this.fragmentShader = THREE.ShaderLib.phong.fragmentShader;

        var newSpecularMap = app.textureMap[app.gui.params.texture][2].clone();
        this.uniforms.specularMap.value = newSpecularMap;
        this.specularMap = newSpecularMap;
        this.uniforms.specular.needsUpdate = true;
        this.specularMap.needsUpdate = true;

        this.uniforms.shininess.value = 128;
        this.uniforms.shininess.needsUpdate = true;

    }

/*
    applyMaps(mapName){
        this.color = new THREE.Color(textureMap[mapName][1]);

        this.map = textureMap[mapName][2].clone();
        this.aoMap = textureMap[mapName][6].clone();
        this.specularMap = textureMap[mapName][2].clone();

        this.map.needsUpdate = true;
        this.aoMap.needsUpdate = true;
        this.specularMap.needsUpdate = true;

        if(sceneInstance.params.phongNormalMap){
            this.normalMap = textureMap[mapName][4].clone();
            this.normalMap.needsUpdate = true;
        } else {
            this.normalMap = null;
            this.bumpMap = textureMap[mapName][4].clone();
            this.bumpMap.needsUpdate = true;
        }
    }

    applyRepeat(valueX, valueY){
        this.map.repeat.set(valueX, valueY);
        this.bumpMap.repeat.set(valueX, valueY);
        if(guiInstance.params.phongNormalMap) {
            this.normalMap.repeat.set(valueX, valueY);
            this.normalMap.needsUpdate = true;
        }
        this.aoMap.repeat.set(valueX, valueY);
        this.specularMap.repeat.set(valueX, valueY);

        var i2,u,v;
        for (var i = 0; i < shape.phong.geometry.attributes.uv.array.length/2; i++) {
            i2 = i*2;
            u = shape.phong.geometry.attributes.uv.array[i2]*this.aoMap.repeat.x;
            v = shape.phong.geometry.attributes.uv.array[i2+1]*this.aoMap.repeat.y;
            shape.phong.geometry.attributes.uv2.array[i2] = u;
            shape.phong.geometry.attributes.uv2.array[i2+1] = v;
        }
        shape.phong.geometry.attributes.uv2.needsUpdate = true;
        shape.phong.material.aoMap.needsUpdate = true;

        this.map.needsUpdate = true;
        this.bumpMap.needsUpdate = true;
        this.aoMap.needsUpdate = true;
        this.specularMap.needsUpdate = true;

        this.needsUpdate = true;
    }

    setTexturesRotation(angle = 0){
        var rotation = (angle * (Math.PI/180));
        this.map.rotation = rotation;
        if(guiInstance.params.phongNormalMap) {
            this.normalMap.rotation = rotation;
        } else {
            this.bumpMap.rotation = rotation;
        }
        this.aoMap.rotation = rotation;
        this.specularMap.rotation = rotation;
    }
    setTexturesCenter(centerX, centerY){
        var center = new THREE.Vector2(centerX, centerY);

        this.map.center = center;
        if(guiInstance.params.phongNormalMap) {
            this.normalMap.center.set(center);
            this.normalMap.needsUpdate = true;
        } else {
            this.bumpMap.center.set(center);
            this.bumpMap.needsUpdate = true;
        }
        this.aoMap.center.set(center);
        this.specularMap.center.set(center);

        this.map.needsUpdate = true;
        this.aoMap.needsUpdate = true;
        this.specularMap.needsUpdate = true;
    }*/

}