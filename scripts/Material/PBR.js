class PBR extends THREE.MeshStandardMaterial{
    constructor(){
        super();
        this.color = new THREE.Color(textureMap['wood1'][1]);

        this.map = textureMap['wood1'][2].clone();
        this.map.needsUpdate = true;
        this.map.repeat.set(1, 1);

        this.bumpMap = textureMap['wood1'][3].clone();
        this.bumpMap.needsUpdate = true;
        this.bumpMap.repeat.set(1, 1);
        this.bumpScale = 1;

        this.normalMap = textureMap['wood1'][4].clone();
        this.normalMap.repeat.set(1, 1);

        this.roughnessMap = textureMap['wood1'][5].clone();
        this.roughnessMap.needsUpdate = true;
        this.roughnessMap.repeat.set(1, 1);

        this.aoMap = textureMap['wood1'][6].clone();
        this.aoMap.needsUpdate = true;
        this.aoMap.repeat.set(1, 1);

        this.roughness = 0.8;
        this.metalness = 0;

        this.side = THREE.DoubleSide;
        this.map.needsUpdate = true;
    }

    applyMaps(mapName){
        this.color = new THREE.Color(textureMap[mapName][1]);

        this.map = textureMap[mapName][2].clone();
        this.map.needsUpdate = true;

        this.bumpMap = textureMap[mapName][3].clone();
        this.bumpMap.needsUpdate = true;

        this.normalMap = textureMap[mapName][4].clone();
        this.normalMap.needsUpdate = true;

        this.aoMap = textureMap[mapName][6].clone();
        this.aoMap.needsUpdate = true;
    }

    applyRepeat(valueX, valueY){
        this.map.repeat.set(valueX, valueY);
        this.bumpMap.repeat.set(valueX, valueY);
        this.normalMap.repeat.set(valueX, valueY);
        this.aoMap.repeat.set(valueX, valueY);
    }
}