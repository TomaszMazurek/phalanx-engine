class Textures {
  constructor() {
    this.textureMap = {
      metal1: [
        "textures/metal/metal1/",
        0xffffff,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ],
      metal2: [
        "textures/metal/metal2/",
        0xffffff,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ],
      metal3: [
        "textures/metal/metal3/",
        0xffffff,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ],
      wood1: [
        "textures/wood/wood1/",
        0xffeeb0,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ],
      wood2: [
        "textures/wood/wood2/",
        0xa0522d,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ],
      wood3: [
        "textures/wood/wood3/",
        0xcd8500,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ],
      wood4: [
        "textures/wood/wood4/",
        0xcd8500,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ],
      cobble1: [
        "textures/cobblestone/cobble1/",
        0x92806d,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ],
      cobble2: [
        "textures/cobblestone/cobble2/",
        0x878481,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ],
      cobble3: [
        "textures/cobblestone/cobble3/",
        0x95908c,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ],
      roof1: [
        "textures/roofing/roof1/",
        0xdeaf8a,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ],
      roof2: [
        "textures/roofing/roof2/",
        0xc5976d,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ],
      roof3: [
        "textures/roofing/roof3/",
        0xa37862,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ],
      bricks1: [
        "textures/bricks/bricks1/",
        0xaf7c63,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ],
      bricks2: [
        "textures/bricks/bricks2/",
        0xb4705f,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ],
      bricks3: [
        "textures/bricks/bricks3/",
        0xb18a6f,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ],
      slime: [
        "textures/others/slime/",
        0x6bb7e9,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ],
    }; //baseColor - 2, bumpMap - 3, normalMap - 4, roughnessMap - 5, aoMap - 6, displacement - 7
    this.skyboxMap = {
      kosakowo: ["textures/skybox/kosakowo/", undefined],
      quarry: ["textures/skybox/quarry/", undefined],
      bethnal: ["textures/skybox/bethnal/", undefined],
      forest: ["textures/skybox/forest/", undefined],
      lakeside: ["textures/skybox/lakeside/", undefined],
    };
  }

  async populate() {
    var i,
      texture,
      self = this,
      keyArray = Object.keys(self.textureMap);

    for (i = 0; i < keyArray.length; i++) {
      var key = keyArray[i];
      var texturePromise = new Promise((resolve) => {
        let loader = new THREE.TextureLoader();
        loader.setPath(window.origin + "/static" + window.location.pathname);
        loader.load(self.textureMap[key][0] + "Base_Color.jpg", resolve);
      });
      texture = await texturePromise;
      this.textureMap[keyArray[i]][2] = texture;
      this.textureMap[keyArray[i]][2].name = key;
      this.textureMap[keyArray[i]][2].wrapS = THREE.RepeatWrapping;
      this.textureMap[keyArray[i]][2].wrapT = THREE.RepeatWrapping;
      this.textureMap[keyArray[i]][2].anisotropy = 16;
      this.textureMap[keyArray[i]][2].repeat.set(1, 1);
    }

    for (i = 0; i < keyArray.length; i++) {
      var key = keyArray[i];
      var texturePromise = new Promise((resolve) => {
        let loader = new THREE.TextureLoader();
        loader.setPath(window.origin + "/static" + window.location.pathname);
        loader.load(self.textureMap[key][0] + "Bump.jpg", resolve);
      });
      texture = await texturePromise;
      this.textureMap[keyArray[i]][3] = texture;
      this.textureMap[keyArray[i]][3].name = key + "_bump";
      this.textureMap[keyArray[i]][3].wrapS = THREE.RepeatWrapping;
      this.textureMap[keyArray[i]][3].wrapT = THREE.RepeatWrapping;
      this.textureMap[keyArray[i]][3].repeat.set(1, 1);
    }

    for (i = 0; i < keyArray.length; i++) {
      var key = keyArray[i];
      var texturePromise = new Promise((resolve) => {
        let loader = new THREE.TextureLoader();
        loader.setPath(window.origin + "/static" + window.location.pathname);
        loader.load(self.textureMap[key][0] + "Normal.jpg", resolve);
      });
      texture = await texturePromise;
      this.textureMap[keyArray[i]][4] = texture;
      this.textureMap[keyArray[i]][4].name = key + "_normal";
      this.textureMap[keyArray[i]][4].wrapS = THREE.RepeatWrapping;
      this.textureMap[keyArray[i]][4].wrapT = THREE.RepeatWrapping;
      this.textureMap[keyArray[i]][4].repeat.set(1, 1);
    }

    /*        for (i = 0; i < keyArray.length; i++) {
            var key = keyArray[i];
            var texturePromise = new Promise(resolve => {
                new THREE.TextureLoader().load( self.textureMap[key][0] + "Roughness.jpg", resolve);
            });
            texture = await texturePromise;
            this.textureMap[keyArray[i]][5] = texture;
            this.textureMap[keyArray[i]][5].name = key+"_roughness";
            this.textureMap[keyArray[i]][5].wrapS = THREE.RepeatWrapping;
            this.textureMap[keyArray[i]][5].wrapT = THREE.RepeatWrapping;
            this.textureMap[keyArray[i]][5].repeat.set( 1, 1 );
        }*/

    for (i = 0; i < keyArray.length; i++) {
      var key = keyArray[i];
      var texturePromise = new Promise((resolve) => {
        let loader = new THREE.TextureLoader();
        loader.setPath(window.origin + "/static" + window.location.pathname);
        loader.load(self.textureMap[key][0] + "Ambient_Occlusion.jpg", resolve);
      });
      texture = await texturePromise;
      this.textureMap[keyArray[i]][6] = texture;
      this.textureMap[keyArray[i]][6].name = key + "_ao";
      this.textureMap[keyArray[i]][6].wrapS = THREE.RepeatWrapping;
      this.textureMap[keyArray[i]][6].wrapT = THREE.RepeatWrapping;
      this.textureMap[keyArray[i]][6].repeat.set(1, 1);
    }

    /*        for (i = 0; i < keyArray.length; i++) {
            var key = keyArray[i];
            var texturePromise = new Promise(resolve => {
                new THREE.TextureLoader().load( self.textureMap[key][0] + "Displacement.jpg", resolve);
            });
            texture = await texturePromise;
            this.textureMap[keyArray[i]][7] = texture;
            this.textureMap[keyArray[i]][7].name = key+"_displacement";
            this.textureMap[keyArray[i]][7].wrapS = THREE.RepeatWrapping;
            this.textureMap[keyArray[i]][7].wrapT = THREE.RepeatWrapping;
            this.textureMap[keyArray[i]][7].repeat.set( 1, 1 );
        }*/

    var skyboxKeyArray = Object.keys(self.skyboxMap);
    for (i = 0; i < skyboxKeyArray.length; i++) {
      var key = skyboxKeyArray[i];
      var texturePromise = new Promise((resolve) => {
        var loader = new THREE.CubeTextureLoader();
        loader.setPath(
          window.origin +
            "/static" +
            window.location.pathname +
            self.skyboxMap[key][0]
        );
        loader.load(
          ["px.png", "nx.png", "py.png", "ny.png", "pz.png", "nz.png"],
          resolve
        );
      });
      texture = await texturePromise;
      this.skyboxMap[skyboxKeyArray[i]][1] = texture;
    }

    return { textureMap: this.textureMap, skyboxMap: this.skyboxMap };
  }
  getTextureKeys() {
    return Object.keys(this.textureMap);
  }
  getSkyboxKeys() {
    return Object.keys(this.skyboxMap);
  }
}
