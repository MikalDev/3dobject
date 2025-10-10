#version 300 es
precision highp float;
#define NUM_LIGHTS 8

in mediump vec2 vTex;
in highp vec2 vNPTex;
in highp vec3 pos;
in lowp vec4 vColor;
in highp vec3 vNormal;
in highp float vNPW;
in highp vec3 vVertexLighting; // Pre-calculated lighting from vertex shader
out lowp vec4 outColor;
uniform lowp vec4 color;
uniform lowp sampler2D samplerFront;
uniform highp vec2 pixelSize;

// Create random 2d noise pattern with 2d output
highp vec2 random2D( highp vec2 p )
{
    highp vec3 p3  = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx+19.19);
    return fract((p3.xx+p3.yz)*p3.zy);
}
uniform lowp vec3 uDiffuseColor;
uniform lowp float uOpacity;
uniform lowp vec3 uAmbientColor;
uniform lowp float uTextureNormal;
uniform lowp float uEnable0;
uniform lowp vec3 uColor0;
uniform highp float uBrightness0;
uniform highp float uPosX0;
uniform highp float uPosY0;
uniform highp float uPosZ0;
uniform highp float uSpotAngle0;
uniform highp float uSpotEdge0;
uniform highp float uSpotDirX0;
uniform highp float uSpotDirY0;
uniform highp float uSpotDirZ0;
uniform highp float uAttenConstant0;
uniform highp float uAttenLinear0;
uniform highp float uAttenQuadratic0;
uniform lowp float uEnable1;
uniform lowp vec3 uColor1;
uniform highp float uBrightness1;
uniform highp float uPosX1;
uniform highp float uPosY1;
uniform highp float uPosZ1;
uniform highp float uSpotAngle1;
uniform highp float uSpotEdge1;
uniform highp float uSpotDirX1;
uniform highp float uSpotDirY1;
uniform highp float uSpotDirZ1;
uniform highp float uAttenConstant1;
uniform highp float uAttenLinear1;
uniform highp float uAttenQuadratic1;
uniform lowp float uEnable2;
uniform lowp vec3 uColor2;
uniform highp float uBrightness2;
uniform highp float uPosX2;
uniform highp float uPosY2;
uniform highp float uPosZ2;
uniform highp float uSpotAngle2;
uniform highp float uSpotEdge2;
uniform highp float uSpotDirX2;
uniform highp float uSpotDirY2;
uniform highp float uSpotDirZ2;
uniform highp float uAttenConstant2;
uniform highp float uAttenLinear2;
uniform highp float uAttenQuadratic2;
uniform lowp float uEnable3;
uniform lowp vec3 uColor3;
uniform highp float uBrightness3;
uniform highp float uPosX3;
uniform highp float uPosY3;
uniform highp float uPosZ3;
uniform highp float uSpotAngle3;
uniform highp float uSpotEdge3;
uniform highp float uSpotDirX3;
uniform highp float uSpotDirY3;
uniform highp float uSpotDirZ3;
uniform highp float uAttenConstant3;
uniform highp float uAttenLinear3;
uniform highp float uAttenQuadratic3;
uniform lowp float uEnable4;
uniform lowp vec3 uColor4;
uniform highp float uBrightness4;
uniform highp float uPosX4;
uniform highp float uPosY4;
uniform highp float uPosZ4;
uniform highp float uSpotAngle4;
uniform highp float uSpotEdge4;
uniform highp float uSpotDirX4;
uniform highp float uSpotDirY4;
uniform highp float uSpotDirZ4;
uniform highp float uAttenConstant4;
uniform highp float uAttenLinear4;
uniform highp float uAttenQuadratic4;
uniform lowp float uEnable5;
uniform lowp vec3 uColor5;
uniform highp float uBrightness5;
uniform highp float uPosX5;
uniform highp float uPosY5;
uniform highp float uPosZ5;
uniform highp float uSpotAngle5;
uniform highp float uSpotEdge5;
uniform highp float uSpotDirX5;
uniform highp float uSpotDirY5;
uniform highp float uSpotDirZ5;
uniform highp float uAttenConstant5;
uniform highp float uAttenLinear5;
uniform highp float uAttenQuadratic5;
uniform lowp float uEnable6;
uniform lowp vec3 uColor6;
uniform highp float uBrightness6;
uniform highp float uPosX6;
uniform highp float uPosY6;
uniform highp float uPosZ6;
uniform highp float uSpotAngle6;
uniform highp float uSpotEdge6;
uniform highp float uSpotDirX6;
uniform highp float uSpotDirY6;
uniform highp float uSpotDirZ6;
uniform highp float uAttenConstant6;
uniform highp float uAttenLinear6;
uniform highp float uAttenQuadratic6;
uniform lowp float uEnable7;
uniform lowp vec3 uColor7;
uniform highp float uBrightness7;
uniform highp float uPosX7;
uniform highp float uPosY7;
uniform highp float uPosZ7;
uniform highp float uSpotAngle7;
uniform highp float uSpotEdge7;
uniform highp float uSpotDirX7;
uniform highp float uSpotDirY7;
uniform highp float uSpotDirZ7;
uniform highp float uAttenConstant7;
uniform highp float uAttenLinear7;
uniform highp float uAttenQuadratic7;
uniform highp float uDirectionalEnable;
uniform highp vec3 uDirectionalColor;
uniform highp float uDirectionalBrightness;
uniform highp float uDirectionalDirX;
uniform highp float uDirectionalDirY;
uniform highp float uDirectionalDirZ;
uniform highp float uFogEnable;
uniform highp vec3 uFogColor;
uniform highp float uFogDensity;
uniform highp float uFogCameraPosX;
uniform highp float uFogCameraPosY;
uniform highp float uFogCameraPosZ;
uniform highp float uFogStart;
uniform highp float uFogEnd;
uniform highp float uFogHeightStart;
uniform highp float uFogHeightEnd;
uniform highp float uScreendoorEnable;
uniform highp float uTileEnable;
uniform highp float uTileOffsetX;
uniform highp float uTileOffsetY;
uniform highp float uTileScaleX;
uniform highp float uTileScaleY;
uniform highp float uTileRandomScale;
uniform highp float uVertexColorEnable;
uniform highp float uSpecularEnable;
uniform highp vec3 uSpecularColor;
uniform highp float uShininess;
uniform highp float uSpecularIntensity;
uniform highp float uViewPositionX;
uniform highp float uViewPositionY;
uniform highp float uViewPositionZ;
uniform highp float uNoPerspectiveUVEnable;
uniform highp float uVertexLightingMode;
uniform highp float uPhongEnable;

