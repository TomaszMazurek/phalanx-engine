(async function loadShader(){
    var vertexShader = new Promise(resolve => {
        new THREE.FileLoader().load("shaders/Wireframe_vertex.glsl", resolve);
    });
    shaderMap["wireframe"][0] = await vertexShader;

    var fragmentShader = new Promise(resolve => {
        new THREE.FileLoader().load("shaders/Wireframe_fragment.glsl", resolve);
    });
    shaderMap["wireframe"][1] = await fragmentShader;
})();
