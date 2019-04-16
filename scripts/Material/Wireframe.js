class Wireframe extends THREE.ShaderMaterial{
 constructor() {
     super({
         uniforms: {
             tMatCap: {type: 't', value: tvTextures[0]},
             tvTextures: {type: 'tv', value: tvTextures},
             ivTextureIds: {type: 'iv', value: ivTextureIds},
             lightAmount: {type: 'f', value: 0.125},
             ink: {type: 'c', value: new THREE.Color().copy(color)},
             edgeColor: {type: 'c', value: new THREE.Color(0.8, 0.8, 0.8)},
             selectedColor: {type: 'c', value: new THREE.Color(0.96, 0.82, 0.2)},
             uniqueColor: {type: 'c', value: new THREE.Color(0.2, 0.8, 0.1)},
             triangleEdgeColor: {type: 'c', value: new THREE.Color(0.73, 0.81, 0.95)},
             selectionColor1: {type: 'c', value: new THREE.Color(0.4, 0.84, 0.4)},
             selectionColor3: {type: 'c', value: new THREE.Color(1, 1, 0)},
             opacity: {type: 'f', value: 1.0},
             computed: {type: 'i', value: 0},
             multi: {type: 'i', value: 0},
             textureApplied: {type: 'i', value: 0},
             wireframe: {type: 'i', value: wireframe == true ? 1 : 0},
             objectMode: {type: 'b', value: objectMode}
         },
         vertexShader: shaderMap["wireframe"][1],
         fragmentShader: shaderMap["wireframe"][2],
         vertexColors: THREE.VertexColors,
         transparent: true,
         side: THREE.DoubleSide,
         polygonOffset: true,
         polygonOffsetFactor: 1, // positive value pushes polygon further away
         polygonOffsetUnits: 1,
         depthFunc: THREE.LessDepth
     });

     material.uniforms.edgeColor.value = objectMode ? new THREE.Color(0.0, 0.0, 0.0) : new THREE.Color(0.8, 0.8, 0.8);
     material.depthWrite = objectMode ? false : true;
     material.extensions.derivatives = true;
     tvTextures = null;
     ivTextureIds = null;
    }
}