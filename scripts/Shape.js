class Shape {
    constructor(){
        this.phong = null;
        this.standard = null
        this.create();
    }


    getGeometry() {
        switch (selectedShape) {
            case "Box" :
                return new THREE.BoxGeometry(150,150,150);
                break;
            case "Circle":
                return new THREE.CircleGeometry( 150, 32 );
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
                return new THREE.SphereGeometry( 100, 32, 32 );
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
        phongMaterial = new THREE.MeshPhongMaterial({
            color      :  new THREE.Color(textureMap['wood1'][1]),
            shininess  :  0.1,
            map        :  textureMap['wood1'][2],
            bumpMap  :  textureMap['wood1'][3],
            normalMap  :  textureMap['wood1'][4],
            aoMap  :  textureMap['wood1'][6],
            bumpScale  :  1,
            specular : 0.1,
            side : THREE.DoubleSide
        });

        phongMaterial.map.repeat.set(1, 1);
        phongMaterial.bumpMap.repeat.set(1, 1);
        phongMaterial.normalMap.repeat.set(1, 1);

        meshPhong = new THREE.Mesh( this.getGeometry(), phongMaterial );
        meshPhong.position.set(200,50,0);
        meshPhong.castShadow = true;
        meshPhong.receiveShadow = false;
        scene.add( meshPhong );
        this.phong = meshPhong;

        stdMaterial = new THREE.MeshStandardMaterial( {
            color: new THREE.Color(textureMap['wood1'][1]),
            map        :  textureMap['wood1'][2],
            bumpMap  :  textureMap['wood1'][3],
            normalMap  :  textureMap['wood1'][4],
            roughnessMap: textureMap['wood1'][5],
            aoMap: textureMap['wood1'][6],
            metalness : 0.1,
            roughness : 0.8,
            bumpScale  :  1,
            side : THREE.DoubleSide

        } );

        stdMaterial.map.repeat.set(1, 1);
        stdMaterial.bumpMap.repeat.set(1, 1);
        stdMaterial.normalMap.repeat.set(1, 1);
        stdMaterial.roughnessMap.repeat.set(1, 1);

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
        this.phong.material.needsUpdate = true;

        this.standard.geometry.dispose();
        this.standard.geometry = this.getGeometry();
        this.standard.geometry.needsUpdate = true;
        this.standard.material.needsUpdate = true;
    }
}