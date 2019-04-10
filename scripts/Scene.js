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


         //BoxGeometry(width : Float, height : Float, depth : Float, widthSegments : Integer, heightSegments : Integer, depthSegments : Integer)
         var planeGeometry = new THREE.BoxGeometry(2000, 2000, 10, 100, 100, 5);
         var planeMaterial = new THREE.MeshPhongMaterial( {
             color: new THREE.Color(textureMap['cobble3'][1]),
             map        :  textureMap['cobble3'][2].clone(),
             bumpMap  :  textureMap['cobble3'][3].clone(),
             normalMap  :  textureMap['cobble3'][4].clone(),
             bumpScale  :  1 }
         );

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
         this.scene.add( plane );


         //BoxGeometry(width : Float, height : Float, depth : Float, widthSegments : Integer, heightSegments : Integer, depthSegments : Integer)
         var leftWallGeometry = new THREE.BoxGeometry(2000, 1000, 10, 100, 100, 5);
         var leftWallMaterial = new THREE.MeshPhongMaterial( {
             color: new THREE.Color(textureMap['bricks1'][1]),
             map        :  textureMap['bricks1'][2].clone(),
             bumpMap  :  textureMap['bricks1'][3].clone(),
             normalMap  :  textureMap['bricks1'][4].clone(),
             bumpScale  :  1 }
         );
         leftWallMaterial.map.repeat.set(8, 8);
         leftWallMaterial.map.needsUpdate = true;
         leftWallMaterial.bumpMap.repeat.set(8, 8);
         leftWallMaterial.bumpMap.needsUpdate = true;
         leftWallMaterial.normalMap.repeat.set(8, 8);
         leftWallMaterial.normalMap.needsUpdate = true;

         var leftWall = new THREE.Mesh( leftWallGeometry, leftWallMaterial );
         leftWall.rotation.y = Math.PI / 2;
         leftWall.position.x = -1000;
         leftWall.position.y = 350;
         leftWall.receiveShadow = true;
         this.scene.add( leftWall );

         //BoxGeometry(width : Float, height : Float, depth : Float, widthSegments : Integer, heightSegments : Integer, depthSegments : Integer)
         var backWallGeometry = new THREE.BoxGeometry(2000, 1000, 10, 100, 100, 5);
         var backWallMaterial = new THREE.MeshPhongMaterial( {
             color: new THREE.Color(textureMap['bricks2'][1]),
             map : textureMap['bricks2'][2].clone(),
             bumpMap  :  textureMap['bricks2'][3].clone(),
             normalMap  :  textureMap['bricks2'][4].clone(),
             bumpScale  :  1
         });

         backWallMaterial.map.repeat.set(8, 8);
         backWallMaterial.map.needsUpdate = true;
         backWallMaterial.bumpMap.repeat.set(8, 8);
         backWallMaterial.bumpMap.needsUpdate = true;
         backWallMaterial.normalMap.repeat.set(8, 8);
         backWallMaterial.normalMap.needsUpdate = true;

         var backWall = new THREE.Mesh( backWallGeometry, backWallMaterial );
         backWall.position.z = -1000;
         backWall.position.y = 350;
         backWall.receiveShadow = true;
         this.scene.add( backWall );

         //BoxGeometry(width : Float, height : Float, depth : Float, widthSegments : Integer, heightSegments : Integer, depthSegments : Integer)
         var rightWallGeometry = new THREE.BoxGeometry(2000, 1000, 10, 100, 100, 5);
         var rightWallMaterial = new THREE.MeshPhongMaterial( {
             color: new THREE.Color(textureMap['bricks3'][1]),
             map        :  textureMap['bricks3'][2].clone(),
             bumpMap  :  textureMap['bricks3'][3].clone(),
             normalMap  :  textureMap['bricks3'][4].clone(),
             bumpScale  :  0.2
         });

         rightWallMaterial.map.repeat.set(8, 8);
         rightWallMaterial.map.needsUpdate = true;
         rightWallMaterial.bumpMap.repeat.set(8, 8);
         rightWallMaterial.bumpMap.needsUpdate = true;
         rightWallMaterial.normalMap.repeat.set(8, 8);
         rightWallMaterial.normalMap.needsUpdate = true;

         var rightWall = new THREE.Mesh( rightWallGeometry, rightWallMaterial );
         rightWall.rotation.y = Math.PI / 2;
         rightWall.position.x = 1000;
         rightWall.position.y = 350;
         rightWall.receiveShadow = true;
         this.scene.add( rightWall );
    };
}
