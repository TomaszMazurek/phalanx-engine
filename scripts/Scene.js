class Scene{
    constructor(){
     this.scene = null;
     this.camera = null;
     this.renderer = null;
     this.controls = null;
     this.create();
    }

     create() {
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMapSoft = true;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color( 'skyblue' );

        this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.2, 25000);
        this.camera.position.z = 1000;

        this.controls = new THREE.OrbitControls( this.camera, document.getElementById("scene-container"));
    };
}
