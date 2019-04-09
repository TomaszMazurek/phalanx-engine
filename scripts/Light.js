class Light {
    constructor() {
        this.hemisphereLight = null;
        this.ambientLight = null;
        this.directionalLight =  null;
        this.pointLights = new Array();
        this.shadowDiameter = 2000;
    }

    createAmbientLight(_color){
            var color = _color ? _color :  0x404040;
            this.ambientLight = new THREE.AmbientLight( color );
        scene.add(this.ambientLight);
        return this.ambientLight;
    }

    createHemisphereLight (_color){
            var color = _color ? _color :  0xffffff;
            this.hemisphereLight = new THREE.HemisphereLight( 0xffffff, 0x080820, 0.5 );
        scene.add(this.hemisphereLight);
        return this.hemisphereLight;
    }

    //color: RGB, position: Vec3
    createDirectionalLight(_color, _position){
            var color = _color ? _color :  0xffffff;
            var position = _position ? _position : new THREE.Vector3(0, 1000, 0);
            this.directionalLight =  new THREE.DirectionalLight(color);
            this.directionalLight.position.set(position.x, position.y, position.z);

            this.directionalLight.castShadow = true;

            this.directionalLight.shadow.mapSize.width = 1024;
            this.directionalLight.shadow.mapSize.height = 1024;

            this.directionalLight.shadow.camera.near = params.near;
            this.directionalLight.shadow.camera.far = params.far;
            this.directionalLight.shadow.camera.fov = params.fov;

            this.directionalLight.shadow.camera.left = -this.shadowDiameter;
            this.directionalLight.shadow.camera.right = this.shadowDiameter;
            this.directionalLight.shadow.camera.top = this.shadowDiameter;
            this.directionalLight.shadow.camera.bottom = -this.shadowDiameter;

            this.directionalLight.shadow.bias = 0.001;
        this.createBulb(this.directionalLight, 50);
        scene.add(this.directionalLight);

        return this.directionalLight;
    }
    //color: RGB, position: Vec3, angle: float
    createPointLight(_color, _position, _angle){
            var color = _color ? _color :  0xffffff;
            var position = _position ? _position : new THREE.Vector3(300, 300, 300);
            var pointLight = new THREE.PointLight( color );
            pointLight.position.set(position.x, position.y, position.z);
            pointLight.angle = 180;

            pointLight.castShadow = true;

            pointLight.shadow.mapSize.width = 1024;
            pointLight.shadow.mapSize.height = 1024;

            pointLight.shadow.camera.near = params.near;
            pointLight.shadow.camera.far = params.far;
            pointLight.shadow.camera.fov = params.fov;

            pointLight.shadow.camera.left = -this.shadowDiameter;
            pointLight.shadow.camera.right = this.shadowDiameter;
            pointLight.shadow.camera.top = this.shadowDiameter;
            pointLight.shadow.camera.bottom = -this.shadowDiameter;

            pointLight.shadow.bias = 0.001;
            this.pointLights.push(pointLight);
            scene.add(pointLight);
            this.createBulb(pointLight, 10);
        return this.pointLights
    }

    createBulb(light, _size){
        var size = _size ? _size : 10;
        var bulbGeometry = new THREE.SphereGeometry( size );
        var bulbMaterial = new THREE.MeshLambertMaterial( {color: 0x444444, emissive: new THREE.Color(0xffffff), opacity: 0.3, transparent: true} );
        var bulb = new THREE.Mesh( bulbGeometry, bulbMaterial );
        bulb.position.set(light.position.x, light.position.y, light.position.z );
        light.bulb = bulb;
        scene.add(bulb);
        return bulb
    }
    createLight(color) {

        var sphere1Geometry = new THREE.SphereGeometry( 10 );
        var sphere1Material = new THREE.MeshLambertMaterial( {color: 0x444444, emissive: new THREE.Color(0xffffff), opacity: 0.3, transparent: true} );
        sphere1 = new THREE.Mesh( sphere1Geometry, sphere1Material );
        sphere1.position.set(pointLight1.position.x, pointLight1.position.y, pointLight1.position.z );

        pointLight2 = new THREE.PointLight( 0xffffff );
        pointLight2.position.set( -200,300, -400);
        pointLight2.angle = 180;

        scene.add( pointLight2 );

        var sphere2Geometry = new THREE.SphereGeometry( 10 );
        var sphere2Material = new THREE.MeshLambertMaterial( {color: 0x444444, emissive: new THREE.Color(0xffffff), opacity: 0.3, transparent: true} );
        sphere2 = new THREE.Mesh( sphere2Geometry, sphere2Material );
        sphere2.position.set(pointLight2.position.x, pointLight2.position.y, pointLight2.position.z );
        scene.add(sphere2);
    }
}