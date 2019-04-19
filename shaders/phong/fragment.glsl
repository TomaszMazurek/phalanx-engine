#define PHONG

uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;

//#include <common> //-----------------------------------COMMON---------------------------------------------------------
    #define PI 3.14159
    #define PI2 6.28318
    #define RECIPROCAL_PI 0.31830988618
    #define RECIPROCAL_PI2 0.15915494
    #define LOG2 1.442695
    #define EPSILON 1e-6

    #define saturate(a) clamp( a, 0.0, 1.0 )
    #define whiteCompliment(a) ( 1.0 - saturate( a ) )

    float square( const in float x ) { return x*x; }
    float average( const in vec3 color ) { return dot( color, vec3( 0.3333 ) ); }


    struct IncidentLight {
    vec3 color;
    vec3 direction;
    bool visible;
    };

    struct ReflectedLight {
    vec3 directDiffuse;
    vec3 directSpecular;
    vec3 indirectDiffuse;
    vec3 indirectSpecular;
    };

    struct GeometricContext {
    vec3 position;
    vec3 normal;
    vec3 viewDir;
    };


    vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

    return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

    }

    // http://en.wikibooks.org/wiki/GLSL_Programming/Applying_Matrix_Transformations
    vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {

    return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );

    }

    vec3 projectOnPlane(in vec3 point, in vec3 pointOnPlane, in vec3 planeNormal ) {

    float distance = dot( planeNormal, point - pointOnPlane );

    return - distance * planeNormal + point;

    }

    float sideOfPlane( in vec3 point, in vec3 pointOnPlane, in vec3 planeNormal ) {

    return sign( dot( point - pointOnPlane, planeNormal ) );

    }

    vec3 linePlaneIntersect( in vec3 pointOnLine, in vec3 lineDirection, in vec3 pointOnPlane, in vec3 planeNormal ) {

    return lineDirection * ( dot( planeNormal, pointOnPlane - pointOnLine ) / dot( planeNormal, lineDirection ) ) + pointOnLine;

    }

    vec3 inputToLinear( in vec3 a ) {

    #ifdef GAMMA_INPUT

    return pow( a, vec3( float( GAMMA_FACTOR ) ) );

    #else

    return a;

    #endif

    }

    vec3 linearToOutput( in vec3 a ) {

    #ifdef GAMMA_OUTPUT

    return pow( a, vec3( 1.0 / float( GAMMA_FACTOR ) ) );

    #else

    return a;

    #endif

    }

    //#include <packing> //---------------------------------------------------------------------------------------------
    //#include <dithering_pars_fragment> //-----------------------------------------------------------------------------

    //#include <color_pars_fragment>  //-----------------------------------COLOR----------------------------------------
    #ifdef USE_COLOR

    varying vec3 vColor;

    #endif

    //#include <uv_pars_fragment>  //---------------------------------------UV------------------------------------------
    #if defined( USE_MAP ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( USE_SPECULARMAP ) \
    || defined( USE_ALPHAMAP ) || defined( USE_EMISSIVEMAP ) || defined( USE_ROUGHNESSMAP ) || defined( USE_METALNESSMAP )

    varying vec2 vUv;

    #endif

    //#include <uv2_pars_fragment>  //-------------------------------------UV2------------------------------------------
    #if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )

    varying vec2 vUv2;

    #endif

    //#include <map_pars_fragment>  //--------------------------------------MAP-----------------------------------------
    #ifdef USE_MAP

    uniform sampler2D map;

    #endif

    //#include <alphamap_pars_fragment>  //---------------------------------ALPHA_MAP-----------------------------------
    #ifdef USE_ALPHAMAP

    uniform sampler2D alphaMap;

    #endif

    //#include <aomap_pars_fragment> //------------------------------AMBIENT_OCCLUSION_MAP------------------------------
    #ifdef USE_AOMAP

    uniform sampler2D aoMap;
    uniform float aoMapIntensity;

    #endif

    //#include <lightmap_pars_fragment> //------------------------------LIGHT_MAP---------------------------------------
    #ifdef USE_LIGHTMAP

    uniform sampler2D lightMap;
    uniform float lightMapIntensity;

    #endif

    //#include <emissivemap_pars_fragment>  //-------------------------EMISSIVE_MAP-------------------------------------
    #ifdef USE_EMISSIVEMAP

    uniform sampler2D emissiveMap;

    #endif

    //#include <envmap_pars_fragment>  //----------------------------ENVIRONMENTAL_MAP----------------------------------
    #if defined( USE_ENVMAP ) || defined( STANDARD )
    uniform float reflectivity;
    uniform float envMapIntenstiy;
    #endif

    #ifdef USE_ENVMAP
    #ifdef ENVMAP_TYPE_CUBE
    uniform samplerCube envMap;
    #else
    uniform sampler2D envMap;
    #endif
    uniform float flipEnvMap;

    #if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( STANDARD )

    uniform float refractionRatio;

    #else

    varying vec3 vReflect;

    #endif

    #endif

    //#include <gradientmap_pars_fragment> // ------------------------GRADIENT_MAP--------------------------------------

    //#include <fog_pars_fragment>  //----------------------------------FOG---------------------------------------------
    #ifdef USE_FOG

    uniform vec3 fogColor;

    #ifdef FOG_EXP2

    uniform float fogDensity;

    #else

    uniform float fogNear;
    uniform float fogFar;
    #endif

    #endif

    //#include <bsdfs> //---------------------------------------------BSDFS---------------------------------------------
    bool testLightInRange( const in float lightDistance, const in float cutoffDistance ) {

        return any( bvec2( cutoffDistance == 0.0, lightDistance < cutoffDistance ) );

    }

    float calcLightAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {

        if ( decayExponent > 0.0 ) {

            return pow( saturate( -lightDistance / cutoffDistance + 1.0 ), decayExponent );

        }

        return 1.0;

    }


    vec3 BRDF_Diffuse_Lambert( const in vec3 diffuseColor ) {

        return RECIPROCAL_PI * diffuseColor;

    } // validated


    vec3 F_Schlick( const in vec3 specularColor, const in float dotLH ) {

        // Original approximation by Christophe Schlick '94
        //;float fresnel = pow( 1.0 - dotLH, 5.0 );

        // Optimized variant (presented by Epic at SIGGRAPH '13)
        float fresnel = exp2( ( -5.55473 * dotLH - 6.98316 ) * dotLH );

        return ( 1.0 - specularColor ) * fresnel + specularColor;

    } // validated


    // Microfacet Models for Refraction through Rough Surfaces - equation (34)
    // http://graphicrants.blogspot.com/2013/08/specular-brdf-reference.html
    // alpha is "roughness squared" in Disney’s reparameterization
    float G_GGX_Smith( const in float alpha, const in float dotNL, const in float dotNV ) {

        // geometry term = G(l)⋅G(v) / 4(n⋅l)(n⋅v)

        float a2 = alpha * alpha;

        float gl = dotNL + pow( a2 + ( 1.0 - a2 ) * dotNL * dotNL, 0.5 );

        float gv = dotNV + pow( a2 + ( 1.0 - a2 ) * dotNV * dotNV, 0.5 );

        return 1.0 / ( gl * gv );

    } // validated


    // Microfacet Models for Refraction through Rough Surfaces - equation (33)
    // http://graphicrants.blogspot.com/2013/08/specular-brdf-reference.html
    // alpha is "roughness squared" in Disney’s reparameterization
    float D_GGX( const in float alpha, const in float dotNH ) {

        float a2 = alpha * alpha;

        float denom = dotNH * dotNH * ( a2 - 1.0 ) + 1.0; // avoid alpha = 0 with dotNH = 1

        return RECIPROCAL_PI * a2 / ( denom * denom );

    }


    // GGX Distribution, Schlick Fresnel, GGX-Smith Visibility
    vec3 BRDF_Specular_GGX( const in IncidentLight incidentLight, const in GeometricContext geometry, const in vec3 specularColor, const in float roughness ) {

        float alpha = roughness * roughness; // UE4's roughness

        vec3 halfDir = normalize( incidentLight.direction + geometry.viewDir );

        float dotNL = saturate( dot( geometry.normal, incidentLight.direction ) );
        float dotNV = saturate( dot( geometry.normal, geometry.viewDir ) );
        float dotNH = saturate( dot( geometry.normal, halfDir ) );
        float dotLH = saturate( dot( incidentLight.direction, halfDir ) );

        vec3 F = F_Schlick( specularColor, dotLH );

        float G = G_GGX_Smith( alpha, dotNL, dotNV );

        float D = D_GGX( alpha, dotNH );

        return F * ( G * D );

    } // validated


    // ref: https://www.unrealengine.com/blog/physically-based-shading-on-mobile - environmentBRDF for GGX on mobile
    vec3 BRDF_Specular_GGX_Environment( const in GeometricContext geometry, const in vec3 specularColor, const in float roughness ) {

        float dotNV = saturate( dot( geometry.normal, geometry.viewDir ) );

        const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );

        const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );

        vec4 r = roughness * c0 + c1;

        float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;

        vec2 AB = vec2( -1.04, 1.04 ) * a004 + r.zw;

        return specularColor * AB.x + AB.y;

    } // validated


    float G_BlinnPhong_Implicit( /* const in float dotNL, const in float dotNV */ ) {

        // geometry term is (n dot l)(n dot v) / 4(n dot l)(n dot v)
        return 0.25;

    }

    float D_BlinnPhong( const in float shininess, const in float dotNH ) {

        return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );

    }

    vec3 BRDF_Specular_BlinnPhong( const in IncidentLight incidentLight, const in GeometricContext geometry, const in vec3 specularColor, const in float shininess ) {

        vec3 halfDir = normalize( incidentLight.direction + geometry.viewDir );

        //float dotNL = saturate( dot( geometry.normal, incidentLight.direction ) );
        //float dotNV = saturate( dot( geometry.normal, geometry.viewDir ) );
        float dotNH = saturate( dot( geometry.normal, halfDir ) );
        float dotLH = saturate( dot( incidentLight.direction, halfDir ) );

        vec3 F = F_Schlick( specularColor, dotLH );

        float G = G_BlinnPhong_Implicit( /* dotNL, dotNV */ );

        float D = D_BlinnPhong( shininess, dotNH );

        return F * ( G * D );

    } // validated

    // source: http://simonstechblog.blogspot.ca/2011/12/microfacet-brdf.html
    float GGXRoughnessToBlinnExponent( const in float ggxRoughness ) {
        return ( 2.0 / square( ggxRoughness + 0.0001 ) - 2.0 );
    }

    //#include <lights_pars_begin> /-------------------------------------LIGHTS-----------------------------------------
        #if NUM_DIR_LIGHTS > 0

    struct DirectionalLight {
        vec3 direction;
        vec3 color;

        int shadow;
        float shadowBias;
        float shadowRadius;
        vec2 shadowMapSize;
    };

    uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];

    IncidentLight getDirectionalDirectLight( const in DirectionalLight directionalLight, const in GeometricContext geometry ) {

        IncidentLight directLight;

        directLight.color = directionalLight.color;
        directLight.direction = directionalLight.direction;
        directLight.visible = true;

        return directLight;

    }

        #endif


        #if NUM_POINT_LIGHTS > 0

    struct PointLight {
        vec3 position;
        vec3 color;
        float distance;
        float decay;

        int shadow;
        float shadowBias;
        float shadowRadius;
        vec2 shadowMapSize;
    };

    uniform PointLight pointLights[ NUM_POINT_LIGHTS ];

    IncidentLight getPointDirectLight( const in PointLight pointLight, const in GeometricContext geometry ) {

        IncidentLight directLight;

        vec3 lVector = pointLight.position - geometry.position;
        directLight.direction = normalize( lVector );

        float lightDistance = length( lVector );

        if ( testLightInRange( lightDistance, pointLight.distance ) ) {

            directLight.color = pointLight.color;
            directLight.color *= calcLightAttenuation( lightDistance, pointLight.distance, pointLight.decay );
            directLight.visible = true;

        } else {

            directLight.color = vec3( 0.0 );
            directLight.visible = false;

        }

        return directLight;

    }

        #endif


        #if NUM_SPOT_LIGHTS > 0

    struct SpotLight {
        vec3 position;
        vec3 direction;
        vec3 color;
        float distance;
        float decay;
        float angleCos;
        float penumbra;

        int shadow;
        float shadowBias;
        float shadowRadius;
        vec2 shadowMapSize;
    };

    uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];

    IncidentLight getSpotDirectLight( const in SpotLight spotLight, const in GeometricContext geometry ) {

        IncidentLight directLight;

        vec3 lVector = spotLight.position - geometry.position;
        directLight.direction = normalize( lVector );

        float lightDistance = length( lVector );
        float spotEffect = dot( directLight.direction, spotLight.direction );

        if ( all( bvec2( spotEffect > spotLight.angleCos, testLightInRange( lightDistance, spotLight.distance ) ) ) ) {

            float spotEffect = dot( spotLight.direction, directLight.direction );
            spotEffect *= clamp( ( spotEffect - spotLight.angleCos ) / spotLight.penumbra, 0.0, 1.0 );

            directLight.color = spotLight.color;
            directLight.color *= ( spotEffect * calcLightAttenuation( lightDistance, spotLight.distance, spotLight.decay ) );
            directLight.visible = true;

        } else {

            directLight.color = vec3( 0.0 );
            directLight.visible = false;

        }

        return directLight;

    }

        #endif


        #if NUM_HEMI_LIGHTS > 0

    struct HemisphereLight {
        vec3 direction;
        vec3 skyColor;
        vec3 groundColor;
    };

    uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];

    vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in GeometricContext geometry ) {

        float dotNL = dot( geometry.normal, hemiLight.direction );
        float hemiDiffuseWeight = 0.5 * dotNL + 0.5;

        return PI * mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );

    }

        #endif


        #if defined( USE_ENVMAP ) && defined( STANDARD )

    vec3 getLightProbeIndirectIrradiance( /*const in SpecularLightProbe specularLightProbe,*/ const in GeometricContext geometry, const in int maxMIPLevel ) {

        #ifdef DOUBLE_SIDED

        float flipNormal = ( float( gl_FrontFacing ) * 2.0 - 1.0 );

        #else

        float flipNormal = 1.0;

        #endif

        vec3 worldNormal = inverseTransformDirection( geometry.normal, viewMatrix );

        #ifdef ENVMAP_TYPE_CUBE

        vec3 queryVec = flipNormal * vec3( flipEnvMap * worldNormal.x, worldNormal.yz );

        // TODO: replace with properly filtered cubemaps and access the irradiance LOD level, be it the last LOD level
        // of a specular cubemap, or just the default level of a specially created irradiance cubemap.

        #ifdef TEXTURE_LOD_EXT

        vec4 envMapColor = textureCubeLodEXT( envMap, queryVec, float( maxMIPLevel ) );

        #else

        // force the bias high to get the last LOD level as it is the most blurred.
        vec4 envMapColor = textureCube( envMap, queryVec, float( maxMIPLevel ) );

        #endif

        #else

        vec3 envMapColor = vec3( 0.0 );

        #endif

        envMapColor.rgb = inputToLinear( envMapColor.rgb );

        return PI * envMapColor.rgb * envMapIntensity;

    }

    // taken from here: http://casual-effects.blogspot.ca/2011/08/plausible-environment-lighting-in-two.html
    float getSpecularMIPLevel( const in float blinnShininessExponent, const in int maxMIPLevel ) {

        //float envMapWidth = pow( 2.0, maxMIPLevelScalar );
        //float desiredMIPLevel = log2( envMapWidth * sqrt( 3.0 ) ) - 0.5 * log2( square( blinnShininessExponent ) + 1.0 );

        float maxMIPLevelScalar = float( maxMIPLevel );
        float desiredMIPLevel = maxMIPLevelScalar - 0.79248 - 0.5 * log2( square( blinnShininessExponent ) + 1.0 );

        // clamp to allowable LOD ranges.
        return clamp( desiredMIPLevel, 0.0, maxMIPLevelScalar );

    }

    vec3 getLightProbeIndirectRadiance( /*const in SpecularLightProbe specularLightProbe,*/ const in GeometricContext geometry, const in float blinnShininessExponent, const in int maxMIPLevel ) {

        #ifdef ENVMAP_MODE_REFLECTION

        vec3 reflectVec = reflect( -geometry.viewDir, geometry.normal );

        #else

        vec3 reflectVec = refract( -geometry.viewDir, geometry.normal, refractionRatio );

        #endif

        #ifdef DOUBLE_SIDED

        float flipNormal = ( float( gl_FrontFacing ) * 2.0 - 1.0 );

        #else

        float flipNormal = 1.0;

        #endif

        reflectVec = inverseTransformDirection( reflectVec, viewMatrix );

        float specularMIPLevel = getSpecularMIPLevel( blinnShininessExponent, maxMIPLevel );

        #ifdef ENVMAP_TYPE_CUBE

        vec3 queryReflectVec = flipNormal * vec3( flipEnvMap * reflectVec.x, reflectVec.yz );

        #ifdef TEXTURE_LOD_EXT

        vec4 envMapColor = textureCubeLodEXT( envMap, queryReflectVec, specularMIPLevel );

        #else

        vec4 envMapColor = textureCube( envMap, queryReflectVec, specularMIPLevel );

        #endif

        #elif defined( ENVMAP_TYPE_EQUIREC )

        vec2 sampleUV;
        sampleUV.y = saturate( flipNormal * reflectVec.y * 0.5 + 0.5 );
        sampleUV.x = atan( flipNormal * reflectVec.z, flipNormal * reflectVec.x ) * RECIPROCAL_PI2 + 0.5;

        #ifdef TEXTURE_LOD_EXT

        vec4 envMapColor = texture2DLodEXT( envMap, sampleUV, specularMIPLevel );

        #else

        vec4 envMapColor = texture2D( envMap, sampleUV, specularMIPLevel );

        #endif

        #elif defined( ENVMAP_TYPE_SPHERE )

        vec3 reflectView = flipNormal * normalize((viewMatrix * vec4( reflectVec, 0.0 )).xyz + vec3(0.0,0.0,1.0));

        #ifdef TEXTURE_LOD_EXT

        vec4 envMapColor = texture2DLodEXT( envMap, reflectView.xy * 0.5 + 0.5, specularMIPLevel );

        #else

        vec4 envMapColor = texture2D( envMap, reflectView.xy * 0.5 + 0.5, specularMIPLevel );

        #endif

        #endif

        envMapColor.rgb = inputToLinear( envMapColor.rgb );

        return envMapColor.rgb * envMapIntensity;

    }

        #endif


    //#include <lights_phong_pars_fragment>  //---------------------------LIGTHS_PHONG----------------------------------
        #ifdef USE_ENVMAP

    varying vec3 vWorldPosition;

    #endif

    varying vec3 vViewPosition;

    #ifndef FLAT_SHADED

    varying vec3 vNormal;

    #endif


    struct BlinnPhongMaterial {

        vec3	diffuseColor;
        vec3	specularColor;
        float	specularShininess;
        float	specularStrength;

    };

    void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in GeometricContext geometry, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {

        float dotNL = saturate( dot( geometry.normal, directLight.direction ) );

        vec3 irradiance = dotNL * PI * directLight.color; // punctual light

        reflectedLight.directDiffuse += irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );
        reflectedLight.directSpecular += irradiance * BRDF_Specular_BlinnPhong( directLight, geometry, material.specularColor, material.specularShininess ) * material.specularStrength;

    }

    void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in GeometricContext geometry, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {

        reflectedLight.indirectDiffuse += irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );

    }

        #define RE_Direct				RE_Direct_BlinnPhong
        #define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong

        #define Material_LightProbeLOD( material )	(0)



    //#include <shadowmap_pars_fragment> //---------------------------------------SHADOW_MAP----------------------------
        #ifdef USE_SHADOWMAP

        #if NUM_DIR_LIGHTS > 0

    uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHTS ];
    varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHTS ];

    #endif

    #if NUM_SPOT_LIGHTS > 0

    uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHTS ];
    varying vec4 vSpotShadowCoord[ NUM_SPOT_LIGHTS ];

    #endif

    #if NUM_POINT_LIGHTS > 0

    uniform sampler2D pointShadowMap[ NUM_POINT_LIGHTS ];
    varying vec4 vPointShadowCoord[ NUM_POINT_LIGHTS ];

    #endif

    float unpackDepth( const in vec4 rgba_depth ) {

        const vec4 bit_shift = vec4( 1.0 / ( 256.0 * 256.0 * 256.0 ), 1.0 / ( 256.0 * 256.0 ), 1.0 / 256.0, 1.0 );
        return dot( rgba_depth, bit_shift );

    }

    float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {

        return step( compare, unpackDepth( texture2D( depths, uv ) ) );

    }

    float texture2DShadowLerp( sampler2D depths, vec2 size, vec2 uv, float compare ) {

        const vec2 offset = vec2( 0.0, 1.0 );

        vec2 texelSize = vec2( 1.0 ) / size;
        vec2 centroidUV = floor( uv * size + 0.5 ) / size;

        float lb = texture2DCompare( depths, centroidUV + texelSize * offset.xx, compare );
        float lt = texture2DCompare( depths, centroidUV + texelSize * offset.xy, compare );
        float rb = texture2DCompare( depths, centroidUV + texelSize * offset.yx, compare );
        float rt = texture2DCompare( depths, centroidUV + texelSize * offset.yy, compare );

        vec2 f = fract( uv * size + 0.5 );

        float a = mix( lb, lt, f.y );
        float b = mix( rb, rt, f.y );
        float c = mix( a, b, f.x );

        return c;

    }

    float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord ) {

        shadowCoord.xyz /= shadowCoord.w;
        shadowCoord.z += shadowBias;

        // if ( something && something ) breaks ATI OpenGL shader compiler
        // if ( all( something, something ) ) using this instead

        bvec4 inFrustumVec = bvec4 ( shadowCoord.x >= 0.0, shadowCoord.x <= 1.0, shadowCoord.y >= 0.0, shadowCoord.y <= 1.0 );
        bool inFrustum = all( inFrustumVec );

        bvec2 frustumTestVec = bvec2( inFrustum, shadowCoord.z <= 1.0 );

        bool frustumTest = all( frustumTestVec );

        if ( frustumTest ) {

            #if defined( SHADOWMAP_TYPE_PCF )

            vec2 texelSize = vec2( 1.0 ) / shadowMapSize;

            float dx0 = - texelSize.x * shadowRadius;
            float dy0 = - texelSize.y * shadowRadius;
            float dx1 = + texelSize.x * shadowRadius;
            float dy1 = + texelSize.y * shadowRadius;

            return (
            texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
            texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
            texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
            texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
            texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
            texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
            texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
            texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
            texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
            ) * ( 1.0 / 9.0 );

            #elif defined( SHADOWMAP_TYPE_PCF_SOFT )

            vec2 texelSize = vec2( 1.0 ) / shadowMapSize;

            float dx0 = - texelSize.x * shadowRadius;
            float dy0 = - texelSize.y * shadowRadius;
            float dx1 = + texelSize.x * shadowRadius;
            float dy1 = + texelSize.y * shadowRadius;

            return (
            texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
            texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
            texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
            texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
            texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy, shadowCoord.z ) +
            texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
            texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
            texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
            texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
            ) * ( 1.0 / 9.0 );

            #else // no percentage-closer filtering:

            return texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );

            #endif

        }

        return 1.0;

    }

    // cubeToUV() maps a 3D direction vector suitable for cube texture mapping to a 2D
    // vector suitable for 2D texture mapping. This code uses the following layout for the
    // 2D texture:
    //
    // xzXZ
    //  y Y
    //
    // Y - Positive y direction
    // y - Negative y direction
    // X - Positive x direction
    // x - Negative x direction
    // Z - Positive z direction
    // z - Negative z direction
    //
    // Source and test bed:
    // https://gist.github.com/tschw/da10c43c467ce8afd0c4

    vec2 cubeToUV( vec3 v, float texelSizeY ) {

        // Number of texels to avoid at the edge of each square

        vec3 absV = abs( v );

        // Intersect unit cube

        float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
        absV *= scaleToCube;

        // Apply scale to avoid seams

        // two texels less per square (one texel will do for NEAREST)
        v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );

        // Unwrap

        // space: -1 ... 1 range for each square
        //
        // #X##		dim    := ( 4 , 2 )
        //  # #		center := ( 1 , 1 )

        vec2 planar = v.xy;

        float almostATexel = 1.5 * texelSizeY;
        float almostOne = 1.0 - almostATexel;

        if ( absV.z >= almostOne ) {

            if ( v.z > 0.0 )
            planar.x = 4.0 - v.x;

        } else if ( absV.x >= almostOne ) {

            float signX = sign( v.x );
            planar.x = v.z * signX + 2.0 * signX;

        } else if ( absV.y >= almostOne ) {

            float signY = sign( v.y );
            planar.x = v.x + 2.0 * signY + 2.0;
            planar.y = v.z * signY - 2.0;

        }

        // Transform to UV space

        // scale := 0.5 / dim
        // translate := ( center + 0.5 ) / dim
        return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );

    }

    float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord ) {

        vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );

        // for point lights, the uniform @vShadowCoord is re-purposed to hold
        // the distance from the light to the world-space position of the fragment.
        vec3 lightToPosition = shadowCoord.xyz;

        // bd3D = base direction 3D
        vec3 bd3D = normalize( lightToPosition );
        // dp = distance from light to fragment position
        float dp = ( length( lightToPosition ) - shadowBias ) / 1000.0;

        #if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT )

        vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;

        return (
        texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
        texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
        texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
        texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
        texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
        texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
        texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
        texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
        texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
        ) * ( 1.0 / 9.0 );

        #else // no percentage-closer filtering

        return texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );

        #endif

    }

        #endif

    //#include <bumpmap_pars_fragment> //-------------------------BUMP_MAP----------------------------------------------
        #ifdef USE_BUMPMAP

    uniform sampler2D bumpMap;
    uniform float bumpScale;

    // Derivative maps - bump mapping unparametrized surfaces by Morten Mikkelsen
    // http://mmikkelsen3d.blogspot.sk/2011/07/derivative-maps.html

    // Evaluate the derivative of the height w.r.t. screen-space using forward differencing (listing 2)

    vec2 dHdxy_fwd() {

        vec2 dSTdx = dFdx( vUv );
        vec2 dSTdy = dFdy( vUv );

        float Hll = bumpScale * texture2D( bumpMap, vUv ).x;
        float dBx = bumpScale * texture2D( bumpMap, vUv + dSTdx ).x - Hll;
        float dBy = bumpScale * texture2D( bumpMap, vUv + dSTdy ).x - Hll;

        return vec2( dBx, dBy );

    }

    vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy ) {

        vec3 vSigmaX = dFdx( surf_pos );
        vec3 vSigmaY = dFdy( surf_pos );
        vec3 vN = surf_norm;		// normalized

        vec3 R1 = cross( vSigmaY, vN );
        vec3 R2 = cross( vN, vSigmaX );

        float fDet = dot( vSigmaX, R1 );

        vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
        return normalize( abs( fDet ) * surf_norm - vGrad );

    }

        #endif

    //#include <normalmap_pars_fragment> //--------------------------NORMAL_MAP-----------------------------------------

        #ifdef USE_NORMALMAP

    uniform sampler2D normalMap;
    uniform vec2 normalScale;

    // Per-Pixel Tangent Space Normal Mapping
    // http://hacksoflife.blogspot.ch/2009/11/per-pixel-tangent-space-normal-mapping.html

    vec3 perturbNormal2Arb( vec3 eye_pos, vec3 surf_norm ) {

        vec3 q0 = dFdx( eye_pos.xyz );
        vec3 q1 = dFdy( eye_pos.xyz );
        vec2 st0 = dFdx( vUv.st );
        vec2 st1 = dFdy( vUv.st );

        vec3 S = normalize( q0 * st1.t - q1 * st0.t );
        vec3 T = normalize( -q0 * st1.s + q1 * st0.s );
        vec3 N = normalize( surf_norm );

        vec3 mapN = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0;
        mapN.xy = normalScale * mapN.xy;
        mat3 tsn = mat3( S, T, N );
        return normalize( tsn * mapN );

    }

        #endif

    //#include <specularmap_pars_fragment>  //--------------------------SPECULAR_MAP------------------------------------
        #ifdef USE_SPECULARMAP

    uniform sampler2D specularMap;

    #endif

    //#include <logdepthbuf_pars_fragment>  //--------------------------LOG_DEPTH_BUFFER--------------------------------
    #ifdef USE_LOGDEPTHBUF

    uniform float logDepthBufFC;

    #ifdef USE_LOGDEPTHBUF_EXT

    varying float vFragDepth;

    #endif

    #endif

    //#include <clipping_planes_pars_fragment>  //------------------------CLIPPING_PLANES-------------------------------

