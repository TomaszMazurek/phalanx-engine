class Shape {
    constructor(sceneInstance){
        this.scene = sceneInstance.scene;
        this.create();
    }

    static getShapes() {
        return [ 'Box',  'Sphere', 'Cone', 'Cylinder', 'Torus', 'TorusKnot', 'Dodecahedron', 'Icosahedron', 'Octahedron','Tetrahedron', 'Circle'];
    }
    static getParameters(shape){
        var parameters = {
            Box: [ 170, 170, 170 ],
            Sphere: [ 120, 32, 32 ],
            Circle: [ 170, 32 ],
            Cone: [150, 200, 32 ],
            Cylinder: [ 100, 100, 200, 32 ],
            Dodecahedron: [ 150 ],
            Icosahedron: [ 150 ],
            Octahedron: [ 150 ],
            Tetrahedron: [ 150 ],
            Torus: [ 100, 40, 16, 100 ],
            TorusKnot: [ 100, 40, 16, 100 ]
        };
        return parameters[shape];
    }
    getGeometry(shapeName) {

        var parameters = Shape.getParameters(shapeName);
        var evalExpression =  "new THREE." + shapeName + "BufferGeometry(parameters[0], parameters[1], parameters[2], parameters[[3]]);";
        var geometry = eval(evalExpression);
        var uvs = new Float32Array(geometry.attributes.uv.array);
        geometry.addAttribute( 'uv2', new THREE.BufferAttribute( uvs, 2 ) );
        return geometry;
    }
    create(){
        phongMaterial = new Material(Material.SHADER.PHONG);
        meshPhong = new THREE.Mesh( this.getGeometry(guiInstance.params.shape), phongMaterial );
        meshPhong.name = "meshObject";
        meshPhong.position.set(200,50,0);
        meshPhong.castShadow = true;
        meshPhong.receiveShadow = false;
        meshPhong.material.defaultAttributeValues.uv = new Float32Array(meshPhong.geometry.attributes.uv.array);
        this.scene.add( meshPhong );

        stdMaterial = new Material(Material.SHADER.PBR);
        meshStandard = new THREE.Mesh( this.getGeometry(guiInstance.params.shape), stdMaterial );
        meshStandard.name = "meshObject";
        meshStandard.position.set(-200,50,0);
        meshStandard.castShadow = true;
        meshStandard.receiveShadow = false;
        meshStandard.material.defaultAttributeValues.uv = new Float32Array(meshStandard.geometry.attributes.uv.array);
        this.scene.add( meshStandard );
    }
    changeShape(shapeName){
        for (var j = 0; j < sceneInstance.scene.children.length; j++) {
            var child = sceneInstance.scene.children[j];
            if (child.name === "meshObject") {
                child.geometry.dispose();
                child.geometry = this.getGeometry(shapeName);
                child.geometry.needsUpdate = true;
                child.material.applyRepeat(guiInstance.params.repeatU, guiInstance.params.repeatV);
                child.material.needsUpdate = true;
            }
        }
    }
    update(){
        for (var j = 0; j < sceneInstance.scene.children.length; j++) {
            var child = sceneInstance.scene.children[j];
            if (child.name === "meshObject") {
                child.needsUpdate = true;
                child.needsUpdate = true;
            }
        }
    }
}
