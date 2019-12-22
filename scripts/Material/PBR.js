class PBR extends Shader {
    constructor(texture){
        super();
        this.pbr = true;
        this.uniforms = THREE.UniformsUtils.merge( [
                THREE.ShaderLib.standard.uniforms,
                {
                    emissive: { value: new THREE.Color( 0x000000 ) },
                    roughness: { value: 0.8 },
                    metalness : { value: 0 },
                }
            ] );
        this.vertexShader = THREE.ShaderLib.standard.vertexShader;
        this.fragmentShader = THREE.ShaderLib.standard.fragmentShader;

        this.uniforms.roughness.needsUpdate = true;
        this.uniforms.metalness.needsUpdate = true;

    }
/*
    applyMaps(mapName){
        this.color = new THREE.Color(textureMap[mapName][1]);

        this.map = textureMap[mapName][2].clone();
        this.map.needsUpdate = true;

        if(guiInstance.params.stdNormalMap){
            this.normalMap = textureMap[mapName][4].clone();
            this.normalMap.needsUpdate = true;
        } else {
            this.normalMap = null;
            this.bumpMap = textureMap[mapName][4].clone();
            this.bumpMap.needsUpdate = true;
        }

        this.roughnessMap = textureMap[mapName][5].clone();
        this.roughnessMap.needsUpdate = true;

        this.aoMap = textureMap[mapName][6].clone();
        this.aoMap.needsUpdate = true;
    }

    applyRepeat(valueX, valueY){
        this.map.repeat.set(valueX, valueY);
        this.bumpMap.repeat.set(valueX, valueY);
        if(params.normalMap) {
            this.normalMap.repeat.set(valueX, valueY);
        }
        this.aoMap.repeat.set(valueX, valueY);
        this.roughnessMap.repeat.set(valueX, valueY);

        var i2,u,v;
        for (var i = 0; i < shape.standard.geometry.attributes.uv.array.length/2; i++) {
            i2 = i*2;
            u = shape.standard.geometry.attributes.uv.array[i2]*this.aoMap.repeat.x;
            v = shape.standard.geometry.attributes.uv.array[i2+1]*this.aoMap.repeat.y;
            shape.standard.geometry.attributes.uv2.array[i2] = u;
            shape.standard.geometry.attributes.uv2.array[i2+1] = v;
        }
        shape.standard.geometry.attributes.uv2.needsUpdate = true;
        shape.standard.material.aoMap.needsUpdate = true;

        this.map.needsUpdate = true;
        this.bumpMap.needsUpdate = true;
        this.aoMap.needsUpdate = true;
        this.roughnessMap.needsUpdate = true;

        this.needsUpdate = true;
    }

    setTexturesRotation(angle = 0){
        var rotation = (angle * (Math.PI/180));
        this.map.rotation = rotation;
        if(guiInstance.params.stdNormalMap) {
            this.normalMap.rotation = rotation;
        } else {
            this.bumpMap.rotation = rotation;
        }
        this.roughnessMap.rotation = rotation;
        this.aoMap.rotation = rotation;
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
        this.roughnessMap.center.set(center);
        this.aoMap.center.set(center);

        this.map.needsUpdate = true;
        this.aoMap.needsUpdate = true;
        this.roughnessMap.needsUpdate = true;
    }*/
}