void main() {//================================================MAIN============================================================================

    //#include <clipping_planes_fragment>  //------------------------------CLIPPING_PLANES++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    vec4 diffuseColor = vec4( diffuse, opacity );
    ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
    vec3 totalEmissiveRadiance = emissive;
    //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

    //#include <logdepthbuf_fragment> //+++++++++++++++++++++++++++++++++LOG_DEPTH_BUFFER+++++++++++++++++++++++++++++++
    #if defined(USE_LOGDEPTHBUF) && defined(USE_LOGDEPTHBUF_EXT)

    gl_FragDepthEXT = log2(vFragDepth) * logDepthBufFC * 0.5;

    #endif

    //#include <map_fragment> //++++++++++++++++++++++++++++++++++++++++MAP+++++++++++++++++++++++++++++++++++++++++++++
    #ifdef USE_MAP

    vec4 texelColor = texture2D( map, vUv );

    texelColor.xyz = inputToLinear( texelColor.xyz );

    diffuseColor *= texelColor;

    #endif

    //#include <color_fragment>  //++++++++++++++++++++++++++++++++++++++++COLOR++++++++++++++++++++++++++++++++++++++++
    #ifdef USE_COLOR

    diffuseColor.rgb *= vColor;

    #endif

    //#include <alphamap_fragment>  //++++++++++++++++++++++++++++++++++++ALPHA_MAP+++++++++++++++++++++++++++++++++++++
    #ifdef USE_ALPHAMAP

    diffuseColor.a *= texture2D( alphaMap, vUv ).g;

    #endif

    //#include <alphatest_fragment>  //++++++++++++++++++++++++++++++++++ALPHA_TEST+++++++++++++++++++++++++++++++++++++
    #ifdef ALPHATEST

    if ( diffuseColor.a < ALPHATEST ) discard;

    #endif

    //#include <specularmap_fragment> //+++++++++++++++++++++++++++++++++SPECULAR_MAP ++++++++++++++++++++++++++++++++++
    float specularStrength;

    #ifdef USE_SPECULARMAP

    vec4 texelSpecular = texture2D( specularMap, vUv );
    specularStrength = texelSpecular.r;

    #else

    specularStrength = 1.0;

    #endif

    //#include <normal_fragment_begin> //++++++++++++++++++++++++++++++++NORMAL+++++++++++++++++++++++++++++++++++++++++
    #ifdef FLAT_SHADED

    vec3 fdx = vec3( dFdx( vViewPosition.x ), dFdx( vViewPosition.y ), dFdx( vViewPosition.z ) );
    vec3 fdy = vec3( dFdy( vViewPosition.x ), dFdy( vViewPosition.y ), dFdy( vViewPosition.z ) );
    vec3 normal = normalize( cross( fdx, fdy ) );

    #else

    vec3 normal = normalize( vNormal );

    #ifdef DOUBLE_SIDED

    normal = normal * ( -1.0 + 2.0 * float( gl_FrontFacing ) );

    #endif

    #endif

    #ifdef USE_NORMALMAP

    normal = perturbNormal2Arb( -vViewPosition, normal );

    #elif defined( USE_BUMPMAP )

    normal = perturbNormalArb( -vViewPosition, normal, dHdxy_fwd() );

    #endif

    //#include <normal_fragment_maps>  //+++++++++++++++++++++++++++++++++NORMAL_MAPS+++++++++++++++++++++++++++++++++++
    //#include <emissivemap_fragment>  //++++++++++++++++++++++++++++++++EMISSIVE_MAP+++++++++++++++++++++++++++++++++++
    #ifdef USE_EMISSIVEMAP

    vec4 emissiveColor = texture2D( emissiveMap, vUv );

    emissiveColor.rgb = inputToLinear( emissiveColor.rgb );

    totalEmissiveLight *= emissiveColor.rgb;

    #endif


    // accumulation
    //#include <lights_phong_fragment>  //+++++++++++++++++++++++++++++++LIGHTS_PHONG+++++++++++++++++++++++++++++++++++
    BlinnPhongMaterial material;
    material.diffuseColor = diffuseColor.rgb;
    material.specularColor = specular;
    material.specularShininess = shininess;
    material.specularStrength = specularStrength;

    //#include <lights_fragment_begin>  //++++++++++++++++++++++++++++++LIGHTS_BEGIN++++++++++++++++++++++++++++++++++++
    //
    // This is a template that can be used to light a material, it uses pluggable RenderEquations (RE)
    //   for specific lighting scenarios.
    //
    // Instructions for use:
    //  - Ensure that both RE_Direct, RE_IndirectDiffuse and RE_IndirectSpecular are defined
    //  - If you have defined an RE_IndirectSpecular, you need to also provide a Material_LightProbeLOD. <---- ???
    //  - Create a material parameter that is to be passed as the third parameter to your lighting functions.
    //
    // TODO:
    //  - Add area light support.
    //  - Add sphere light support.
    //  - Add diffuse light probe (irradiance cubemap) support.
    //

    GeometricContext geometry;

    geometry.position = - vViewPosition;
    geometry.normal = normal;
    geometry.viewDir = normalize( vViewPosition );

    IncidentLight directLight;

    #if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )

    PointLight pointLight;

    for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {

        pointLight = pointLights[ i ];

        directLight = getPointDirectLight( pointLight, geometry );

        #ifdef USE_SHADOWMAP
        directLight.color *= all( bvec2( pointLight.shadow, directLight.visible ) ) ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ] ) : 1.0;
        #endif

        RE_Direct( directLight, geometry, material, reflectedLight );

    }

        #endif

        #if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )

    SpotLight spotLight;

    for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {

        spotLight = spotLights[ i ];

        directLight = getSpotDirectLight( spotLight, geometry );

        #ifdef USE_SHADOWMAP
        directLight.color *= all( bvec2( spotLight.shadow, directLight.visible ) ) ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowBias, spotLight.shadowRadius, vSpotShadowCoord[ i ] ) : 1.0;
        #endif

        RE_Direct( directLight, geometry, material, reflectedLight );

    }

        #endif

        #if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )

    DirectionalLight directionalLight;

    for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {

        directionalLight = directionalLights[ i ];

        directLight = getDirectionalDirectLight( directionalLight, geometry );

        #ifdef USE_SHADOWMAP
        directLight.color *= all( bvec2( directionalLight.shadow, directLight.visible ) ) ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
        #endif

        RE_Direct( directLight, geometry, material, reflectedLight );

    }

        #endif

        #if defined( RE_IndirectDiffuse )

    vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );

    #ifdef USE_LIGHTMAP

    irradiance += PI * texture2D( lightMap, vUv2 ).xyz * lightMapIntensity; // factor of PI should not be present; included here to prevent breakage

    #endif

    #if ( NUM_HEMI_LIGHTS > 0 )

    for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {

        irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry );

    }

        #endif

        // #if defined( USE_ENVMAP ) && defined( STANDARD )

        // TODO, replace 8 with the real maxMIPLevel
        // irradiance += getLightProbeIndirectIrradiance( /*lightProbe,*/ geometry, 8 ); // comment out until seams are fixed

        // #endif

        RE_IndirectDiffuse( irradiance, geometry, material, reflectedLight );

    #endif

    #if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )

    // TODO, replace 8 with the real maxMIPLevel
    vec3 radiance = getLightProbeIndirectRadiance( /*specularLightProbe,*/ geometry, Material_BlinnShininessExponent( material ), 8 );

    RE_IndirectSpecular( radiance, geometry, material, reflectedLight );

    #endif

