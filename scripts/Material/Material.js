class Material extends THREE.Material{
    constructor(){
        super();
        this.materialMap = {
            wireframe: [undefined, undefined],
            phong: [undefined, undefined],
            pbr: [undefined, undefined],
            lambert: [undefined, undefined],
        };
    }

}