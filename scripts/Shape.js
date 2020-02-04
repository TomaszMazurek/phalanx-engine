class Shape {
    constructor(){
    }

    static getShapes() {
        return [ 'Box',  'Sphere', 'Cone', 'Cylinder', 'Torus', 'TorusKnot', 'Dodecahedron', 'Icosahedron', 'Octahedron','Tetrahedron', 'Circle'];
    }
    static getParameters(shape){
        var parameters = {
            Box: [ 170, 170, 170 , undefined],
            Sphere: [ 120, 32, 32 , undefined],
            Circle: [ 170, 32 , undefined, undefined],
            Cone: [150, 200, 32 , undefined],
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
    static getGeometry(shapeName) {

        var parameters = Shape.getParameters(shapeName);
        var evalExpression =  "new THREE." + shapeName + "BufferGeometry(parameters[0], parameters[1], parameters[2], parameters[[3]]);";
        var geometry = eval(evalExpression);
        geometry.groups = [];
        var uvs = new Float32Array(geometry.attributes.uv.array);
        geometry.addAttribute( 'uv2', new THREE.BufferAttribute( uvs, 2 ) );
        return geometry;
    }
    static create(){
        var meshes = [];
        var phongMaterial = new Material(SHADER.PHONG);
        var meshPhong = new THREE.Mesh( Shape.getGeometry(app.gui.params.shape), phongMaterial );
        meshPhong.name = "meshObject";
        meshPhong.position.set(200,50,0);
        meshPhong.castShadow = true;
        meshPhong.receiveShadow = false;
        meshPhong.material.defaultAttributeValues.uv = new Float32Array(meshPhong.geometry.attributes.uv.array.slice());
        app.scene.add( meshPhong );
        meshes.push(meshPhong);

        var stdMaterial = new Material(SHADER.PBR);
        var meshStandard = new THREE.Mesh( Shape.getGeometry(app.gui.params.shape), stdMaterial );
        meshStandard.name = "meshObject";
        meshStandard.position.set(-200,50,0);
        meshStandard.castShadow = true;
        meshStandard.receiveShadow = false;
        meshStandard.material.defaultAttributeValues.uv = new Float32Array(meshStandard.geometry.attributes.uv.array.slice());
        app.scene.add( meshStandard );
        meshes.push(meshStandard);
        return meshes;
    }
    static changeShape(shapeName){
        var mesh;
        for (var i = 0; i < app.meshes.length; i++) {
            mesh = app.meshes[i];
            mesh.geometry.dispose();
            mesh.geometry = this.getGeometry(shapeName);
            mesh.geometry.needsUpdate = true;
            mesh.material.defaultAttributeValues.uv = app.meshes[i].geometry.attributes.uv.array.slice();
            mesh.material.updateUvs(mesh);
            mesh.material.needsUpdate = true;
            mesh.needsUpdate;
        }
    }
}