uniform highp vec2 srcOriginStart;
uniform highp vec2 srcOriginEnd;

// Create a semi random 2d noise pattern with low spatial slope in noise output vs 2d input
highp float hash( highp vec2 p )
{
	highp vec3 p3  = fract(vec3(p.xyx) * .1031);
	p3 += dot(p3, p3.yzx+19.19);
	return max(0.8,fract((p3.x + p3.y) * p3.z));
}

vec2 reflectDiagonal(vec2 uv) {
    return vec2(uv.y, uv.x);
}

highp vec2 tiled( highp vec2 uv )
{
    // Create 0-1 range for uv based on srcOriginStart and srcOriginEnd
    highp vec2 uvN = (uv - srcOriginStart) / (srcOriginEnd - srcOriginStart);
    uvN = uvN + vec2(uTileOffsetX, uTileOffsetY);
    uvN = uvN * vec2(uTileScaleX, uTileScaleY);
    highp vec2 tileNum = floor(uvN + vec2(1.0));
    bool isOdd = mod(tileNum.x + tileNum.y, 2.0) > 1.0;

    highp vec2 noise = random2D(tileNum) * uTileRandomScale;
    // noise = vec2(0.0,0.0);
    uvN = reflectDiagonal(uvN);
    uvN = fract(uvN + noise);
    return uvN * (srcOriginEnd - srcOriginStart) + srcOriginStart;
}


highp float luminance(in highp vec3 c)
{
	return dot(c, vec3(.2126, .7152, .0722));
}

