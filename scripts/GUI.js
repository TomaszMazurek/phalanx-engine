class MinMaxGUIHelper {
    constructor(obj, minProp, maxProp, minDif) {
        this.obj = obj;
        this.minProp = minProp;
        this.maxProp = maxProp;
        this.minDif = minDif;
    }
    get min() {
        return this.obj[this.minProp];
    }
    set min(v) {
        this.obj[this.minProp] = v;
        this.obj[this.maxProp] = Math.max(this.obj[this.maxProp], v + this.minDif);
    }
    get max() {
        return this.obj[this.maxProp];
    }
    set max(v) {
        this.obj[this.maxProp] = v;
        this.min = this.min;  // this will call the min setter
    }
}

class GUI {
    constructor(camera) {
        this.params = {
            speed : 0.001,
            pointLight1Power: 0.5,
            pointLight1Shadow: true,
            directionalLight: 0.7,
            directionalLightShadow: true,
            bumpScaleX : 1.0,
            bumpScaleY : 1.0,
            roughness : 0.8,
            metalness : 0,
            shininess : 128,
            texture: "wood1",
            texRotation: 0,
            repeatU : 2,
            repeatV : 2,
            shape: "Sphere",
            near : 500,
            far : 25000,
            fov : 30,
            add: function(){ console.log() },
        };

        this.stats = new Stats();
        this.stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom

        this.gui = new dat.GUI();
        this.objects = this.gui.addFolder('Objects');
        this.shapeEvent = this.objects.add(this.params, 'shape', [ 'Box',  'Sphere', 'Cone', 'Cylinder', 'Torus', 'TorusKnot', 'Dodecahedron', 'Icosahedron',
            'Octahedron','Tetrahedron', 'Circle'] );
        this.view = this.gui.addFolder('Camera');
        this.lights = this.gui.addFolder('Lights');
        this.textures = this.gui.addFolder('Textures');

        this.material = this.gui.addFolder('Material');
        this.material.add(this.params, 'bumpScaleX', -1.0, 1.0).name("bump scale X").onChange(function(value) {
            var bumpScaleY = meshPhong.material.normalScale.y;

         meshPhong.material.normalScale.set(value,bumpScaleY);
         meshStandard.material.normalScale.set(value, bumpScaleY);

         meshPhong.material.needsUpdate = true;
         meshStandard.material.needsUpdate = true;
        });

        this.material.add(this.params, 'bumpScaleY', -1.0, 1.0).name("bump scale Y").onChange(function(value) {
            var bumpScaleX = meshPhong.material.normalScale.x;
         meshPhong.material.normalScale.set(bumpScaleX,value);
         meshStandard.material.normalScale.set(bumpScaleX, value);

         meshPhong.material.needsUpdate = true;
         meshStandard.material.needsUpdate = true;
        });

        this.material.phong = this.material.addFolder('Phong');
        this.material.PBR = this.material.addFolder('PBR');


        this.minMaxGUIHelper = new MinMaxGUIHelper(camera, 'near', 'far', 0.1);
        this.textureEvent = this.textures.add(this.params, 'texture', [ 'wood1', 'wood2','wood3', 'cobble1','cobble2',
            'cobble3','roof1', 'roof2','roof3', 'bricks1','bricks2', 'bricks3', 'iceTexture'] );
        this.textures.add(this.params, 'texRotation',0, 360).name("rotation");
        this.textures.add(this.params, 'repeatU',1, 50).name("repeat U").onChange(function(value) {
            var repeatV = shape.phong.material.map.repeat.y;
            shape.phong.material.applyRepeat(value, repeatV);
            shape.standard.material.applyRepeat(value, repeatV);

            meshPhong.material.needsUpdate = true;
            meshStandard.material.needsUpdate = true;
        });
        this.textures.add(this.params, 'repeatV',1, 50).name("repeat V").onChange(function(value) {
            var repeatU = shape.phong.material.map.repeat.x;
            shape.phong.material.applyRepeat(repeatU, value);
            shape.standard.material.applyRepeat(repeatU, value);

            meshPhong.material.needsUpdate = true;
            meshStandard.material.needsUpdate = true;
        });

    }

    updateCamera() {
        camera.updateProjectionMatrix();
    }

    async init() {
        this.objects.add(this.params,'add').name("add");
        this.objects.add(this.params, 'speed', -0.1, 0.1).name('speed');

        this.view.add(camera, 'fov', 1, 180).onChange(this.updateCamera);
        this.view.add(this.minMaxGUIHelper, 'min', 0.1, 10000, 0.1).name('near').onChange(this.updateCamera);
        this.view.add(this.minMaxGUIHelper, 'max', 0.1, 25000, 0.1).name('far').onChange(this.updateCamera);

        this.lights.add(this.params, 'pointLight1Power', 0.0, 3.0);
        this.lights.add(this.params, 'pointLight1Shadow');
        this.lights.add(this.params, 'directionalLight', 0.0, 3.0);
        this.lights.add(this.params, 'directionalLightShadow');

        this.material.PBR.add(this.params, 'roughness', 0, 1.0);
        this.material.PBR.add(this.params, 'metalness', 0, 1.0);

        this.material.phong.add(this.params, 'shininess', 0, 1000.0).onChange(function(value) {
            meshPhong.material.shininess = value;
            meshPhong.material.needsUpdate = true;
        });

        return this;
    }
}
