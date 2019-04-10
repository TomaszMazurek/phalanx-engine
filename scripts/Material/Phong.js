class Phong extends THREE.MeshPhongMaterial{
    constructor(){
        super({
            color : new THREE.Color(textureMap['wood1'][1]),
            map : textureMap['wood1'][2].clone(),
            bumpMap : textureMap['wood1'][3].clone(),
            normalMap : textureMap['wood1'][4].clone(),
            aoMap : textureMap['wood1'][6].clone(),
            specularMap : textureMap['wood1'][2].clone(),
            specular : new THREE.Color(textureMap['wood1'][1]),
            bumpScale : 1,
            shininess : 128,
            side : THREE.DoubleSide
        });

        this.map.repeat.set(1, 1);
        this.bumpMap.repeat.set(1, 1);
        this.normalMap.repeat.set(1, 1);
        this.aoMap.repeat.set(1, 1);
        this.specularMap.repeat.set(1, 1);

        this.map.needsUpdate = true;
        this.bumpMap.needsUpdate = true;
        this.normalMap.needsUpdate = true;
        this.aoMap.needsUpdate = true;
        this.specularMap.needsUpdate = true;
    }


    applyMaps(mapName){
        this.color = new THREE.Color(textureMap[mapName][1]);
        this.specular = new THREE.Color(textureMap['wood1'][1]);

        this.map = textureMap[mapName][2].clone();
        this.bumpMap = textureMap[mapName][3].clone();
        this.aoMap = textureMap[mapName][6].clone();
        this.specularMap = textureMap[mapName][6].clone();

        this.map.needsUpdate = true;
        this.bumpMap.needsUpdate = true;
        this.aoMap.needsUpdate = true;
        this.specularMap.needsUpdate = true;

        if(params.normalMap){
            this.normalMap = textureMap[mapName][4].clone();
            this.normalMap.needsUpdate = true;
        }
    }

    applyRepeat(valueX, valueY){
        this.map.repeat.set(valueX, valueY);
        this.bumpMap.repeat.set(valueX, valueY);
        if(params.normalMap) {
            this.normalMap.repeat.set(valueX, valueY);
        }
        this.aoMap.repeat.set(valueX, valueY);
        this.specularMap.repeat.set(valueX, valueY);
    }

}