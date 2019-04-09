varying vec3 vPos;
varying vec3 vNormal;
void main() {
    vPos = (modelMatrix * vec4(position, 1.0 )).xyz;
    vNormal = normalMatrix * normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
}