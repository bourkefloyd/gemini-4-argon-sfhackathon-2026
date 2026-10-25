/**
 * Ultra SDF & A/B Comparison Shader Snippet (`src/rendering/ultra-sdf-shader.ts`)
 *
 * Upgrades the raymarching shader to a 60 FPS Shadertoy-grade visual showcase and implements
 * the live 3-way GPU comparison mode (`uEngineMode`):
 *   - Mode 0 (`ULTRA LOCKSTEP SDF`):
 *     * True optical glass marble refraction (`refract(rd, n, 1.0 / 1.52)`) with chromatic
 *       dispersion (`IOR_R = 1.50, IOR_G = 1.52, IOR_B = 1.55`) magnifying the isometric grid & hazards.
 *     * Focused optical floor caustics projected onto the deck beneath the glass marble.
 *     * Screen-space bevel curvature highlights (`clamp(length(fwidth(n)) * 6.5, 0.0, 1.0)`) along
 *       every smoothUnion fillet and rounded ramp lip.
 *     * 5-step 1-bounce glossy floor reflections (`MAX_REFL_STEPS = 5` with fast 3-tap forward-diff normal)
 *       on ice, goal pads, and anodized track decks when `reflStrength > 0.12 && hitT < 45.0`.
 *     * O(1) infinite domain-repeated cathedral megastructure backdrop (`sdInfiniteMegaPillars`),
 *       evaluated only on background misses or far abyss rays (`length(p.xz) > 22.0 || p.y < -1.5`).
 *     * Dual-scale 2.0m major + 0.5m minor anti-aliased isometric gridlines & Voronoi acid/ice shaders.
 *   - Mode 1 (`BASIC POLYGON MESH + FACETED PHYSICS`):
 *     * Flat-shaded polygon facets (`dFdx(pos) x dFdy(pos)` & 16-segment facet quantization),
 *       wireframe triangle diagonals across every quad, hard CSG seams (`smoothRadius = 0`),
 *       no soft shadows, no AO, no glass refraction, no infinite megastructure backdrop.
 *   - Mode 2 (`SPLIT-SCREEN A/B`):
 *     * Left half (`gl_FragCoord.x < uResolution.x * 0.5`) renders Basic Polygon Mesh;
 *       Right half renders Ultra Lockstep SDF, separated by a glowing vertical A/B laser divider.
 */

export interface UltraSdfShaderPack {
  readonly glsl: string;
  readonly wgsl: string;
}