//    #include <lights_fragment_maps>
//    #include <lights_fragment_end>

    // modulation
    //#include <aomap_fragment>  //++++++++++++++++++++++++++++++++++++++++++AO_MAP+++++++++++++++++++++++++++++++++++++
    #ifdef USE_AOMAP

    reflectedLight.indirectDiffuse *= ( texture2D( aoMap, vUv2 ).r - 1.0 ) * aoMapIntensity + 1.0;

    #endif

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

    //#include <envmap_fragment> //+++++++++++++++++++++++++++++++++ENVIRONMENTAL_MAP+++++++++++++++++++++++++++++++++++
    #ifdef USE_ENVMAP

    #if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG )

    vec3 cameraToVertex = normalize( vWorldPosition - cameraPosition );

    // Transforming Normal Vectors with the Inverse Transformation
    vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );

    #ifdef ENVMAP_MODE_REFLECTION

    vec3 reflectVec = reflect( cameraToVertex, worldNormal );

    #else

    vec3 reflectVec = refract( cameraToVertex, worldNormal, refractionRatio );

    #endif

    #else

    vec3 reflectVec = vReflect;

    #endif

    #ifdef DOUBLE_SIDED
    float flipNormal = ( float( gl_FrontFacing ) * 2.0 - 1.0 );
    #else
    float flipNormal = 1.0;
    #endif

    #ifdef ENVMAP_TYPE_CUBE
    vec4 envColor = textureCube( envMap, flipNormal * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );

    #elif defined( ENVMAP_TYPE_EQUIREC )
    vec2 sampleUV;
    sampleUV.y = saturate( flipNormal * reflectVec.y * 0.5 + 0.5 );
    sampleUV.x = atan( flipNormal * reflectVec.z, flipNormal * reflectVec.x ) * RECIPROCAL_PI2 + 0.5;
    vec4 envColor = texture2D( envMap, sampleUV );

    #elif defined( ENVMAP_TYPE_SPHERE )
    vec3 reflectView = flipNormal * normalize((viewMatrix * vec4( reflectVec, 0.0 )).xyz + vec3(0.0,0.0,1.0));
    vec4 envColor = texture2D( envMap, reflectView.xy * 0.5 + 0.5 );
    #endif

    envColor.xyz = inputToLinear( envColor.xyz );

    #ifdef ENVMAP_BLENDING_MULTIPLY

    outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );

    #elif defined( ENVMAP_BLENDING_MIX )

    outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );

    #elif defined( ENVMAP_BLENDING_ADD )

    outgoingLight += envColor.xyz * specularStrength * reflectivity;

    #endif

    #endif

//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++OUTPUT++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    gl_FragColor = vec4( outgoingLight, diffuseColor.a );
//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

    //#include <tonemapping_fragment> //++++++++++++++++++++++++++++++++++TONE_MAPPING++++++++++++++++++++++++++++++++++

    //#include <encodings_fragment>  //+++++++++++++++++++++++++++++++++++ENCODINGS+++++++++++++++++++++++++++++++++++++

    //#include <fog_fragment>   //++++++++++++++++++++++++++++++++++++++++FOG+++++++++++++++++++++++++++++++++++++++++++
    #ifdef USE_FOG

    #ifdef USE_LOGDEPTHBUF_EXT

    float depth = gl_FragDepthEXT / gl_FragCoord.w;

    #else

    float depth = gl_FragCoord.z / gl_FragCoord.w;

    #endif

    #ifdef FOG_EXP2

    float fogFactor = whiteCompliment( exp2( - fogDensity * fogDensity * depth * depth * LOG2 ) );

    #else

    float fogFactor = smoothstep( fogNear, fogFar, depth );

    #endif

    outgoingLight = mix( outgoingLight, fogColor, fogFactor );

    #endif

    //#include <premultiplied_alpha_fragment>
    //#include <dithering_fragment>

}
