class Normal extends THREE.MeshPhongMaterial{
    constructor(){
        super({
            flatShading: false,
            color : new THREE.Color(0x4ad7ff),
            shininess : 128
        });
    }

    applyMaps(mapName){}

    applyRepeat(valueX, valueY){}

    setTexturesRotation(angle = 0){}

    setTexturesCenter(centerX, centerY){}

}