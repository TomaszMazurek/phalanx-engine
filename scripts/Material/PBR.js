class PBR extends THREE.MeshStandardMaterial{
    constructor(texture){
        super({
            color : new THREE.Color(textureMap['wood1'][1]),
            map : textureMap['wood1'][2].clone(),
            bumpMap : textureMap['wood1'][3].clone(),
            normalMap : textureMap['wood1'][4].clone(),
            roughnessMap : textureMap['wood1'][5].clone(),
            aoMap : textureMap['wood1'][6].clone(),
            roughness : 0.8,
            metalness : 0,
            bumpScale : 1,
            side : THREE.DoubleSide
      });

        this.map.repeat.set(1, 1);
        this.bumpMap.repeat.set(1, 1);
        this.normalMap.repeat.set(1, 1);
        this.roughnessMap.repeat.set(1, 1);
        this.aoMap.repeat.set(1, 1);

        this.map.needsUpdate = true;
        this.bumpMap.needsUpdate = true;
        this.roughnessMap.needsUpdate = true;
        this.normalMap.needsUpdate = true;
        this.aoMap.needsUpdate = true;

    }

    applyMaps(mapName){
        this.color = new THREE.Color(textureMap[mapName][1]);

        this.map = textureMap[mapName][2].clone();
        this.map.needsUpdate = true;



        if(params.stdNormalMap){
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
    }

    rotate(angle = 0, center){
        this.map.rotation = (angle * (Math.PI/180));
    }
}