attribute vec3 barycentric;
attribute vec3 edgestates;
attribute float selection;
attribute float textureIds;
attribute float opacity;

varying float distToCamera;
varying vec3 vBary;
varying vec3 vState;
varying float vSel;
varying float vTex;
varying float vTexType;
varying float vOp;
varying vec2 vN;
varying vec2 vUv;

varying vec3 vNormal;
varying float nDotVP;
varying vec3 vColor;

void main() {

    vBary = barycentric;
    vState = edgestates;
    vSel = selection;
    vTex = textureIds;
    vOp = opacity;

    vColor = color;

    vUv = uv;

    vec4 p = vec4( position, 1. );

    vec3 mp = vec3( modelViewMatrix * p );
    distToCamera = -mp.z;

    vec3 e = normalize( mp );
    vec3 n = normalize( normalMatrix * normal );

    vec3 r = reflect( e, n );
    float m = 2. * sqrt(pow( r.x, 2. ) + pow( r.y, 2. ) + pow( r.z + 1., 2. ));
    vN = r.xy / m + .5;

    gl_Position = projectionMatrix * modelViewMatrix * p;

    vNormal = n;

    nDotVP = max( 0., dot( vNormal, normalize( vec3(.1, .5, .9) ) ) );
}