class Phong extends THREE.MeshPhongMaterial{
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
        this.normalMap.needsUpdate = true;
        this.normalMap.repeat.set(1, 1);

        this.aoMap = textureMap['wood1'][6].clone();
        this.aoMap.needsUpdate = true;
        this.aoMap.repeat.set(1, 1);

        this.shininess = 128;
        this.side = THREE.DoubleSide;
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
        this.map.needsUpdate = true;
    }

    applyRepeat(valueX, valueY){
        this.map.repeat.set(valueX, valueY);
        this.bumpMap.repeat.set(valueX, valueY);
        this.normalMap.repeat.set(valueX, valueY);
        this.aoMap.repeat.set(valueX, valueY);
    }
}