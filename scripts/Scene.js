class Scene extends THREE.Scene {
    constructor(){
        super();
        this.background = new THREE.Color( 'skyblue');
        this.light = new Light(this);
        this.createWalls();
    }
    getMeshes(){
        return this.shapes;
    }
    createWalls() {
        var plane;
        var planeGeometry = new THREE.BoxGeometry(2000, 2000, 10, 100, 100, 5);
        var planeMaterial = new THREE.MeshPhongMaterial( {
            color: new THREE.Color(app.textureMap['cobble3'][1]),
            map        :  app.textureMap['cobble3'][2].clone(),
            bumpMap  :  app.textureMap['cobble3'][3].clone(),
            normalMap  :  app.textureMap['cobble3'][4].clone(),
            bumpScale  :  1
        });

        planeMaterial.map.repeat.set(8, 8);
        planeMaterial.map.needsUpdate = true;
        planeMaterial.bumpMap.repeat.set(8, 8);
        planeMaterial.bumpMap.needsUpdate = true;
        planeMaterial.normalMap.repeat.set(8, 8);
        planeMaterial.normalMap.needsUpdate = true;

        plane = new THREE.Mesh( planeGeometry, planeMaterial );
        plane.rotation.x = Math.PI / 2;
        plane.position.y = -150;
        plane.receiveShadow = true;
        this.add( plane );
    };
}
