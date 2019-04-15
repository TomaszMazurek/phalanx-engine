class Shape {
    constructor(){
        this.phong = null;
        this.standard = null;
        this.shader = null;
        this.create();
    }

    getGeometry() {
        switch (selectedShape) {
            case "Box" :
                var geometry = new THREE.BoxBufferGeometry(170,170,170);
                var uvs = new Float32Array(geometry.attributes.uv.array);
                geometry.addAttribute( 'uv2', new THREE.BufferAttribute( uvs, 2 ) );
                return geometry;
                break;
            case 'Sphere':
                var geometry = new THREE.SphereBufferGeometry( 120, 32, 32 );
                var uvs = new Float32Array(geometry.attributes.uv.array);
                geometry.addAttribute( 'uv2', new THREE.BufferAttribute( uvs, 2 ) );
                return geometry;
                break;
            case "Circle":
                var geometry = new THREE.CircleBufferGeometry( 170, 32 );
                var uvs = new Float32Array(geometry.attributes.uv.array);
                geometry.addAttribute( 'uv2', new THREE.BufferAttribute( uvs, 2 ) );
                return geometry;
                break;
            case 'Cone':
                var geometry = new THREE.ConeBufferGeometry( 150, 200, 32 );
                var uvs = new Float32Array(geometry.attributes.uv.array);
                geometry.addAttribute( 'uv2', new THREE.BufferAttribute( uvs, 2 ) );
                return geometry;
                break;
            case 'Cylinder':
                var geometry = new THREE.CylinderBufferGeometry( 100, 100, 200, 32 );
                var uvs = new Float32Array(geometry.attributes.uv.array);
                geometry.addAttribute( 'uv2', new THREE.BufferAttribute( uvs, 2 ) );
                return geometry;
                break;
            case 'Dodecahedron':
                var geometry = new THREE.DodecahedronBufferGeometry( 150 );
                var uvs = new Float32Array(geometry.attributes.uv.array);
                geometry.addAttribute( 'uv2', new THREE.BufferAttribute( uvs, 2 ) );
                return geometry;
                break;
            case 'Icosahedron':
                var geometry = new THREE.IcosahedronBufferGeometry( 150 );
                var uvs = new Float32Array(geometry.attributes.uv.array);
                geometry.addAttribute( 'uv2', new THREE.BufferAttribute( uvs, 2 ) );
                return geometry;
                break;
            case 'Octahedron':
                var geometry = new THREE.OctahedronBufferGeometry( 150 );
                var uvs = new Float32Array(geometry.attributes.uv.array);
                geometry.addAttribute( 'uv2', new THREE.BufferAttribute( uvs, 2 ) );
                return geometry;
                break;
            case 'Tetrahedron':
                var geometry = new THREE.TetrahedronBufferGeometry( 150 );
                var uvs = new Float32Array(geometry.attributes.uv.array);
                geometry.addAttribute( 'uv2', new THREE.BufferAttribute( uvs, 2 ) );
                return geometry;
                break;
            case 'Torus':
                var geometry = new THREE.TorusBufferGeometry( 100, 40, 16, 100 );
                var uvs = new Float32Array(geometry.attributes.uv.array);
                geometry.addAttribute( 'uv2', new THREE.BufferAttribute( uvs, 2 ) );
                return geometry;
                break;
            case 'TorusKnot':
                var geometry = new THREE.TorusKnotBufferGeometry( 100, 40, 16, 100 );
                var uvs = new Float32Array(geometry.attributes.uv.array);
                geometry.addAttribute( 'uv2', new THREE.BufferAttribute( uvs, 2 ) );
                return geometry;
                break;
        }
    }

    create(){
        phongMaterial = new Phong();

        meshPhong = new THREE.Mesh( this.getGeometry(), phongMaterial );
        meshPhong.position.set(300,50,0);
        meshPhong.castShadow = true;
        meshPhong.receiveShadow = false;
        scene.add( meshPhong );
        this.phong = meshPhong;

        shaderMaterial = new Shader(params.shaderNormalMap);
        meshShader = new THREE.Mesh( this.getGeometry(), shaderMaterial );
        meshShader.position.set(0,50,0);
        meshShader.castShadow = true;
        meshShader.receiveShadow = false;
        meshShader.material.needsUpdate = true;
        this.shader = meshShader;
        this.shader.material.defaultAttributeValues.uv = new Float32Array(this.shader.geometry.attributes.uv.array);
        this.shader.material.uniforms.map.needsUpdate = true;
        this.shader.material.needsUpdate = true;
        scene.add( meshShader );


        stdMaterial = new PBR();
        meshStandard = new THREE.Mesh( this.getGeometry(), stdMaterial );
        meshStandard.position.set(-300,50,0);
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

        this.shader.geometry.dispose();
        this.shader.geometry = this.getGeometry();
        this.shader.geometry.needsUpdate = true;
        this.shader.material.defaultAttributeValues.uv = new Float32Array(this.shader.geometry.attributes.uv.array);
        shape.shader.material.applyRepeat(params.repeatU, params.repeatV);
        this.shader.material.needsUpdate = true;

        this.standard.geometry.dispose();
        this.standard.geometry = this.getGeometry();
        this.standard.geometry.needsUpdate = true;
        shape.standard.material.applyRepeat(params.repeatU, params.repeatV);
        this.standard.material.needsUpdate = true;
    }

}