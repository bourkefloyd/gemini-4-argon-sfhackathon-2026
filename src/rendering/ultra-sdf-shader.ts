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
 *     * 12-step 1-bounce glossy floor reflections on ice, goal pads, and anodized track decks.
 *     * O(1) infinite domain-repeated cathedral megastructure backdrop (`sdInfiniteMegaPillars`).
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

// Forward declarations for scene evaluators used by secondary reflection & refraction rays
vec2 evalWorldSdf(vec3 p);
vec2 evalSceneSdf(vec3 p);

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
 */
vec3 opRepLim(vec3 p, float s, vec3 lim) {
  vec3 cell = clamp(round(p / s), -lim, lim);
  return p - s * cell;
}

float sdInfiniteMegaPillars(vec3 p) {
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
 * Raymarches the distant O(1) Cathedral Megastructure in the sky/abyss pass (16 fast steps)
 * so it never interferes with primary track physics or collision distances.
 */
vec3 renderCathedralMegastructure(vec3 ro, vec3 rd, vec3 baseSky) {
  if (rd.y > 0.18) return baseSky;
  float t = max(8.0, (-3.5 - ro.y) / min(rd.y, -0.04));
  if (t > 175.0) return baseSky;

  float hitT = -1.0;
  vec3 hitP = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    vec3 p = ro + rd * t;
    float d = sdInfiniteMegaPillars(p);
    if (d < 0.08) {
      hitT = t;
      hitP = p;
      break;
    }
    t += max(d * 0.9, 0.6);
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
vec3 computeBevelCurvatureHighlight(vec3 n, vec3 L, vec3 V, vec3 accentCol) {
  float curvature = clamp(length(fwidth(n)) * 6.5, 0.0, 1.0);
  float smoothBevel = smoothstep(0.06, 0.68, curvature);
  vec3 H = normalize(L + V);
  vec3 R = reflect(-V, n);
  float bevelSpec = pow(max(dot(n, H), 0.0), 28.0) * 0.85 +
                    pow(max(R.y * 0.5 + 0.5, 0.0), 4.0) * 0.55;
  float rim = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 2.2);
  vec3 anodizedTint = mix(accentCol, vec3(1.0, 0.94, 0.78), 0.58);
  return anodizedTint * smoothBevel * (bevelSpec + rim * 0.55) * 0.85;
}

/**
 * Fast 12-step secondary reflection ray traced from glossy course surfaces
 * (ice, goal pad, chrome bumpers, and anodized track decks).
 */
vec3 traceGlossyFloorReflection(vec3 p, vec3 n, vec3 V, float roughness) {
  if (roughness > 0.58) return vec3(0.0);
  vec3 reflDir = reflect(-V, n);
  vec3 ro = p + n * 0.04;
  float t = 0.05;
  vec2 hit = vec2(-1.0, -1.0);

  for (int i = 0; i < 12; i++) {
    vec3 rp = ro + reflDir * t;
    vec2 s = evalSceneSdf(rp);
    if (s.x < 0.012) {
      hit = vec2(t, s.y);
      break;
    }
    t += max(s.x * 0.95, 0.08);
    if (t > 24.0) break;
  }

  float ndotv = clamp(dot(n, V), 0.0, 1.0);
  float fresnel = mix(0.06, 0.58, pow(1.0 - ndotv, 3.2));
  float glossWeight = (1.0 - smoothstep(0.04, 0.58, roughness)) * fresnel;

  if (hit.x < 0.0) {
    float horizon = clamp(0.5 + 0.5 * reflDir.y, 0.0, 1.0);
    vec3 envSky = mix(uSkyHorizon, uSkyZenith, pow(horizon, 0.75));
    return envSky * glossWeight * 0.45;
  }

  vec3 rPos = ro + reflDir * hit.x;
  vec3 reflCol = uTrackPrimary;
  if (hit.y > 103.5) {
    reflCol = (hit.y > 104.5) ? vec3(1.0, 0.55, 0.12) * 1.5 : vec3(0.15, 0.82, 1.0) * 1.5;
  } else if (hit.y > 100.5 && hit.y < 101.5) {
    reflCol = vec3(0.35, 1.0, 0.78) * 1.4;
  } else if (hit.y > 99.5 && hit.y < 100.5) {
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

  float distAtten = exp(-hit.x * 0.085);
  return reflCol * glossWeight * distAtten;
}

/**
 * Helper to evaluate a point on the course surface seen through the refractive glass marble.
 * Includes dual-scale isometric gridlines (2.0m major + 0.5m minor) so the lens magnification
 * and chromatic dispersion of the grid beneath the marble are crisp and unmistakable.
 */
vec3 sampleRefractedUnderMarble(vec3 p) {
  vec2 s = evalWorldSdf(p);
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
 * through the glass sphere and into the course geometry beneath/behind it.
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

  // Raymarch the refracted green carrier ray into the course behind/beneath the marble
  vec3 ro = exitPos + outG * 0.035;
  float t = 0.02;
  bool hitWorld = false;
  for (int i = 0; i < 16; i++) {
    vec3 p = ro + outG * t;
    vec2 s = evalWorldSdf(p);
    if (s.x < 0.008) {
      hitWorld = true;
      break;
    }
    t += max(s.x * 0.92, 0.04);
    if (t > 18.0) break;
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