highp vec3 normalColor(in highp vec2 uv, sampler2D nSampler)
{
	highp vec2 s = pixelSize;
	const highp vec2 size = vec2(2.0,0.0);
	const highp vec3 off = vec3(-1.,0.,1.);
	highp float s11 = luminance(texture(nSampler,uv).xyz);
	highp float s01 = luminance(texture(nSampler, uv+off.xy*0.0001).xyz);
	highp float s10 = luminance(texture(nSampler, uv+off.yx*0.0001).xyz);
	highp vec3 va = (vec3(size.xy*0.001, s01 - s11));
	highp vec3 vb = (vec3(size.yx*0.001, s10 - s11));
	highp vec3 normalV = normalize(cross(va, vb));
	return normalV;
}

highp vec3 fog (in highp vec3 tex, in highp vec3 pos)
{
    // Sample the texture to get the base color
    vec3 baseColor = tex;

    // Construct the camera position from individual components
    vec3 cameraPos = vec3(uFogCameraPosX, uFogCameraPosY, uFogCameraPosZ);

    // Calculate the distance from the camera to the fragment
    float distance = length(pos - cameraPos);

    // Compute the fog factor using linear interpolation between uFogStart and uFogEnd
    // use smoothstep for a smoother transition
    float fogFactor = smoothstep(uFogStart, uFogEnd, distance);

    // Adjust fogFactor for exponential density
    // fogFactor = 1.0 - exp(-uFogDensity * distance);

    // Adjust fog factor based on z height, using uFogHeightStart and uFoHeightEnd
    float heightFactor = clamp((uFogHeightStart - pos.z) / (uFogHeightStart - uFogHeightEnd), 0.0, 1.0);

    fogFactor = fogFactor * heightFactor;

    // Mix the fog color with the fragment's base color based on the fog factor
    vec3 color = mix(baseColor.rgb, uFogColor, fogFactor);

    // Set the final color of the fragment
    return color;
}

float dither4x4(vec2 position, float brightness) {
    const float ditherThresholds[16] = float[](
        0.0625, 0.5625, 0.1875, 0.6875,
        0.8125, 0.3125, 0.9375, 0.4375,
        0.25,   0.75,   0.125,  0.625,
        1.0,    0.5,    0.875,  0.375
    );

    int x = int(mod(position.x, 4.0));
    int y = int(mod(position.y, 4.0));
    int index = x + y * 4;
    float limit = ditherThresholds[index];

    return brightness < limit ? 0.0 : 1.0;
}

float screenDoor(vec2 uv, float brightness) {
    // vec2 position = uv/pixelSize;
    vec2 position = gl_FragCoord.xy;
    float dither = dither4x4(position, brightness * 1.5);
    return dither;
}

float specular(vec3 pos, vec3 viewDir, vec3 lightDir, vec3 normal, float shininess, float specularIntensity) {
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess);
    return specularIntensity * spec;
}

