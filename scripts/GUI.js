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
            pointLight1Power: 0.9,
            pointLight1Shadow: true,
            pointLight2Power: 0.9,
            pointLight2Shadow: true,
            directionalLight: 0.9,
            directionalLightShadow: true,
            bumpScale : 1.0,
            roughness : 1,
            shininess : 0.0,
            texture: "wood1",
            near : 500,
            far : 25000,
            fov : 30
        };

        this.stats = new Stats();
        this.stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom

        this.gui = new dat.GUI();
        this.objects = this.gui.addFolder('Objects');
        this.view = this.gui.addFolder('Camera');
        this.lights = this.gui.addFolder('Lights');
        this.textures = this.gui.addFolder('Textures');

        this.minMaxGUIHelper = new MinMaxGUIHelper(camera, 'near', 'far', 0.1);
        this.textureEvent = this.gui.add(this.params, 'texture', [ 'wood1', 'wood2','wood3', 'cobble1','cobble2',
            'cobble3','roof1', 'roof2','roof3', 'bricks1','bricks2', 'bricks3', 'iceTexture'] );
    }

    updateCamera() {
        camera.updateProjectionMatrix();
    }

    async init() {
            this.objects.add(this.params, 'speed', -0.1, 0.1).name('speed');

            this.view.add(camera, 'fov', 1, 180).onChange(this.updateCamera);
            this.view.add(this.minMaxGUIHelper, 'min', 0.1, 10000, 0.1).name('near').onChange(this.updateCamera);
            this.view.add(this.minMaxGUIHelper, 'max', 0.1, 25000, 0.1).name('far').onChange(this.updateCamera);

            this.lights.add(this.params, 'pointLight1Power', 0.0, 3.0);
            this.lights.add(this.params, 'pointLight1Shadow');
            this.lights.add(this.params, 'pointLight2Power', 0.0, 3.0);
            this.lights.add(this.params, 'pointLight2Shadow');
            this.lights.add(this.params, 'directionalLight', 0.0, 3.0);
            this.lights.add(this.params, 'directionalLightShadow');

            this.textures.add(this.params, 'bumpScale', -1.0, 1.0);
            this.textures.add(this.params, 'roughness', 0.0, 1.0);
            this.textures.add(this.params, 'shininess', 0.0, 10.0);
        return this;
    }
}
