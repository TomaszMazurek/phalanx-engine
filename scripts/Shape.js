class Shape {
    constructor(){
        this.phong = null;
        this.standard = null
        this.create();
    }

    getGeometry() {
        switch (selectedShape) {
            case "Box" :
                return new THREE.BoxGeometry(170,170,170);
                break;
            case "Circle":
                return new THREE.CircleGeometry( 170, 32 );
                break;
            case 'Cone':
                return new THREE.ConeGeometry( 150, 200, 32 );
                break;
            case 'Cylinder':
                return new THREE.CylinderGeometry( 100, 100, 200, 32 );
                break;
            case 'Dodecahedron':
                return new THREE.DodecahedronGeometry( 150 );
                break;
            case 'Icosahedron':
                return new THREE.IcosahedronGeometry( 150 );
                break;
            case 'Octahedron':
                return new THREE.OctahedronGeometry( 150 );
                break;
            case 'Sphere':
                return new THREE.SphereGeometry( 120, 32, 32 );
                break;
            case 'Tetrahedron':
                return new THREE.TetrahedronGeometry( 150 );
                break;
            case 'Torus':
                return new THREE.TorusGeometry( 100, 40, 16, 100 );
                break;
            case 'TorusKnot':
                return new THREE.TorusKnotGeometry( 100, 40, 16, 100 );
                break;
        }
    }

    create(){
        phongMaterial = new Phong();

        meshPhong = new THREE.Mesh( this.getGeometry(), phongMaterial );
        meshPhong.position.set(200,50,0);
        meshPhong.castShadow = true;
        meshPhong.receiveShadow = false;
        scene.add( meshPhong );
        this.phong = meshPhong;

        stdMaterial = new PBR();

        meshStandard = new THREE.Mesh( this.getGeometry(), stdMaterial );
        meshStandard.position.set(-200,50,0);
        meshStandard.castShadow = true;
        meshStandard.receiveShadow = false;
        scene.add( meshStandard );

        this.standard = meshStandard;
    }

    changeShape(){
        this.phong.geometry.dispose();
        this.phong.geometry = this.getGeometry();
        this.phong.geometry.needsUpdate = true;
        shape.phong.material.applyRepeat(params.repeatU, params.repeatV);
        this.phong.material.needsUpdate = true;

        this.standard.geometry.dispose();
        this.standard.geometry = this.getGeometry();
        this.standard.geometry.needsUpdate = true;
        shape.standard.material.applyRepeat(params.repeatU, params.repeatV);
        this.standard.material.needsUpdate = true;
    }

}