void main(void) {
	// Variables now come from vertex shader as inputs
	lowp float enableL[NUM_LIGHTS];
	highp vec3 posL[NUM_LIGHTS];
	highp vec4 rgbaL[NUM_LIGHTS];
	highp float spotAngleL[NUM_LIGHTS];
	highp float spotEdgeL[NUM_LIGHTS];
	highp vec3 spotDirL[NUM_LIGHTS];
	highp vec3 attenL[NUM_LIGHTS];

    highp vec3 worldSpaceNormal = vec3(0.0, 0.0, 0.0);
    if (uPhongEnable < 0.5) {
        highp vec3 dx = dFdx(pos); 
        highp vec3 dy = dFdy(pos);
        worldSpaceNormal = normalize(cross(dx, dy));
    } else {
        highp vec3 vNormalTransformed = vec3(vNormal.x, -vNormal.y, -vNormal.z);
        worldSpaceNormal = normalize(vNormalTransformed);
    }

    vec3 viewPosition = vec3(uViewPositionX, uViewPositionY, uViewPositionZ);
    vec3 viewDir = normalize(viewPosition - pos);
    vec3 specularColor = vec3(0.0);

	highp vec3 ambientColorL = uAmbientColor;

	if (uTextureNormal > 0.0) {
		worldSpaceNormal = worldSpaceNormal + uTextureNormal * normalColor(vTex, samplerFront);
	}

    vec2 uv = vTex;
    if (uNoPerspectiveUVEnable > 0.0) {
        uv = vNPTex / vNPW;
    }

    lowp vec2 tiledUV = uTileEnable > 0.0 ? tiled(uv) : uv;
	lowp vec4 tex = texture(samplerFront, tiledUV);
    tex.rgb = tex.rgb * uDiffuseColor;
	highp vec3 sumColor = vec3(0.,0.,0.);

	// Check if vertex lighting mode is enabled
	if (uVertexLightingMode > 0.5) {
		// Use pre-calculated vertex lighting
		sumColor = vVertexLighting;
		// Vertex lighting typically doesn't include specular in the vertex shader
		// but you can still calculate specular per-pixel if needed
		specularColor = vec3(0.0);
	} else {
		// Calculate per-pixel lighting
	if (uEnable0 != 0.0) {
		highp vec3 lightPos = vec3(uPosX0, uPosY0, uPosZ0);
		highp vec3 spotDir = vec3(uSpotDirX0, uSpotDirY0, uSpotDirZ0);
		highp vec3 lightDir = pos-lightPos;
		highp float lightDist = length(lightDir);
		lightDir = normalize(lightDir);
		spotDir = normalize(spotDir);
		highp float light = dot(worldSpaceNormal,lightDir) * 0.5 + 0.5;
		light = light*light;
		highp float cutoff = uSpotAngle0;
		highp float edge = uSpotEdge0;
		highp float spot = dot(spotDir, lightDir);
		spot = spot < cutoff ? smoothstep(cutoff*(1.-edge), cutoff, spot) : 1.0;
		light = light * spot;
		light = light / ((1.0 + uAttenConstant0) + lightDist * uAttenLinear0 + lightDist * lightDist * uAttenQuadratic0);
		sumColor = sumColor + light * uColor0*uBrightness0;
        if (uSpecularEnable > 0.5) {
            specularColor += specular(pos, viewDir, lightDir, worldSpaceNormal, uShininess, uSpecularIntensity);
        }
	}

	if (uEnable1 != 0.0) {
		highp vec3 lightPos = vec3(uPosX1, uPosY1, uPosZ1);
		highp vec3 spotDir = vec3(uSpotDirX1, uSpotDirY1, uSpotDirZ1);
		highp vec3 lightDir = pos-lightPos;
		highp float lightDist = length(lightDir);
		lightDir = normalize(lightDir);
		spotDir = normalize(spotDir);
		highp float light = dot(worldSpaceNormal,lightDir) * 0.5 + 0.5;
		light = light*light;
		highp float cutoff = uSpotAngle1;
		highp float edge = uSpotEdge1;
		highp float spot = dot(spotDir, lightDir);
		spot = spot < cutoff ? smoothstep(cutoff*(1.-edge), cutoff, spot) : 1.0;
		light = light * spot;
		light = light / ((1.0 + uAttenConstant1) + lightDist * uAttenLinear1 + lightDist * lightDist * uAttenQuadratic1);
		sumColor = sumColor + light * uColor1*uBrightness1;
        if (uSpecularEnable > 0.5) {
            specularColor += specular(pos, viewDir, lightDir, worldSpaceNormal, uShininess, uSpecularIntensity);
        }
	}

	if (uEnable2 != 0.0) {
		highp vec3 lightPos = vec3(uPosX2, uPosY2, uPosZ2);
		highp vec3 spotDir = vec3(uSpotDirX2, uSpotDirY2, uSpotDirZ2);
		highp vec3 lightDir = pos-lightPos;
		highp float lightDist = length(lightDir);
		lightDir = normalize(lightDir);
		spotDir = normalize(spotDir);
		highp float light = dot(worldSpaceNormal,lightDir) * 0.5 + 0.5;
		light = light*light;
		highp float cutoff = uSpotAngle2;
		highp float edge = uSpotEdge2;
		highp float spot = dot(spotDir, lightDir);
		spot = spot < cutoff ? smoothstep(cutoff*(1.-edge), cutoff, spot) : 1.0;
		light = light * spot;
		light = light / ((1.0 + uAttenConstant2) + lightDist * uAttenLinear2 + lightDist * lightDist * uAttenQuadratic2);
		sumColor = sumColor + light * uColor2*uBrightness2;
        if (uSpecularEnable > 0.5) {
            specularColor += specular(pos, viewDir, lightDir, worldSpaceNormal, uShininess, uSpecularIntensity);
        }
	}

	if (uEnable3 != 0.0) {
		highp vec3 lightPos = vec3(uPosX3, uPosY3, uPosZ3);
		highp vec3 spotDir = vec3(uSpotDirX3, uSpotDirY3, uSpotDirZ3);
		highp vec3 lightDir = pos-lightPos;
		highp float lightDist = length(lightDir);
		lightDir = normalize(lightDir);
		spotDir = normalize(spotDir);
		highp float light = dot(worldSpaceNormal,lightDir) * 0.5 + 0.5;
		light = light*light;
		highp float cutoff = uSpotAngle3;
		highp float edge = uSpotEdge3;
		highp float spot = dot(spotDir, lightDir);
		spot = spot < cutoff ? smoothstep(cutoff*(1.-edge), cutoff, spot) : 1.0;
		light = light * spot;
		light = light / ((1.0 + uAttenConstant3) + lightDist * uAttenLinear3 + lightDist * lightDist * uAttenQuadratic3);
		sumColor = sumColor + light * uColor3*uBrightness3;
        if (uSpecularEnable > 0.5) {
            specularColor += specular(pos, viewDir, lightDir, worldSpaceNormal, uShininess, uSpecularIntensity);
        }
	}

	if (uEnable4 != 0.0) {
		highp vec3 lightPos = vec3(uPosX4, uPosY4, uPosZ4);
		highp vec3 spotDir = vec3(uSpotDirX4, uSpotDirY4, uSpotDirZ4);
		highp vec3 lightDir = pos-lightPos;
		highp float lightDist = length(lightDir);
		lightDir = normalize(lightDir);
		spotDir = normalize(spotDir);
		highp float light = dot(worldSpaceNormal,lightDir) * 0.5 + 0.5;
		light = light*light;
		highp float cutoff = uSpotAngle4;
		highp float edge = uSpotEdge4;
		highp float spot = dot(spotDir, lightDir);
		spot = spot < cutoff ? smoothstep(cutoff*(1.-edge), cutoff, spot) : 1.0;
		light = light * spot;
		light = light / ((1.0 + uAttenConstant4) + lightDist * uAttenLinear4 + lightDist * lightDist * uAttenQuadratic4);
		sumColor = sumColor + light * uColor4*uBrightness4;
        if (uSpecularEnable > 0.5) {
            specularColor += specular(pos, viewDir, lightDir, worldSpaceNormal, uShininess, uSpecularIntensity);
        }
	}

	if (uEnable5 != 0.0) {
		highp vec3 lightPos = vec3(uPosX5, uPosY5, uPosZ5);
		highp vec3 spotDir = vec3(uSpotDirX5, uSpotDirY5, uSpotDirZ5);
		highp vec3 lightDir = pos-lightPos;
		highp float lightDist = length(lightDir);
		lightDir = normalize(lightDir);
		spotDir = normalize(spotDir);
		highp float light = dot(worldSpaceNormal,lightDir) * 0.5 + 0.5;
		light = light*light;
		highp float cutoff = uSpotAngle5;
		highp float edge = uSpotEdge5;
		highp float spot = dot(spotDir, lightDir);
		spot = spot < cutoff ? smoothstep(cutoff*(1.-edge), cutoff, spot) : 1.0;
		light = light * spot;
		light = light / ((1.0 + uAttenConstant5) + lightDist * uAttenLinear5 + lightDist * lightDist * uAttenQuadratic5);
		sumColor = sumColor + light * uColor5*uBrightness5;
        if (uSpecularEnable > 0.5) {
            specularColor += specular(pos, viewDir, lightDir, worldSpaceNormal, uShininess, uSpecularIntensity);
        }
	}

	if (uEnable6 != 0.0) {
		highp vec3 lightPos = vec3(uPosX6, uPosY6, uPosZ6);
		highp vec3 spotDir = vec3(uSpotDirX6, uSpotDirY6, uSpotDirZ6);
		highp vec3 lightDir = pos-lightPos;
		highp float lightDist = length(lightDir);
		lightDir = normalize(lightDir);
		spotDir = normalize(spotDir);
		highp float light = dot(worldSpaceNormal,lightDir) * 0.5 + 0.5;
		light = light*light;
		highp float cutoff = uSpotAngle6;
		highp float edge = uSpotEdge6;
		highp float spot = dot(spotDir, lightDir);
		spot = spot < cutoff ? smoothstep(cutoff*(1.-edge), cutoff, spot) : 1.0;
		light = light * spot;
		light = light / ((1.0 + uAttenConstant6) + lightDist * uAttenLinear6 + lightDist * lightDist * uAttenQuadratic6);
		sumColor = sumColor + light * uColor6*uBrightness6;
        if (uSpecularEnable > 0.5) {
            specularColor += specular(pos, viewDir, lightDir, worldSpaceNormal, uShininess, uSpecularIntensity);
        }
	}

	if (uEnable7 != 0.0) {
		highp vec3 lightPos = vec3(uPosX7, uPosY7, uPosZ7);
		highp vec3 spotDir = vec3(uSpotDirX7, uSpotDirY7, uSpotDirZ7);
		highp vec3 lightDir = pos-lightPos;
		highp float lightDist = length(lightDir);
		lightDir = normalize(lightDir);
		spotDir = normalize(spotDir);
		highp float light = dot(worldSpaceNormal,lightDir) * 0.5 + 0.5;
		light = light*light;
		highp float cutoff = uSpotAngle7;
		highp float edge = uSpotEdge7;
		highp float spot = dot(spotDir, lightDir);
		spot = spot < cutoff ? smoothstep(cutoff*(1.-edge), cutoff, spot) : 1.0;
		light = light * spot;
		light = light / ((1.0 + uAttenConstant7) + lightDist * uAttenLinear7 + lightDist * lightDist * uAttenQuadratic7);
		sumColor = sumColor + light * uColor7*uBrightness7;
        if (uSpecularEnable > 0.5) {
            specularColor += specular(pos, viewDir, lightDir, worldSpaceNormal, uShininess, uSpecularIntensity);
        }
	}

	if (uDirectionalEnable != 0.0) {
		highp vec3 lightDir = vec3(uDirectionalDirX, uDirectionalDirY, uDirectionalDirZ);
		lightDir = normalize(lightDir);
		highp float light = dot(worldSpaceNormal,lightDir) * 0.5 + 0.5;
		light = light*light;
		sumColor = sumColor + light * uDirectionalColor*uDirectionalBrightness;
        if (uSpecularEnable > 0.5) {
            specularColor += specular(pos, viewDir, lightDir, worldSpaceNormal, uShininess, uSpecularIntensity);
        }
	}
	} // End of per-pixel lighting block
	sumColor = max(ambientColorL, sumColor);
    sumColor += specularColor * uSpecularColor;
	sumColor = min(vec3(1.0), sumColor);
	if (uFogEnable != 0.0) {
		outColor = vec4(fog(sumColor * tex.xyz, pos.xyz), tex.a);
	} else {
	    outColor = vec4(sumColor * tex.xyz, tex.a);
    }
    outColor = outColor * uOpacity;
    bool noDepth = (outColor.a == 0.0);
    if (!noDepth && uScreendoorEnable != 0.0 && outColor.a < 0.99) {
        noDepth = screenDoor(vTex, outColor.a) == 0.0;
	    if (noDepth) {
            outColor = vec4(0.0,0.0,0.0,0.0);
        } else {
            outColor.a = 1.0;
        }
    }
    // if (uVertexColorEnable > 0.0 && (vColor.r > 0.0 || vColor.g > 0.0 || vColor.b > 0.0)) {
    if (uVertexColorEnable > 0.0) {
        outColor.xyz = outColor.xyz * vColor.rgb;  // Use .rgb since vColor is now vec4
        // outColor.xyz = outColor.xyz * vec3(1.0);
        // outColor.xyz = vColor.rgb/65535.0;
    }
	gl_FragDepth = (noDepth ? 1.0 : gl_FragCoord.z);
}
