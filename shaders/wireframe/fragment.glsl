varying float distToCamera;
varying vec3 vBary;
varying vec3 vState;
varying float vSel;
varying float vTex;
varying float vTexType;
varying float vOp;

varying vec2 vN;
varying vec2 vUv;

varying float nDotVP;
varying vec3 vColor;

uniform sampler2D tvTextures[16];
uniform sampler2D tMatCap;

uniform float lightAmount;
uniform int ivTextureIds[16];
uniform vec3 ink;
uniform vec3 edgeColor;
uniform vec3 selectionColor1;
uniform vec3 selectionColor3;
uniform vec3 uniqueColor;
uniform vec3 triangleEdgeColor;
uniform int computed;
uniform int multi;
uniform int textureApplied;
uniform int wireframe;
uniform bool objectMode;

float luminance(float r, float g, float b) {
    float colorArray[3];
    colorArray[0] = r;
    colorArray[1] = g;
    colorArray[2] = b;
    float colorFactor;
    for (int i = 0; i<2; i++){
        colorFactor = colorArray[i];
        if (colorFactor <= 0.03928) {
            colorFactor = colorFactor / 12.92;
        } else {
            colorFactor = pow(abs((colorFactor + 0.055) / 1.055), 2.4);
        }
        colorArray[i] = colorFactor;
    }
    return float (colorArray[0] * 0.2126 + colorArray[1] * 0.7152 + colorArray[2] * 0.0722);
}

float contrast(in vec3 rgb1, in vec3 rgb2) {
    float lum1 = luminance(rgb1.x, rgb1.y, rgb1.z) + 0.05;
    float lum2 = luminance(rgb2.x, rgb2.y, rgb2.z) + 0.05;
    if (lum1>lum2){
        return (lum1 / lum2);
    } else {
        return (lum2 / lum1);
    }
}

vec4 diffuse(highp int textureType) {
    float diffuse = nDotVP;
    float diffuseIntensity = textureType == 1 ? .05 : 0.35;
    float shading = 1.85 * lightAmount + diffuseIntensity * diffuse;

    return vec4(shading);
}

vec3 edgeFactorTri(float thickness) {
    vec3 d = fwidth(vBary.xyz);
    float edgeThickness = thickness-distToCamera/700.;
    edgeThickness = edgeThickness < 0.4 ? 0.4 : edgeThickness;
    return smoothstep(vec3(0.0), d * edgeThickness, vBary.xyz);
}

void main() {

    vec3 cColor = (computed == 1 ? vColor.rgb : ink.rgb);
    vec4 mainColor = vec4(cColor.rgb, 1.);
    vec3 selectionLight;
    vec3 selectedColor = vec3(0.96, 0.82, 0.2);
    float stdThickness = 2.;
    float selectionThickness = 4.;
    float triangleThickness = .7;
    vec3 base;

    if (contrast(cColor.rgb, selectionColor3) > 1.5) {
        selectionLight = vec3(.35, .25, .1);
        selectedColor = vec3(.96, .82, .2);
    } else if (contrast (cColor.rgb, selectionColor1) > 1.5) {
        selectionLight = vec3(.1, .35, .1);
        selectedColor = vec3(.2, .9, .3);
    } else {
        selectionLight = vec3(.35, .25, .4);
        selectedColor = vec3(.4, .4, .9);
    }

    if (vSel == 1.) {
        mainColor = vec4(cColor.rgb + selectionLight, 1.);
    }

    float intensity = .35;
    highp int index = int(vTex);

    if (multi == 0) {
        vec4 shaderColor = 1. * mainColor * diffuse(ivTextureIds[0]);
        base = vec3(mix(shaderColor.xyz, texture2D(tvTextures[0], (ivTextureIds[0] == 1 ? vUv : vN)).rgb, intensity) + vec3(lightAmount - .05));
    } else {
        for (int i = 0; i < 16; i++) {
            if (index == i) {
                vec4 shaderColor = 1. * mainColor * diffuse(ivTextureIds[i]);
                base = vec3(mix(shaderColor.xyz, texture2D(tvTextures[i], (ivTextureIds[i] == 1 ? vUv : vN)).rgb, intensity) + vec3(lightAmount - .05));
            }
        }
    }

    gl_FragColor.a = 1.0;

    if (wireframe == 1 || vState.x > 2. || vState.y > 2. || vState.z > 2.) {
        vec3 edgefactor = edgeFactorTri(stdThickness);
        if (edgefactor.x <= edgefactor.y && edgefactor.x <= edgefactor.z) {
            if (wireframe == 0 && (vState.x == 1. || vState.x == 2.)) {
                gl_FragColor.rgb = base.xyz;
            } else {
                if (vState.x == 2.) {
                    edgefactor = edgeFactorTri(triangleThickness);
                } else if (vState.x == 4. || vState.x == 3.) {
                    edgefactor = edgeFactorTri(selectionThickness);
                }
                gl_FragColor.rgb = mix(
                vState.x == 4. ? uniqueColor : (vState.x == 3. ? selectedColor : (vState.x == 2. ? triangleEdgeColor : edgeColor)),
                base.xyz,
                (vState.x == 0.) ? 1. : edgefactor.x);

                if (objectMode) gl_FragColor.a = vState.x == 0. ? 0. : (1.-edgefactor.x) * .8;
            }
        } else if (edgefactor.y <= edgefactor.z) {
            if (wireframe == 0 && (vState.y == 1. || vState.y == 2.)){
                gl_FragColor.rgb = base.xyz;
            } else {
                if (vState.y == 2.) {
                    edgefactor = edgeFactorTri(triangleThickness);
                } else if (vState.y == 4. || vState.y == 3.) {
                    edgefactor = edgeFactorTri(selectionThickness);
                }
                gl_FragColor.rgb = mix(vState.y == 4. ? uniqueColor :
                (vState.y == 3. ? selectedColor : (vState.y == 2. ? triangleEdgeColor : edgeColor)), base.xyz, (vState.y == 0.) ? 1. : edgefactor.y);
                if (objectMode) gl_FragColor.a = vState.y == 0. ? 0. : (1.-edgefactor.y) * .8;
            }
        } else {
            if (wireframe == 0 && (vState.z == 1. || vState.z == 2.)) {
                gl_FragColor.rgb = base.xyz;
            } else {
                if (vState.z == 2.) {
                    edgefactor = edgeFactorTri(triangleThickness);
                } else if (vState.z == 4. || vState.z == 3.) {
                    edgefactor = edgeFactorTri(selectionThickness);
                }
                gl_FragColor.rgb = mix(vState.z == 4. ? uniqueColor : (vState.z == 3. ? selectedColor : (vState.z == 2. ? triangleEdgeColor : edgeColor)), base.xyz, (vState.z == 0.) ? 1. : edgefactor.z);
                if (objectMode) gl_FragColor.a = vState.z == 0. ? 0. : (1.-edgefactor.z) * .8;
            } }
    } else {
        gl_FragColor.rgb = base.xyz;
    }

    gl_FragColor.a *= vOp;
}