/*attribute vec4 a_position;

void main() {
    gl_Position = a_position;
}*/
varying vec3 vUv;

void main() {
    vUv = position;

    vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * modelViewPosition;
}