export function getUltraSdfShaderSnippet(): UltraSdfShaderPack {
  const glsl = `
// Engine Comparison Mode: 0 = ULTRA SDF, 1 = BASIC POLYGON, 2 = SPLIT-SCREEN A/B
uniform int uEngineMode;
// 20-Second SDF X-Ray & Measurement Wizard Mode (0 = Off, 1..5 = Wizard Steps)
uniform int uDebugVizMode;

// Forward declarations for scene evaluators used by secondary reflection & refraction rays
vec2 evalCourseWorldRaw(vec3 p);
vec2 evalWorldSdf(vec3 p);
vec2 evalSceneSdf(vec3 p);
float evalShadowScene(vec3 p);

bool isBasicPolygonPixel() {
  if (uEngineMode == 1) return true;
  if (uEngineMode == 2) return gl_FragCoord.x < (uResolution.x * 0.5);
  return false;
}

/**
 * O(1) Domain-Repeated Brutalist/Atari Cathedral Megastructure in the distant abyss.
 * Uses bounded/infinite modular domain repetition (opRepLim) to render an infinite
 * field of monolithic pillars, brutalist cross-arches, and vertical neon light-columns
 * at O(1) shader evaluation cost.
 * Guarded so it is only evaluated in the far abyss (length(p.xz) > 22.0 || p.y < -1.5).
 */
vec3 opRepLim(vec3 p, float s, vec3 lim) {
  vec3 cell = clamp(round(p / s), -lim, lim);
  return p - s * cell;
}

float sdInfiniteMegaPillars(vec3 p) {
  if (length(p.xz) <= 22.0 && p.y >= -1.5) {
    return max(22.0 - length(p.xz), p.y + 1.5);
  }
  float cellSpacing = 16.0;
  vec3 q = opRepLim(p - vec3(8.0, 0.0, 8.0), cellSpacing, vec3(24.0, 0.0, 24.0));
  vec2 dShaft2D = abs(q.xz) - vec2(1.35);
  float dShaft = length(max(dShaft2D, 0.0)) + min(max(dShaft2D.x, dShaft2D.y), 0.0) - 0.12;
  dShaft = max(dShaft, p.y + 3.2);
  float yMod = mod(p.y + 4.0, 8.0) - 4.0;
  float dArch = max(min(max(abs(q.z) - 0.65, abs(yMod) - 0.55), max(abs(q.x) - 0.65, abs(yMod) - 0.55)), p.y + 4.2);
  return min(dShaft, dArch);
}

/**
 * Raymarches the distant O(1) Cathedral Megastructure in the sky/abyss pass (12 fast steps)
 * only on background misses or far abyss rays (length(p.xz) > 22.0 || p.y < -1.5)
 * so it never interferes with primary track physics or collision distances.
 */
vec3 renderCathedralMegastructure(vec3 ro, vec3 rd, vec3 baseSky) {
  if (rd.y > 0.18) return baseSky;
  float t = max(8.0, (-3.5 - ro.y) / min(rd.y, -0.04));
  if (t > 175.0) return baseSky;

  float hitT = -1.0;
  vec3 hitP = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    vec3 p = ro + rd * t;
    if (length(p.xz) <= 22.0 && p.y >= -1.5) {
      t += 4.5;
      continue;
    }
    float d = sdInfiniteMegaPillars(p);
    if (d < 0.08) {
      hitT = t;
      hitP = p;
      break;
    }
    t += max(d * 0.92, 0.75);
    if (t > 170.0) break;
  }

  if (hitT < 0.0) return baseSky;

  float cellSpacing = 16.0;
  vec3 q = opRepLim(hitP - vec3(8.0, 0.0, 8.0), cellSpacing, vec3(24.0, 0.0, 24.0));
  vec3 archN = normalize(vec3(sign(q.x) * step(abs(q.z), abs(q.x)), 0.15, sign(q.z) * step(abs(q.x), abs(q.z))));
  float ndotl = max(dot(archN, normalize(uSunDir)), 0.0);

  // Vertical neon light-columns recessed into every pillar face
  float fluteGlow = smoothstep(0.28, 0.02, min(abs(q.x), abs(q.z)));
  float heightPulse = 0.55 + 0.45 * sin(hitP.y * 0.45 - uTime * 2.2);
  float tierBand = smoothstep(0.88, 0.98, abs(sin(hitP.y * 1.57079)));

  vec3 pillarBase = mix(uAbyssFogColor * 0.55, uWallColor * 0.85, 0.4 + 0.6 * ndotl);
  vec3 neonStrip = mix(uGridLineColor, vec3(0.25, 0.92, 1.0), 0.5) * (fluteGlow * 1.35 * heightPulse + tierBand * 0.45);
  vec3 megaCol = pillarBase + neonStrip;

  float fog = exp(-hitT * 0.016);
  float depthFade = clamp((hitP.y + 42.0) / 38.0, 0.12, 1.0);
  return mix(baseSky, megaCol, fog * depthFade * 0.82);
}

/**
 * 2D Voronoi cellular noise for bubbling acid/lava hazards and crystalline ice facets.
 */
vec2 voronoi2D(vec2 x, float timeShift) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  float md = 8.0;
  float md2 = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 cellId = n + g;
      vec2 o = 0.5 + 0.42 * sin(timeShift + 6.28318 * fract(sin(vec2(
        dot(cellId, vec2(127.1, 311.7)),
        dot(cellId, vec2(269.5, 183.3))
      )) * 43758.5453));
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < md) {
        md2 = md;
        md = d;
      } else if (d < md2) {
        md2 = d;
      }
    }
  }
  return vec2(sqrt(md), sqrt(md2) - sqrt(md));
}

/**
 * Focused optical floor caustics projected beneath the refractive glass marble.
 * Simulates sunlight (uSunDir) focusing through the spherical glass lens (IOR 1.52)
 * onto the course deck below, complete with warm gold focal ring + cyan dispersion rim.
 */
vec3 computeMarbleFloorCaustics(vec3 p, vec3 n, vec3 L) {
  if (n.y < 0.2) return vec3(0.0);
  float vertDist = uMarblePos.y - p.y;
  if (vertDist <= 0.0 || vertDist >= 4.8) return vec3(0.0);

  vec2 sunShift = -L.xz / max(L.y, 0.35) * (vertDist * 0.55);
  vec2 causticCenter = uMarblePos.xz + sunShift;
  vec2 dp = p.xz - causticCenter;
  float r = length(dp) / max(uMarbleRadius, 0.1);

  float heightNorm = clamp(vertDist / 4.2, 0.0, 1.0);
  float ringRadius = mix(0.58, 1.15, heightNorm);
  float ringRing = exp(-pow((r - ringRadius) * 3.8, 2.0));
  float coreSpot = exp(-r * r * 3.6) * (1.0 - heightNorm * 0.5);

  float angle = atan(dp.y, dp.x);
  vec2 rotXZ = vec2(dp.x * uMarbleQuat.w + dp.y * uMarbleQuat.y, dp.y * uMarbleQuat.w - dp.x * uMarbleQuat.y);
  float causticSwirl = 0.65 + 0.35 * sin(angle * 4.0 + (rotXZ.x + rotXZ.y) * 5.0 - uTime * 3.5);

  // Chromatic dispersion split across the caustic ring (IOR_R=1.50, IOR_G=1.52, IOR_B=1.55)
  float rCh = exp(-pow((r - (ringRadius - 0.07)) * 4.2, 2.0));
  float gCh = ringRing;
  float bCh = exp(-pow((r - (ringRadius + 0.08)) * 4.2, 2.0));
  vec3 prismRing = vec3(rCh * 1.15, gCh * 1.02, bCh * 1.25);

  float fade = (1.0 - heightNorm) * clamp(n.y, 0.0, 1.0);
  vec3 causticTint = mix(vec3(1.0, 0.88, 0.52), uMarbleGlowColor + vec3(0.35, 0.75, 1.0), 0.45);
  return (prismRing * causticTint * 0.95 + vec3(1.0, 0.95, 0.8) * coreSpot * 0.65) * causticSwirl * fade;
}

/**
 * Screen-space surface curvature bevel highlight:
 * Uses partial derivatives of the world normal (clamp(length(fwidth(n)) * 6.5, 0.0, 1.0))
 * to add crisp, gleaming specular bevel highlights along every smoothUnion fillet and rounded ramp lip.
 */
vec3 computeBevelCurvatureHighlight(vec3 p, vec3 n, vec3 L, vec3 V, vec3 accentCol, float matId) {
  float depthGrad = length(fwidth(p));
  float matGrad = fwidth(matId);
  // Suppress 2x2 pixel quad derivative jump across silhouette boundaries and material seams
  float continuityMask = (1.0 - smoothstep(0.035, 0.14, depthGrad)) * (1.0 - smoothstep(0.005, 0.05, matGrad));
  float curvature = clamp(length(fwidth(n)) * 6.5, 0.0, 1.0) * continuityMask;
  float smoothBevel = smoothstep(0.08, 0.68, curvature);
  vec3 H = normalize(L + V);
  vec3 R = reflect(-V, n);
  float bevelSpec = pow(max(dot(n, H), 0.0), 28.0) * 0.85 +
                    pow(max(R.y * 0.5 + 0.5, 0.0), 4.0) * 0.55;
  float rim = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 2.2);
  vec3 anodizedTint = mix(accentCol, vec3(1.0, 0.94, 0.78), 0.58);
  return anodizedTint * smoothBevel * (bevelSpec + rim * 0.55) * 0.75;
}

/**
 * Fast 3-tap forward-difference normal for reflected hits (instead of 4-tap tetrahedral normal).
 */
vec3 calcFastReflectedNormal(vec3 p, float centerDist) {
  const float eps = 0.004;
  float dx = evalShadowScene(p + vec3(eps, 0.0, 0.0)) - centerDist;
  float dy = evalShadowScene(p + vec3(0.0, eps, 0.0)) - centerDist;
  float dz = evalShadowScene(p + vec3(0.0, 0.0, eps)) - centerDist;
  return normalize(vec3(dx, dy, dz));
}

/**
 * Fast 5-step secondary reflection ray traced from glossy course surfaces
 * (ice, goal pad, chrome bumpers, and anodized track decks) when reflStrength > 0.12 && hitT < 45.0.
 */
vec3 traceGlossyFloorReflection(vec3 p, vec3 n, vec3 V, float roughness, float hitT) {
  float ndotv = clamp(dot(n, V), 0.0, 1.0);
  float fresnel = mix(0.08, 0.62, pow(1.0 - ndotv, 3.0));
  float reflStrength = (1.0 - smoothstep(0.04, 0.58, roughness)) * fresnel;

  if (reflStrength <= 0.12 || hitT >= 45.0) return vec3(0.0);

  vec3 reflDir = reflect(-V, n);
  vec3 ro = p + n * 0.04;
  float t = 0.06;
  vec2 hit = vec2(-1.0, -1.0);
  float hitDist = 0.0;

  const int MAX_REFL_STEPS = 5;
  for (int i = 0; i < MAX_REFL_STEPS; i++) {
    vec3 rp = ro + reflDir * t;
    vec2 courseS = evalCourseWorldRaw(rp);
    float dMarble = length(rp - uMarblePos) - uMarbleRadius;
    vec2 s = (dMarble < courseS.x) ? vec2(dMarble, 100.0) : courseS;
    if (s.x < 0.018) {
      hit = vec2(t, s.y);
      hitDist = s.x;
      break;
    }
    t += max(s.x * 1.15, 0.12);
    if (t > 18.0) break;
  }

  if (hit.x < 0.0) {
    float horizon = clamp(0.5 + 0.5 * reflDir.y, 0.0, 1.0);
    vec3 envSky = mix(uSkyHorizon, uSkyZenith, pow(horizon, 0.75));
    return envSky * reflStrength * 0.45;
  }

  vec3 rPos = ro + reflDir * hit.x;
  vec3 rNorm = calcFastReflectedNormal(rPos, hitDist);
  float rNdotL = max(dot(rNorm, normalize(uSunDir)), 0.0);
  vec3 reflCol = uTrackPrimary;
  if (hit.y > 99.5 && hit.y < 100.5) {
    reflCol = mix(uMarbleBaseColor, uMarbleGlowColor, 0.55) * 1.35;
  } else {
    vec2 cell = floor(rPos.xz);
    float checker = mod(cell.x + cell.y, 2.0);
    reflCol = mix(uTrackPrimary, uTrackSecondary, checker * 0.45) + uGridLineColor * 0.22;
    int rm = int(round(hit.y));
    if (rm == 3) reflCol = vec3(0.95, 0.32, 0.65);
    else if (rm == 4) reflCol = vec3(0.32, 0.95, 0.25);
    else if (rm == 5) reflCol = vec3(1.0, 0.85, 0.24);
    else if (rm == 7) reflCol = vec3(0.92, 0.22, 0.26);
  }
  reflCol *= (0.55 + 0.45 * rNdotL);

  float distAtten = exp(-hit.x * 0.085);
  return reflCol * reflStrength * distAtten;
}

/**
 * Helper to evaluate a point on the course surface seen through the refractive glass marble.
 * Includes dual-scale isometric gridlines (2.0m major + 0.5m minor) so the lens magnification
 * and chromatic dispersion of the grid beneath the marble are crisp and unmistakable.
 */
vec3 sampleRefractedUnderMarble(vec3 p) {
  vec2 s = evalCourseWorldRaw(p);
  float matId = s.y;
  vec2 xz = p.xz;
  // Crisp procedural grid lines for refracted rays
  vec2 g05 = abs(fract(xz * 2.0 - 0.5) - 0.5);
  float line05 = 1.0 - smoothstep(0.02, 0.08, min(g05.x, g05.y));
  vec2 g10 = abs(fract(xz - 0.5) - 0.5);
  float line10 = 1.0 - smoothstep(0.015, 0.055, min(g10.x, g10.y));
  vec2 g20 = abs(fract(xz * 0.5 - 0.5) - 0.5);
  float line20 = 1.0 - smoothstep(0.01, 0.04, min(g20.x, g20.y));
  float gridMask = clamp(max(line05 * 0.42, max(line10 * 0.72, line20)), 0.0, 1.0);

  vec2 cell = floor(xz);
  float checker = mod(cell.x + cell.y, 2.0);
  vec3 baseCol = mix(uTrackPrimary, uTrackSecondary, checker * 0.42);
  vec3 gridCol = uGridLineColor;

  int m = int(round(matId));
  if (m == 1) {
    baseCol = vec3(0.65, 0.92, 1.0);
    gridCol = vec3(0.95, 1.0, 1.0);
  } else if (m == 2) {
    baseCol = vec3(0.75, 0.45, 0.08);
    gridCol = vec3(1.0, 0.78, 0.22);
  } else if (m == 3) {
    baseCol = vec3(0.92, 0.22, 0.58);
    gridCol = vec3(1.0, 0.92, 0.35);
  } else if (m == 4) {
    baseCol = vec3(0.25, 0.92, 0.22);
    gridCol = vec3(0.72, 1.0, 0.4);
  } else if (m == 5) {
    baseCol = mix(vec3(0.06, 0.78, 0.42), vec3(1.0, 0.84, 0.18), checker);
  } else if (m == 6) {
    baseCol = mix(vec3(0.12, 0.55, 0.95), vec3(0.95, 0.78, 0.22), checker * 0.7);
  } else if (m == 7) {
    baseCol = vec3(0.88, 0.18, 0.24);
  } else if (m == 8) {
    baseCol = vec3(0.16, 0.78, 0.92);
  }

  vec3 col = mix(baseCol, gridCol * 1.15, gridMask);
  // Add caustic focus glow directly under the marble lens
  col += computeMarbleFloorCaustics(p, vec3(0.0, 1.0, 0.0), normalize(uSunDir)) * 0.65;
  return col;
}

/**
 * True Optical Glass Marble Refraction with R/G/B Chromatic Dispersion:
 * Traces a refracted ray (refract(rd, n, 1.0 / 1.52)) with IOR_R = 1.50, IOR_G = 1.52, IOR_B = 1.55
 * through the glass sphere and into the course geometry beneath/behind it (8 fast steps).
 */
vec3 traceMarbleOpticalRefraction(vec3 hitPos, vec3 n, vec3 rd) {
  const float IOR_R = 1.50;
  const float IOR_G = 1.52;
  const float IOR_B = 1.55;

  vec3 refrInR = refract(rd, n, 1.0 / IOR_R);
  vec3 refrInG = refract(rd, n, 1.0 / IOR_G);
  vec3 refrInB = refract(rd, n, 1.0 / IOR_B);

  // Path through the interior of the glass sphere to the back surface
  float chord = max(0.18, 2.0 * uMarbleRadius * abs(dot(-n, refrInG)));
  vec3 exitPos = hitPos + refrInG * chord;
  vec3 exitN = normalize(exitPos - uMarblePos);

  // Second refraction at back wall of glass sphere (creates the convex magnifying lens effect)
  vec3 outG = refract(refrInG, -exitN, IOR_G);
  if (length(outG) < 0.001) outG = reflect(refrInG, -exitN);
  outG = normalize(outG);

  vec3 outR = refract(refrInR, -exitN, IOR_R);
  if (length(outR) < 0.001) outR = normalize(mix(outG, refrInR, 0.25));
  outR = normalize(outR);

  vec3 outB = refract(refrInB, -exitN, IOR_B);
  if (length(outB) < 0.001) outB = normalize(mix(outG, refrInB, 0.25));
  outB = normalize(outB);

  // Raymarch the refracted green carrier ray into the course behind/beneath the marble (8 fast steps)
  vec3 ro = exitPos + outG * 0.035;
  float t = 0.02;
  bool hitWorld = false;
  for (int i = 0; i < 8; i++) {
    vec3 p = ro + outG * t;
    vec2 s = evalCourseWorldRaw(p);
    if (s.x < 0.012) {
      hitWorld = true;
      break;
    }
    t += max(s.x * 0.96, 0.06);
    if (t > 14.0) break;
  }

  if (!hitWorld) {
    float horizon = clamp(0.5 + 0.5 * outG.y, 0.0, 1.0);
    return mix(uSkyHorizon, uSkyZenith, pow(horizon, 0.75));
  }

  // Evaluate R, G, B rays at their dispersed exit angles for authentic prism fringes
  vec3 posR = exitPos + outR * (t + 0.035);
  vec3 posG = exitPos + outG * (t + 0.035);
  vec3 posB = exitPos + outB * (t + 0.035);

  float colR = sampleRefractedUnderMarble(posR).r;
  float colG = sampleRefractedUnderMarble(posG).g;
  float colB = sampleRefractedUnderMarble(posB).b;
  return vec3(colR, colG, colB);
}

/**
 * Quantizes a smooth surface normal into a discrete 16-segment polygon facet normal
 * combined with screen-space flat triangle derivatives (dFdx(pos) x dFdy(pos)) for
 * Mode 1 (BASIC POLYGON MESH).
 */
vec3 computeBasicPolygonFacetNormal(vec3 p, vec3 smoothN) {
  // Screen-space geometric face normal from derivative cross product
  vec3 dpdx = dFdx(p);
  vec3 dpdy = dFdy(p);
  vec3 screenFaceN = cross(dpdx, dpdy);
  float screenLen = length(screenFaceN);
  if (screenLen > 1e-7) {
    screenFaceN /= screenLen;
    if (dot(screenFaceN, smoothN) < 0.0) screenFaceN = -screenFaceN;
  } else {
    screenFaceN = smoothN;
  }

  // 16-segment angular + spatial quad-diagonal facet quantization
  float cellScale = 0.85;
  vec2 uv = fract(p.xz / cellScale);
  float upperTri = (uv.x + uv.y > 1.0) ? 1.0 : -1.0;

  float phi = acos(clamp(smoothN.y, -1.0, 1.0));
  float theta = atan(smoothN.z, smoothN.x);
  float phiStep = 3.14159265 / 32.0;   // 16-segment elevation step
  float thetaStep = 6.2831853 / 16.0;  // 16-segment azimuth step

  float qPhi = (phi > 0.02)
    ? round(phi / phiStep + 0.35 * upperTri) * phiStep
    : phi + upperTri * 0.055;
  float qTheta = (length(smoothN.xz) > 0.02)
    ? round(theta / thetaStep + 0.25 * upperTri) * thetaStep
    : theta;

  vec3 quantN = normalize(vec3(
    sin(qPhi) * cos(qTheta) + upperTri * 0.035,
    cos(qPhi),
    sin(qPhi) * sin(qTheta) - upperTri * 0.035
  ));

  return normalize(mix(quantN, screenFaceN, 0.35));
}

/**
 * Mode 1 ("BASIC POLYGON MESH") course surface shader:
 * - Discrete flat-shaded polygon face normals (no smooth Phong interpolation)
 * - Visible triangle wireframe edges + diagonal quad splits across every cell
 * - Hard un-filleted seams, NO soft shadows, NO ambient occlusion, NO floor caustics,
 *   NO bevel curvature highlights, and NO glossy reflections.
 */
vec3 shadeBasicPolygonCourseSurface(vec3 p, vec3 smoothN, vec3 V, float matId) {
  vec3 facetN = computeBasicPolygonFacetNormal(p, smoothN);

  float cellScale = 0.85;
  vec2 cellUV = fract(p.xz / cellScale);
  vec2 fw = max(fwidth(p.xz / cellScale), vec2(0.002));

  // Quad perimeter edges + explicit diagonal triangulation line (u + v == 1.0)
  vec2 quadEdgeDist = min(cellUV, 1.0 - cellUV) / fw;
  float quadWire = 1.0 - smoothstep(0.0, 1.35, min(quadEdgeDist.x, quadEdgeDist.y));
  float diagDist = abs(cellUV.x + cellUV.y - 1.0) / max(fw.x + fw.y, 0.002);
  float diagWire = 1.0 - smoothstep(0.0, 1.25, diagDist);
  float wireMask = clamp(max(quadWire, diagWire * 0.85), 0.0, 1.0);

  // Per-triangle flat color alternation to emphasize individual polygon faces
  vec2 cellId = floor(p.xz / cellScale);
  float triParity = (cellUV.x + cellUV.y > 1.0) ? 1.0 : 0.0;
  float flatChecker = mod(cellId.x + cellId.y, 2.0);

  vec3 baseCol = mix(uTrackPrimary * 0.78, uTrackSecondary * 0.78, flatChecker * 0.4 + triParity * 0.16);
  if (abs(smoothN.y) < 0.48) {
    baseCol = uWallColor * (0.75 + 0.15 * triParity);
  }

  int m = int(round(matId));
  if (m == 1) baseCol = vec3(0.55, 0.78, 0.88);
  else if (m == 2) baseCol = vec3(0.68, 0.42, 0.12);
  else if (m == 3) baseCol = vec3(0.82, 0.22, 0.52);
  else if (m == 4) baseCol = vec3(0.18, 0.65, 0.22);
  else if (m == 5) baseCol = mix(vec3(0.1, 0.65, 0.35), vec3(0.85, 0.72, 0.18), flatChecker);
  else if (m == 6) baseCol = mix(vec3(0.15, 0.48, 0.82), vec3(0.82, 0.68, 0.2), flatChecker);
  else if (m == 7) baseCol = vec3(0.78, 0.2, 0.22);
  else if (m == 8) baseCol = vec3(0.2, 0.58, 0.72);

  // Basic flat Lambertian diffuse (no soft shadows, no AO, no caustics, no reflections)
  vec3 L = normalize(uSunDir);
  float ndotl = max(dot(facetN, L), 0.0);
  // Quantize diffuse into coarse flat-shaded steps to accentuate polygon facets
  float flatLambert = 0.28 + 0.72 * (floor(ndotl * 6.0) / 6.0);
  vec3 lit = baseCol * flatLambert;

  // Overlay retro green/cyan triangle mesh wireframe
  vec3 wireCol = mix(uGridLineColor * 0.75, vec3(0.55, 0.95, 0.68), 0.45);
  lit = mix(lit, wireCol, wireMask * 0.58);
  return lit;
}

/**
 * Mode 1 ("BASIC POLYGON MESH") marble shader:
 * Renders an opaque, low-poly 16-segment faceted UV-sphere with flat-shaded triangle faces
 * and visible wireframe edges — zero optical refraction, zero SSS, zero dispersion.
 */
vec3 shadeBasicPolygonMarble(vec3 p, vec3 smoothN, vec3 V) {
  vec3 localPos = rotateByQuatInverse((p - uMarblePos) / max(uMarbleRadius, 0.01), uMarbleQuat);
  vec3 localN = normalize(localPos);

  // Quantize sphere into 16 longitude x 8 latitude low-poly facets
  float phi = acos(clamp(localN.y, -1.0, 1.0));
  float theta = atan(localN.z, localN.x);
  float latSteps = 8.0;
  float lonSteps = 16.0;

  float uLat = phi / 3.14159265 * latSteps;
  float uLon = (theta / 6.2831853 + 0.5) * lonSteps;
  vec2 cellUV = fract(vec2(uLon, uLat));
  float triSplit = (cellUV.x + cellUV.y > 1.0) ? 1.0 : -1.0;

  float qPhi = (floor(uLat) + 0.5 + 0.18 * triSplit) / latSteps * 3.14159265;
  float qTheta = ((floor(uLon) + 0.5) / lonSteps - 0.5) * 6.2831853;
  vec3 localFacetN = normalize(vec3(sin(qPhi) * cos(qTheta), cos(qPhi), sin(qPhi) * sin(qTheta)));

  // Rotate faceted normal back to world space using conjugate of uMarbleQuat
  vec4 qConj = vec4(-uMarbleQuat.xyz, uMarbleQuat.w);
  vec3 worldFacetN = normalize(rotateByQuatInverse(localFacetN, qConj));

  vec3 L = normalize(uSunDir);
  float ndotl = max(dot(worldFacetN, L), 0.0);
  vec3 H = normalize(L + V);
  float flatSpec = pow(max(dot(worldFacetN, H), 0.0), 16.0) * 0.35;

  // Low-poly triangle wireframe overlay on the marble
  float edgeLon = min(cellUV.x, 1.0 - cellUV.x);
  float edgeLat = min(cellUV.y, 1.0 - cellUV.y);
  float edgeDiag = abs(cellUV.x + cellUV.y - 1.0) * 0.7;
  float wire = 1.0 - smoothstep(0.02, 0.09, min(edgeLon, min(edgeLat, edgeDiag)));

  vec3 baseCol = mix(uMarbleBaseColor, uMarbleVeinColor, 0.35 + 0.15 * triSplit);
  vec3 lit = baseCol * (0.32 + 0.68 * ndotl) + vec3(0.9) * flatSpec;
  return mix(lit, vec3(0.85, 0.98, 1.0), wire * 0.55);
}

/**
 * Turbo-inspired perceptual colormap for Step-Count Heatmap (uDebugVizMode == 2):
 *   1-12 steps  = deep cobalt -> emerald
 *   13-30 steps = cyan -> neon lime/yellow
 *   31-64 steps = hot orange -> magenta
 */
vec3 evalStepCountHeatmapColor(int stepsTaken) {
  float x = clamp(float(stepsTaken) / 52.0, 0.0, 1.0);
  vec3 c0 = vec3(0.07, 0.18, 0.68); // deep cobalt (1-8 steps)
  vec3 c1 = vec3(0.04, 0.78, 0.64); // emerald/cyan (12 steps)
  vec3 c2 = vec3(0.96, 0.88, 0.18); // bright yellow (26 steps)
  vec3 c3 = vec3(1.00, 0.36, 0.08); // hot orange (42 steps)
  vec3 c4 = vec3(0.98, 0.14, 0.78); // neon magenta (52+ steps)
  if (x < 0.25) return mix(c0, c1, x / 0.25);
  if (x < 0.52) return mix(c1, c2, (x - 0.25) / 0.27);
  if (x < 0.78) return mix(c2, c3, (x - 0.52) / 0.26);
  return mix(c3, c4, (x - 0.78) / 0.22);
}

/**
 * Analytical ray-sphere intersection helper for drawing the 3D Unbounding Sphere Probe (Step 1)
 * and the chain of 5 translucent Marching Spheres along a demonstration ray (Step 2).
 */
vec2 intersectDebugSphere(vec3 ro, vec3 rd, vec3 center, float radius) {
  vec3 oc = ro - center;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - radius * radius;
  float h = b * b - c;
  if (h < 0.0) return vec2(-1.0);
  float s = sqrt(h);
  return vec2(-b - s, -b + s);
}

/**
 * Evaluates a single SDF Debug Visualization mode (1..4) so that Mode 5 (Live Curtain Sweep)
 * can composite SDF X-Ray Math on the left of the scanner bar against the final Ultra Glass
 * game on the right!
 */
vec3 composeSdfDebugMode(
  int mode,
  vec3 ro,
  vec3 rd,
  vec2 hit,
  vec3 hitPos,
  vec3 normal,
  int stepsTaken,
  vec3 baseUltraColor
) {
  bool isHit = hit.y >= 0.0;
  float sceneT = isHit ? hit.x : 165.0;

  // ============================================================================
  // MODE 1: WHAT IS AN SDF? (Live 3D Distance Field Slicer & Isolines + Unbounding Sphere)
  // ============================================================================
  if (mode == 1) {
    vec3 col = baseUltraColor * 0.32;

    if (isHit) {
      // Surface distance isoline contours wrt marble center + elevation contours
      float dFromMarble = max(0.0, length(hitPos - uMarblePos) - uMarbleRadius);
      float wave = abs(sin(dFromMarble * 6.2831853 * 2.0 - uTime * 2.4));
      float isoRing = 1.0 - smoothstep(0.0, 0.14, wave);
      float minorIso = 1.0 - smoothstep(0.0, 0.09, abs(sin(dFromMarble * 18.0)));
      float zeroContour = exp(-dFromMarble * 6.5);

      vec3 isoTint = mix(vec3(0.06, 0.88, 1.0), vec3(0.32, 1.0, 0.68), 0.5 + 0.5 * sin(dFromMarble * 1.4));
      col += isoTint * (isoRing * 0.85 + minorIso * 0.32);
      col = mix(col, vec3(1.0, 0.99, 1.0), clamp(zeroContour * 0.85, 0.0, 1.0));
    }

    // Horizontal 3D Cross-Section Slicer Plane at height y = uMarblePos.y
    float planeY = uMarblePos.y;
    if (abs(rd.y) > 0.002) {
      float tPlane = (planeY - ro.y) / rd.y;
      if (tPlane > 0.1 && tPlane < min(sceneT + 0.03, 95.0)) {
        vec3 pSlice = ro + rd * tPlane;
        float distToMarble = length(pSlice.xz - uMarblePos.xz);
        if (distToMarble < 20.0) {
          float dField = evalCourseWorldRaw(pSlice).x;
          float dMarbleSlice = length(pSlice - uMarblePos) - uMarbleRadius;
          float dTotal = min(dField, dMarbleSlice);

          // Concentric neon cyan isoline rings every 0.5m in free space + razor-sharp white d = 0 contour
          float halfMeterPhase = abs(fract(dTotal * 2.0 + 0.5) - 0.5) / 2.0;
          float ring05 = 1.0 - smoothstep(0.0, 0.032, halfMeterPhase);
          float sinBands = 0.5 + 0.5 * sin(dTotal * 18.0 - uTime * 3.0);
          float zeroLine = 1.0 - smoothstep(0.0, 0.045, abs(dTotal));

          vec3 fieldCol = (dTotal >= 0.0)
            ? mix(vec3(0.02, 0.16, 0.34), vec3(0.08, 0.92, 1.0), ring05 * 0.88 + sinBands * 0.22)
            : mix(vec3(0.38, 0.04, 0.22), vec3(1.0, 0.28, 0.62), ring05 * 0.85);
          fieldCol = mix(fieldCol, vec3(1.0, 1.0, 1.0), zeroLine);

          float radialFade = 1.0 - smoothstep(13.0, 20.0, distToMarble);
          col = mix(col, fieldCol, radialFade * 0.84);
        }
      }
    }

    // Glowing 3D Unbounding Sphere Probe around a sample point above the marble/cursor
    vec3 probeCenter = (uPortalAimPos.w > 0.5)
      ? (uPortalAimPos.xyz + normalize(uPortalAimNormal.xyz) * 1.35)
      : (uMarblePos + vec3(1.65 * cos(uTime * 0.9), 1.25, 1.65 * sin(uTime * 0.9)));
    float safeRadius = clamp(evalCourseWorldRaw(probeCenter).x, 0.35, 3.2);
    vec2 spHit = intersectDebugSphere(ro, rd, probeCenter, safeRadius);
    if (spHit.x > 0.0 && spHit.x < sceneT) {
      vec3 spPos = ro + rd * spHit.x;
      vec3 spN = normalize(spPos - probeCenter);
      float rim = pow(1.0 - abs(dot(spN, -rd)), 2.2);
      float latGrid = 1.0 - smoothstep(0.0, 0.08, abs(sin(spPos.y * 10.0)));
      vec3 probeCol = mix(vec3(0.12, 0.96, 1.0), vec3(1.0, 0.92, 0.32), rim * 0.65 + latGrid * 0.35);
      col = mix(col, probeCol * 1.45, clamp(0.28 + 0.62 * rim + 0.25 * latGrid, 0.0, 0.92));
    }

    return col;
  }

  // ============================================================================
  // MODE 2: SPHERE TRACING & STEP RULER (0-Triangle Step Heatmap + 5 Marching Spheres)
  // ============================================================================
  if (mode == 2) {
    vec3 heat = evalStepCountHeatmapColor(stepsTaken);
    if (isHit) {
      vec2 fw = max(fwidth(hitPos.xz), vec2(0.002));
      vec2 g = abs(fract(hitPos.xz - 0.5) - 0.5) / fw;
      float wire = 1.0 - smoothstep(0.0, 1.35, min(g.x, g.y));
      float ndotl = 0.55 + 0.45 * max(dot(normal, normalize(uSunDir)), 0.0);
      float edgeSilhouette = pow(1.0 - clamp(dot(normal, -rd), 0.0, 1.0), 2.4);
      heat = heat * ndotl + vec3(0.95, 1.0, 1.0) * wire * 0.24 + vec3(1.0, 0.45, 0.85) * edgeSilhouette * 0.35;
    } else {
      heat *= 0.62;
    }

    // Visible chain of 5 translucent Marching Spheres along a demonstration ray toward the marble
    vec3 demoOrigin = uMarblePos + normalize(vec3(-2.6, 2.2, 2.8)) * 5.8;
    vec3 demoDir = normalize(uMarblePos - demoOrigin);
    float marchT = 0.25;
    for (int mStep = 0; mStep < 5; mStep++) {
      vec3 cPos = demoOrigin + demoDir * marchT;
      float rSafe = clamp(min(evalCourseWorldRaw(cPos).x, length(cPos - uMarblePos) - uMarbleRadius), 0.22, 1.85);
      vec2 mHit = intersectDebugSphere(ro, rd, cPos, rSafe);
      if (mHit.x > 0.0 && mHit.x < sceneT) {
        vec3 mPos = ro + rd * mHit.x;
        vec3 mN = normalize(mPos - cPos);
        float mRim = pow(1.0 - abs(dot(mN, -rd)), 2.0);
        float stepHue = float(mStep) / 4.0;
        vec3 sphereTint = mix(vec3(0.15, 0.98, 1.0), vec3(1.0, 0.84, 0.22), stepHue);
        heat = mix(heat, sphereTint * 1.4, clamp(0.22 + 0.62 * mRim, 0.0, 0.88));
      }
      marchT += rSafe * 0.92;
    }

    return heat;
  }

  // ============================================================================
  // MODE 3: 120 Hz jSDF GRADIENT & NORMAL FIELD (C-Infinity Smooth Normals, 0 deg Chatter)
  // ============================================================================
  if (mode == 3) {
    if (!isHit) {
      return baseUltraColor * 0.25;
    }
    vec3 normalRgb = normal * 0.5 + 0.5;
    vec2 fw = max(fwidth(hitPos.xz), vec2(0.002));
    vec2 g1 = abs(fract(hitPos.xz - 0.5) - 0.5) / fw;
    float contourGrid = 1.0 - smoothstep(0.0, 1.35, min(g1.x, g1.y));

    // Highlight smoothUnion (smin) C-infinity fillets where surface curvature smoothly blends
    float filletCurvature = clamp(length(fwidth(normal)) * 7.5, 0.0, 1.0);
    vec3 col = normalRgb * (0.78 + 0.22 * contourGrid);
    col = mix(col, vec3(1.0, 0.96, 0.48), filletCurvature * 0.55);
    col += vec3(0.9, 0.98, 1.0) * contourGrid * 0.22;
    return col;
  }

  // ============================================================================
  // MODE 4: 0 ms REALTIME CSG & PORTAL WARP X-RAY (Why Ours Beats Polygon Engines)
  // ============================================================================
  if (mode == 4) {
    vec3 col = baseUltraColor * 0.38;
    if (!isHit) return col;

    // Highlight active CSG FieldMutation craters/bridges/ramps with glowing concentric rings
    float csgEnergy = 0.0;
    vec3 csgTint = vec3(1.0, 0.32, 0.78);
    for (int i = 0; i < 16; i++) {
      if (i >= uMutationCount) break;
      vec3 mutCenter = uMutationsPosA[i].xyz;
      float mutRadius = max(uMutationsPosA[i].w, 0.5);
      float dMut = abs(length(hitPos - mutCenter) - mutRadius);
      float ring = exp(-dMut * 3.2) * (0.65 + 0.35 * sin(dMut * 18.0 - uTime * 8.0));
      int kind = int(round(uMutationsMeta[i].x));
      vec3 kCol = (kind == 1)
        ? vec3(1.0, 0.28, 0.68) // Subtract Sphere Crater
        : (kind == 2)
          ? vec3(0.18, 0.98, 0.82) // Ferrofluid Capsule Bridge
          : vec3(1.0, 0.84, 0.22); // Pop-Ramp / Cryo
      csgEnergy = max(csgEnergy, ring);
      if (ring >= csgEnergy) csgTint = kCol;
    }

    // Fallback demonstration CSG X-Ray ring around the marble when no manual mutations are active yet
    if (uMutationCount == 0) {
      float dDemoCrater = abs(length(hitPos - uMarblePos) - 2.4);
      float demoRing = exp(-dDemoCrater * 2.4) * (0.6 + 0.4 * sin(dDemoCrater * 16.0 - uTime * 6.0));
      csgEnergy = max(csgEnergy, demoRing * 0.85);
    }

    // Highlight Blue & Orange Non-Euclidean Portal throats
    float portalEnergy = 0.0;
    vec3 portalTint = vec3(0.0, 0.88, 1.0);
    if (uPortalPairCount > 0) {
      float dPA = abs(length(hitPos - uPortalPosA[0].xyz) - uPortalPosA[0].w);
      float dPB = abs(length(hitPos - uPortalPosB[0].xyz) - uPortalPosB[0].w);
      float eA = exp(-dPA * 2.2) * (0.65 + 0.35 * sin(dPA * 16.0 - uTime * 7.5));
      float eB = exp(-dPB * 2.2) * (0.65 + 0.35 * sin(dPB * 16.0 - uTime * 7.5));
      if (eB > eA) {
        portalEnergy = eB;
        portalTint = vec3(1.0, 0.52, 0.08);
      } else {
        portalEnergy = eA;
        portalTint = vec3(0.0, 0.88, 1.0);
      }
    }

    col += csgTint * csgEnergy * 1.65 + portalTint * portalEnergy * 1.55;
    return col;
  }

  return baseUltraColor;
}

/**
 * Applies the active 20-Second SDF X-Ray & Measurement Wizard visualization mode (uDebugVizMode 1..5).
 * Mode 5 animates a sweeping vertical X-Ray scanner bar across the viewport:
 *   - Left of the scanner bar: live composite of SDF Isolines + Step Heatmap + jSDF Normals
 *   - Right of the scanner bar: final Ultra Lockstep SDF optical glass game!
 */
vec3 applySdfDebugViz(
  vec3 ro,
  vec3 rd,
  vec2 hit,
  vec3 hitPos,
  vec3 normal,
  int stepsTaken,
  vec3 baseUltraColor
) {
  if (uDebugVizMode <= 0) return baseUltraColor;

  if (uDebugVizMode >= 1 && uDebugVizMode <= 4) {
    return composeSdfDebugMode(uDebugVizMode, ro, rd, hit, hitPos, normal, stepsTaken, baseUltraColor);
  }

  // MODE 5: LIVE CURTAIN SWEEP (SDF X-Ray Math <-> Final Ultra Glass Game)
  float sweepX = 0.15 + 0.70 * (0.5 + 0.5 * sin(uTime * 1.6));
  float uvX = gl_FragCoord.x / max(uResolution.x, 1.0);
  float distToBar = abs(uvX - sweepX) * uResolution.x;

  vec3 xrayColor = baseUltraColor;
  if (uvX < sweepX) {
    vec3 isoCol = composeSdfDebugMode(1, ro, rd, hit, hitPos, normal, stepsTaken, baseUltraColor);
    vec3 stepCol = composeSdfDebugMode(2, ro, rd, hit, hitPos, normal, stepsTaken, baseUltraColor);
    vec3 normCol = composeSdfDebugMode(3, ro, rd, hit, hitPos, normal, stepsTaken, baseUltraColor);
    xrayColor = mix(mix(isoCol, stepCol, 0.42), normCol, 0.32);
  }

  // Glowing vertical X-Ray scanner laser beam at sweepX
  float beamCore = 1.0 - smoothstep(0.0, 2.2, distToBar);
  float beamHalo = exp(-distToBar * 0.16);
  float scanTick = step(0.55, fract(gl_FragCoord.y * 0.05 - uTime * 2.5));
  vec3 scannerCol = mix(vec3(0.08, 0.96, 1.0), vec3(1.0, 0.88, 0.28), 0.45 + 0.55 * scanTick);

  return mix(xrayColor, scannerCol * 1.65, clamp(beamCore + beamHalo * 0.52, 0.0, 1.0));
}
`;

  const wgsl = `
// WGSL Ultra SDF helpers (Infinite Cathedral Megastructure + Voronoi + Caustics)
fn opRepLim(p: vec3<f32>, s: f32, lim: vec3<f32>) -> vec3<f32> {
  let cell = clamp(round(p / s), -lim, lim);
  return p - s * cell;
}

fn sdInfiniteMegaPillars(p: vec3<f32>) -> f32 {
  let cellSpacing = 16.0;
  let q = opRepLim(p - vec3<f32>(8.0, 0.0, 8.0), cellSpacing, vec3<f32>(24.0, 0.0, 24.0));
  let dShaft2D = abs(q.xz) - vec2<f32>(1.35);
  var dShaft = length(max(dShaft2D, vec2<f32>(0.0))) + min(max(dShaft2D.x, dShaft2D.y), 0.0) - 0.12;
  dShaft = max(dShaft, p.y + 3.2);
  let yMod = (p.y + 4.0) - 8.0 * floor((p.y + 4.0) / 8.0) - 4.0;
  let dArchX = max(abs(q.z) - 0.65, abs(yMod) - 0.55);
  let dArchZ = max(abs(q.x) - 0.65, abs(yMod) - 0.55);
  let dArches = max(min(dArchX, dArchZ), p.y + 4.2);
  return min(dShaft, dArches);
}
`;

  return { glsl, wgsl };
}
