class Shaders {
    constructor() {
        this.shaderMap = {
            base: ["shaders/base/", undefined, undefined],
            wireframe: ["shaders/wireframe/", undefined, undefined]
        };//vertex - 1, fragment - 2
    }

    async populate() {
        var i,
            self = this,
            keyArray = Object.keys(self.shaderMap);

        for (i = 0; i < keyArray.length; i++) {
            var key = keyArray[i];
            var vertexPromise = new Promise(resolve => {
                new THREE.FileLoader().load(self.shaderMap[key][0] + "vertex.glsl", resolve);
            });
            this.shaderMap[keyArray[i]][1] = await vertexPromise;

            var fragmentPromise = new Promise(resolve => {
                new THREE.FileLoader().load(self.shaderMap[key][0] + "fragment.glsl", resolve);
            });
            this.shaderMap[keyArray[i]][2] = await fragmentPromise;
        }
        return this.shaderMap
    };
}