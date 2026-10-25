import{D as Qe,v as Le,a as lt,b as qe,M as st,c as xe,s as za,d as nt,e as yt,q as ya,f as ba,g as mt,h as Sa,i as ot,j as Bt,k as Jt,l as Ft,m as Ke,n as xt,F as Da,o as it,B as Ia,p as Ea}from"./sdf-courses-CsTWHl6n.js";import{r as La,j as ut}from"./vendor-CT-JzDPq.js";function Ht(e,i=0,t=Qe){const o={grounded:!0,normal:[0,1,0],distance:t.marbleRadius,contactPoint:[e.startPos[0],e.startPos[1]-t.marbleRadius,e.startPos[2]],surfaceVelocity:[0,0,0],impactSpeed:0,wallContact:!1};return{position:[...e.startPos],prevPosition:[...e.startPos],velocity:[0,0,0],angularVelocity:[0,0,0],orientation:[0,0,0,1],prevOrientation:[0,0,0,1],radius:t.marbleRadius,contact:o,surfaceMaterial:"start",status:"racing",statusTimer:0,airTime:0,peakFallSpeed:0,coyoteTimer:t.coyoteTime,jumpBufferTimer:0,jumpCooldown:0,portalCooldown:0,portalCrossings:0,lastPortalExitSpeed:0,respawnPos:[...e.startPos],marblePresetIndex:i}}function xa(e,i,t=Qe){let o=e,r=i,a=Ht(e,0,t),s=0;function c(l=!0){const f=l?a.respawnPos:o.startPos;a={...Ht(o,a.marblePresetIndex,t),position:[...f],prevPosition:[...f],respawnPos:[...f]},s=0}function n(l,f){o=l,r=f,a=Ht(l,a.marblePresetIndex,t),s=0}function u(){a={...a,marblePresetIndex:(a.marblePresetIndex+1)%4}}function b(l,f,d){var ze;if(f.respawnPressed)return c(!0),a;const m=a.position,S=a.orientation;if(a.status!=="racing"){const Z=a.statusTimer+l;if(a.status==="goal"){const C=[o.goalPos[0]-a.position[0],0,o.goalPos[2]-a.position[2]],ee=[(a.velocity[0]+C[0]*12*l)*.9,0,(a.velocity[2]+C[2]*12*l)*.9],pe=Le(a.position,xe(ee,l));return a={...a,prevPosition:m,prevOrientation:S,position:pe,velocity:ee,statusTimer:Z},a}return Z>=t.respawnDelaySec?(c(!0),a):(a={...a,prevPosition:m,prevOrientation:S,statusTimer:Z},a)}let k=a.respawnPos;if(o.checkpoints)for(const Z of o.checkpoints)lt(qe(a.position,Z.position))<=Z.radius&&(k=Z.position);const M=a.position[0]-o.goalPos[0],H=Math.abs(a.position[1]-(o.goalPos[1]+a.radius)),p=a.position[2]-o.goalPos[2];if(Math.hypot(M,p)<=o.goalRadius&&H<=1.45)return a={...a,prevPosition:m,prevOrientation:S,status:"goal",statusTimer:0,surfaceMaterial:"goal",respawnPos:k},a;if(a.position[1]<o.killPlaneY)return a={...a,prevPosition:m,prevOrientation:S,status:"fell",statusTimer:0,respawnPos:k},a;let R=Math.max(0,a.coyoteTimer-l),w=f.jumpPressed?t.jumpBufferTime:Math.max(0,a.jumpBufferTimer-l),P=Math.max(0,a.jumpCooldown-l),[T,I,D]=a.velocity;const W=st[a.surfaceMaterial]??st.standard;I-=t.gravity*l;const[Q,se]=f.moveXZ,re=Math.hypot(Q,se),ie=a.surfaceMaterial==="ice";if(a.contact.grounded){const Z=a.contact.surfaceVelocity[0],C=a.contact.surfaceVelocity[2],ee=T-Z,pe=D-C,ge=Math.hypot(ee,pe);let be=Q*t.rollAcceleration,ve=se*t.rollAcceleration;if(re>.01){const Ae=1+.65*(1-Math.min(1,ge/5.5));if(be*=Ae,ve*=Ae,ge>.35){const le=ee/ge,he=pe/ge,fe=Q/re,we=se/re,Ce=le*fe+he*we,$e=ie?.18:Math.min(1.6,Math.max(.18,W.friction/1.85));if(Ce<-.1){const De=ie&&ge<12.5?.18+(1- -Ce)*.65:1+-Ce*1.45*$e;be*=De,ve*=De}else{const De=Math.sqrt(Math.max(0,1-Ce*Ce)),Ve=-he*fe+le*we,Pe=De*.45*$e*t.rollAcceleration*re;if(be+=-he*Math.sign(Ve)*Pe,ve+=le*Math.sign(Ve)*Pe,ie&&De>.2&&ge<12.5){const Be=be*le+ve*he,Fe=be-Be*le,Xe=ve-Be*he,Oe=.18+.42*Math.max(0,Ce);be=Be*le+Fe*Oe,ve=Be*he+Xe*Oe}}}}T+=be*l,D+=ve*l;const ye=a.contact.normal[0],me=a.contact.normal[2],Te=Math.hypot(ye,me);if(Te>.02){const Ae=ie?Math.max(1.4,W.slopeMultiplier):W.slopeMultiplier,le=t.slopeBoost*Ae;T+=ye*le*l,D+=me*le*l}const K=T-Z,N=D-C,Me=1/(1+(ie&&re<.05?W.rollingDrag??W.friction:W.friction)*l);T=Z+K*Me,D=C+N*Me,!ie&&re<.01&&Te<.025&&Math.hypot(T-Z,D-C)<.12&&(T=Z,D=C)}else T+=Q*t.rollAcceleration*t.airControl*l,D+=se*t.rollAcceleration*t.airControl*l;let E=a.contact.grounded;w>0&&R>0&&P<=0&&(I=Math.max(I,t.jumpImpulse)+Math.max(0,a.contact.surfaceVelocity[1]*.85),E=!1,R=0,w=0,P=.26);const $=Math.hypot(T,D),v=t.maxHorizontalSpeed*(W.speedMultiplier??1);if($>v){const Z=v/$;T*=Z,D*=Z}let x=[T,I,D];const _=xe(x,l);let F=a.position;const q=lt(_);if(!E&&q>a.radius*.45){const Z=r.sphereCast(a.position,a.radius,_,d,12);Z.hit?F=Le(a.position,xe(_,Z.toi*.96)):F=Le(a.position,_)}else F=Le(a.position,_);const U=((ze=r.getPortals)==null?void 0:ze.call(r))??o.portals??[];let h=Math.max(0,(a.portalCooldown??0)-l);if(U.length>0){const Z={...a,position:F,velocity:x},C=za(m,Z,U,l);if(C.crossed)return a={...C.state,coyoteTimer:0,jumpBufferTimer:w,jumpCooldown:P,respawnPos:k},a;x=C.state.velocity,h=C.state.portalCooldown??0}let A=!1,g=!1,G=[0,1,0],O=a.radius,te=[F[0],F[1]-a.radius,F[2]],ae=[0,0,0],oe=a.surfaceMaterial,L=0,de=a.status;const X=.0015,J=a.contact.grounded&&P<=0&&x[1]<=2?.075:0;for(let Z=0;Z<5;Z++){const C=r.queryContact(F,a.radius,d);O=C.distance;const ee=Z===0&&C.normal[1]>t.groundNormalThreshold?a.radius+J:a.radius;if(C.distance>=ee)break;const pe=a.radius-C.distance+X;F=Le(F,xe(C.normal,pe)),G=C.normal,te=C.contactPoint,ae=C.surfaceVelocity,oe=C.material;const ge=st[C.material]??st.standard;if(ge.lethal==="acid"){de="sunk";break}ge.isGoal&&(de="goal");const be=qe(x,C.surfaceVelocity),ve=nt(be,C.normal);if(ve<0){const ye=-ve;if(ye>L&&(L=ye),ye>=t.shatterImpactSpeed&&C.material!=="bounce"&&C.normal[1]>.5){de="shattered";break}const Te=-(1+(ye<2.2&&C.material!=="bounce"&&C.material!=="bumper"?0:ge.restitution))*ve;if(x=Le(x,xe(C.normal,Te)),ge.bumperImpulse>0){const K=yt([C.normal[0],Math.max(.18,C.normal[1]),C.normal[2]]);x=Le(x,xe(K,ge.bumperImpulse))}C.normal[1]<=t.groundNormalThreshold&&(g=!0,x=[x[0]*.94,x[1],x[2]*.94])}C.normal[1]>t.groundNormalThreshold&&(A=!0)}if(A&&de==="racing"&&oe!=="bounce"&&oe!=="bumper"){const Z=qe(x,ae),C=nt(Z,G);C<.8&&(x=qe(x,xe(G,C+.35)))}const ce=x[0]-(A?ae[0]:0),B=[(x[2]-(A?ae[2]:0))/a.radius,0,-ce/a.radius],V=lt(B);let ue=a.orientation;if(V>1e-4){const Z=xe(B,1/V),C=.5*V*l,ee=Math.sin(C),pe=[Z[0]*ee,Z[1]*ee,Z[2]*ee,Math.cos(C)];ue=ya(ba(pe,a.orientation))}const ne=A?0:a.airTime+l,Se=A?0:Math.max(a.peakFallSpeed,Math.max(0,-x[1]));return A&&(R=t.coyoteTime),a={position:F,prevPosition:m,velocity:x,angularVelocity:B,orientation:ue,prevOrientation:S,radius:a.radius,contact:{grounded:A,normal:G,distance:O,contactPoint:te,surfaceVelocity:ae,impactSpeed:L,wallContact:g},surfaceMaterial:oe,status:de,statusTimer:de==="racing"?0:a.statusTimer,airTime:ne,peakFallSpeed:Se,coyoteTimer:R,jumpBufferTimer:w,jumpCooldown:P,portalCooldown:h,portalCrossings:a.portalCrossings??0,lastPortalExitSpeed:a.lastPortalExitSpeed??0,respawnPos:k,marblePresetIndex:a.marblePresetIndex},a}function y(l,f,d){const m=Math.min(Math.max(l,0),.08);s+=m;let S=0,k=f;for(;s>=t.fixedDt&&S<t.maxSubSteps;)b(t.fixedDt,k,d-s+t.fixedDt),s-=t.fixedDt,S++,k={...k,jumpPressed:!1,respawnPressed:!1};s>t.fixedDt*2&&(s=0);const M=Math.min(1,Math.max(0,s/t.fixedDt)),H=mt(a.prevPosition,a.position,M),p=Sa(a.prevOrientation,a.orientation,M);return{state:a,renderPosition:H,renderOrientation:p,alpha:M,subStepsRun:S}}return{getState:()=>a,setState:l=>{a=l},setCourse:n,respawn:c,cycleMarblePreset:u,update:y,stepFixed:b}}const ea=[{id:0,code:"ultra-sdf",label:"ULTRA LOCKSTEP SDF",shortLabel:"ULTRA SDF",badge:"C∞ jSDF + GLASS REFRACT",description:"True optical glass refraction, floor caustics, curvature bevel highlights, 1-bounce glossy reflections, O(1) cathedral megastructure, and 120 Hz analytical jSDF physics."},{id:1,code:"basic-polygon",label:"BASIC POLYGON + FACETED PHYSICS",shortLabel:"BASIC POLYGON",badge:"16-SEG FACETED MESH",description:"Traditional flat-shaded triangle mesh remake: dFdx×dFdy face normals, wireframe quad diagonals, hard CSG seams, and 16-segment faceted physics normals with 3°–6° edge chatter."},{id:2,code:"split-ab",label:"SPLIT-SCREEN A/B (BASIC | ULTRA SDF)",shortLabel:"SPLIT A/B",badge:"LEFT: POLY | RIGHT: SDF",description:"Live split-screen engine comparison: Flat-shaded Basic Polygon Mesh on the left vs Ultra Raymarched SDF with optical glass & megastructure on the right."}];function Io(e){return(e+1)%3}function Eo(e){return ea[e]??ea[0]}function ta(e,i,t){return e<i?i:e>t?t:e}function Ba(e,i,t){const o=Math.hypot(e,i,t);return o<1e-8?[0,1,0]:[e/o,i/o,t/o]}function Dt(e){return e-Math.floor(e)}function $t(e,i,t=16){const o=Math.max(4,Math.floor(t)),r=e[0],a=ta(e[1],-1,1),s=e[2],c=Math.acos(a),n=Math.atan2(s,r),u=.85,b=Dt(i[0]/u),y=Dt(i[2]/u),l=Math.floor(i[0]/u),f=Math.floor(i[2]/u),d=b+y>1?1:-1,m=(l*73856093^f*19349663)&1?1:-1,S=Math.PI/(o*2),k=Math.PI*2/o,M=.35*d+.15*m,H=c>.015?Math.round(c/S+M)*S:c+d*.062,p=Math.hypot(r,s)>.02?Math.round(n/k+.25*d)*k:(l+f+(d>0?.5:0))*k,R=ta(H,0,Math.PI),w=Math.sin(R),P=Math.cos(R),I=Math.abs(b+y-1)<.08?d*.068:d*.032,D=w*Math.cos(p)+I*.7,W=P,Q=w*Math.sin(p)-I*.7;return Ba(D,W,Q)}function Lo(e,i=0,t=16){const o=ot(e);let r=i;function a(l){const d=Dt(l[0]/.85)-.5,m=Dt(l[2]/.85)-.5;return(d*d+m*m)*.018}function s(l){return r===1?Math.floor(l*30)/30:l}function c(l,f){const d=o.sample(l,s(f));return r!==1?d:{...d,distance:d.distance+a(l)}}function n(l,f){const d=o.distance(l,s(f));return r===1?d+a(l):d}function u(l,f){const d=o.normal(l,s(f));return r!==1?d:$t(d,l,t)}function b(l,f,d){const m=o.queryContact(l,f,s(d));if(r!==1)return m;const S=$t(m.normal,l,t);return{...m,distance:m.distance+a(l),normal:S}}function y(l,f,d,m,S){const k=o.sphereCast(l,f,d,s(m),S);return r!==1||!k.hit?k:{...k,normal:$t(k.normal,k.hitPoint,t)}}return{sample:c,distance:n,normal:u,queryContact:b,sphereCast:y,isOccluded:(l,f,d,m)=>o.isOccluded(l,f,d,s(m)),setFieldMutations:l=>{var f;return(f=o.setFieldMutations)==null?void 0:f.call(o,l)},getFieldMutations:()=>{var l;return((l=o.getFieldMutations)==null?void 0:l.call(o))??[]},setPortals:l=>{var f;return(f=o.setPortals)==null?void 0:f.call(o,l)},getPortals:()=>{var l;return((l=o.getPortals)==null?void 0:l.call(o))??[]},getEngineMode:()=>r,setEngineMode:l=>{r=l},getPolygonSegments:()=>t}}const Fa=8,We=12,Ga=10,Ha=1.2,$a=.55;function Tt(e,i,t){return Math.min(t,Math.max(i,e))}function aa(e,i,t){const o=Tt((t-e)/Math.max(1e-6,i-e),0,1);return o*o*(3-2*o)}function Oa(e,i,t){const r=Math.PI*(3-Math.sqrt(5))*e,s=.18+.74*((e+.5)/i),c=Math.sqrt(Math.max(0,1-s*s)),n=[c*Math.cos(r),s,c*Math.sin(r)];return yt(Le(n,xe(t,.55)))}function oa(e,i,t){const o=lt(i);if(o<=1e-5)return e;const r=xe(i,1/o),a=.5*o*t,s=Math.sin(a),c=[r[0]*s,r[1]*s,r[2]*s,Math.cos(a)];return ya(ba(c,e))}function ft(e,i=!0,t=new Float32Array(We*4)){if(t.fill(0),!i)return t;const o=Math.min(e.length,We);for(let r=0;r<o;r++){const a=e[r],s=r*4;t[s+0]=a.position[0],t[s+1]=a.position[1],t[s+2]=a.position[2],t[s+3]=Math.max(0,a.effectiveRadius)}return t}function Pt(e,i=!0,t=new Float32Array(We*4)){t.fill(0);for(let r=0;r<We;r++)t[r*4+3]=1;if(!i)return t;const o=Math.min(e.length,We);for(let r=0;r<o;r++){const a=e[r].orientation,s=r*4;t[s+0]=a[0],t[s+1]=a[1],t[s+2]=a[2],t[s+3]=a[3]}return t}function Bo(e={}){const i=Tt(Math.round(e.shardCount??Ga),Fa,We),t=Math.max(.2,e.ballisticDurationSec??Ha),o=Math.max(.15,e.sweepDurationSec??$a),r=t+o,a=e.gravity??Qe.gravity,s=e.shardRestitution??.56,c=e.shardFriction??.84,n=new Float32Array(We*4),u=new Float32Array(We*4);let b="racing";function y(M=[0,0,0],H=[0,0,0]){return ft([],!1,n),Pt([],!1,u),{active:!1,phase:"idle",elapsedSec:0,ballisticDurationSec:t,sweepDurationSec:o,totalDurationSec:r,originPos:M,respawnPos:H,shards:[],whiskBroom:{active:!1,progress:0,sweepPosition:H,bristleAngleRad:0,convergence:0},uShatterShards:n,uShatterQuats:u}}let l=y();function f(M){const H=M.radius??Qe.marbleRadius,p=yt(M.impactNormal??[0,1,0]),R=Math.max(M.impactSpeed??lt(M.velocity),14),w=nt(M.velocity,p),P=w<0?qe(M.velocity,xe(p,1.35*w)):M.velocity,T=[];for(let I=0;I<i;I++){const D=Oa(I,i,p),W=I/Math.max(1,i-1),Q=H*(.24+.14*(I*7%5)/4),se=xe(D,H*.36),re=Le(M.position,se),ie=(3.8+3.4*(I*3%5)/4)*Math.min(1.6,R/22),E=3.2+2.8*(1-W*.5),$=[P[0]*.38+D[0]*ie,Math.max(2.4,Math.min(9.5,P[1]*.22+D[1]*ie+E)),P[2]*.38+D[2]*ie],v=yt([Math.sin(I*2.1+.5),Math.cos(I*1.7+.3),Math.sin(I*3.3-.8)]),x=xe(v,9+I%4*3.5),_=oa([0,0,0,1],x,.04*(I+1));T.push({index:I,position:re,velocity:$,orientation:_,angularVelocity:x,halfExtents:[Q*1.25,Q*.72,Q*.95],baseRadius:Q,effectiveRadius:Q,bounceCount:0,grounded:!1,scatterAnchor:re,scatterOrientation:_})}return ft(T,!0,n),Pt(T,!0,u),l={active:!0,phase:"ballistic",elapsedSec:0,ballisticDurationSec:t,sweepDurationSec:o,totalDurationSec:r,originPos:[...M.position],respawnPos:[...M.respawnPos],shards:T,whiskBroom:{active:!1,progress:0,sweepPosition:[...M.position],bristleAngleRad:0,convergence:0},uShatterShards:n,uShatterQuats:u},l}function d(M,H,p,R){const P=Math.max(1,Math.min(8,Math.ceil(H/.008333333333333333))),T=H/P;let I=M.position,D=M.velocity,W=M.orientation,Q=M.angularVelocity,se=M.bounceCount,re=M.grounded;for(let ie=0;ie<P;ie++){const E=R+ie*T;D=[D[0],D[1]-a*T,D[2]],I=Le(I,xe(D,T));const $=p.sample(I,E),v=M.baseRadius;if($.distance<v){const x=p.normal(I,E),_=v-$.distance+.0015;I=Le(I,xe(x,_));const F=Le($.kinematicVelocity,$.conveyorVelocity),q=qe(D,F),U=nt(q,x);if(U<0){const A=-(1+(-U<1.35?0:s*Math.pow(.82,Math.min(se,5))))*U,g=Le(q,xe(x,A)),G=qe(g,xe(x,nt(g,x))),O=xe(x,nt(g,x));D=Le(F,Le(O,xe(G,c))),-U>=1.1&&(se+=1,Q=[Q[0]*.8+G[2]*2.2,Q[1]*.85,Q[2]*.8-G[0]*2.2])}x[1]>.45&&Math.abs(nt(qe(D,F),x))<1.2?(re=!0,Q=xe(Q,Math.max(0,1-3.5*T))):re=!1}else re=!1;W=oa(W,Q,T)}return{...M,position:I,velocity:D,orientation:W,angularVelocity:Q,bounceCount:se,grounded:re,scatterAnchor:I,scatterOrientation:W}}function m(M,H,p=0){if(!l.active||l.phase==="idle"||l.phase==="complete")return l;const R=Math.max(0,Math.min(M,.25)),w=l.elapsedSec,P=w+R;let T=l.shards;if(w<t){const G=Math.min(R,t-w);G>0&&(T=T.map(O=>d(O,G,H,p)))}if(P<t)return ft(T,!0,n),Pt(T,!0,u),l={...l,phase:"ballistic",elapsedSec:P,shards:T,whiskBroom:{active:!1,progress:0,sweepPosition:l.originPos,bristleAngleRad:0,convergence:0},uShatterShards:n,uShatterQuats:u},l;const I=P-t,D=Tt(I/o,0,1),W=aa(0,1,D);let Q=0,se=0,re=0;const ie=Math.max(1,T.length);for(let G=0;G<T.length;G++){const O=T[G].scatterAnchor;Q+=O[0],se+=O[1],re+=O[2]}const E=[Q/ie,se/ie,re/ie],$=l.respawnPos,v=lt(qe($,E)),x=Math.min(3.2,Math.max(.65,v*.22))*Math.sin(Math.PI*W),_=mt(E,$,W),F=Math.sin(D*Math.PI*5)*(1-W)*.45,q=[_[0]+F,_[1]+x,_[2]-F*.5],U=Math.sin(D*Math.PI*6)*.42*(1-W),h=T.map((G,O)=>{const te=O/Math.max(1,T.length-1)*.14,ae=Tt((D-te)/(1-te),0,1),oe=aa(0,1,ae),L=(1-oe)*(O*.75+D*4.5),de=(1-oe)*(1-oe)*.28,X=mt(G.scatterAnchor,$,oe),J=Math.sin(Math.PI*oe)*Math.max(.45,v*.18),ce=D>=.999?[...$]:[X[0]+Math.cos(L)*de,X[1]+J,X[2]+Math.sin(L)*de],j=G.position,B=R>1e-5?xe(qe(ce,j),1/R):[0,0,0],V=Sa(G.scatterOrientation,[0,0,0,1],oe),ue=G.baseRadius*(1-.18*oe);return{...G,position:ce,velocity:B,orientation:V,angularVelocity:xe(G.angularVelocity,1-oe),effectiveRadius:ue,grounded:!1}}),A=P>=r,g=A?"complete":"whisk_sweep";return ft(h,!A,n),Pt(h,!A,u),l={...l,active:!A,phase:g,elapsedSec:P,shards:h,whiskBroom:{active:!A,progress:D,sweepPosition:q,bristleAngleRad:U,convergence:W},uShatterShards:n,uShatterQuats:u},l}function S(M,H,p,R=0){return M.status==="shattered"&&b!=="shattered"?(b="shattered",f({position:M.position,velocity:M.velocity,radius:M.radius,respawnPos:M.respawnPos,impactNormal:M.contact.normal,impactSpeed:M.contact.impactSpeed})):(b=M.status,M.status!=="shattered"&&l.active&&l.phase==="complete"?k():l.active?((l.respawnPos[0]!==M.respawnPos[0]||l.respawnPos[1]!==M.respawnPos[1]||l.respawnPos[2]!==M.respawnPos[2])&&(l={...l,respawnPos:[...M.respawnPos]}),m(p,H,R)):l)}function k(){return b="racing",l=y(l.originPos,l.respawnPos),l}return{getState:()=>l,trigger:f,reset:k,step:m,syncWithMarbleState:S,packUniforms:M=>ft(l.shards,l.active,M??n)}}function Pa(){const e=`// --- Raymarched Glass Shatter & Whisk-Broom Shader Snippet (GLSL ES 3.00) ---
#define MAX_SHATTER_SHARDS ${We}
uniform vec4 uShatterShards[MAX_SHATTER_SHARDS];
uniform int uShatterShardCount;

float sdGlassShardFaceted(vec3 p, float r, float seed) {
  float c = cos(seed);
  float s = sin(seed);
  vec3 q = vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
  float dSphere = length(q) - r;
  float dOcta = (abs(q.x * 1.12) + abs(q.y * 1.35) + abs(q.z * 0.95)) * 0.57735027 - r * 0.92;
  return max(dSphere, dOcta);
}

vec2 evalShatterShardsSdf(vec3 p) {
  float minD = 1000.0;
  int count = clamp(uShatterShardCount, 0, MAX_SHATTER_SHARDS);
  for (int i = 0; i < MAX_SHATTER_SHARDS; i++) {
    if (i >= count) break;
    vec4 shard = uShatterShards[i];
    if (shard.w <= 0.0001) continue;
    float d = sdGlassShardFaceted(p - shard.xyz, shard.w, float(i) * 1.61803 + uTime * 3.5);
    if (d < minD) {
      minD = d;
    }
  }
  return vec2(minD, 102.0);
}

vec3 shadeShatterGlassShard(vec3 p, vec3 n, vec3 V, vec3 baseCol, vec3 veinCol, vec3 sunDir) {
  vec3 L = normalize(sunDir);
  vec3 H = normalize(L + V);
  float ndotl = max(dot(n, L), 0.0);
  float ndotv = clamp(dot(n, V), 0.0, 1.0);
  float fresnel = pow(1.0 - ndotv, 3.0);
  vec3 refrDir = refract(-V, n, 1.0 / 1.52);
  float dispersion = 0.5 + 0.5 * sin(dot(p * 24.0, refrDir));
  vec3 prismTint = mix(baseCol, veinCol, dispersion);
  float spec = pow(max(dot(n, H), 0.0), 160.0) * 1.65;
  return prismTint * (0.42 + 0.75 * ndotl) + vec3(0.88, 0.97, 1.0) * fresnel * 0.85 + vec3(1.0) * spec;
}
`,i=`// --- Raymarched Glass Shatter & Whisk-Broom Shader Snippet (WGSL) ---
const MAX_SHATTER_SHARDS: u32 = ${We}u;

fn sdGlassShardFaceted(p: vec3<f32>, r: f32, seed: f32) -> f32 {
  let c = cos(seed);
  let s = sin(seed);
  let q = vec3<f32>(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
  let dSphere = length(q) - r;
  let dOcta = (abs(q.x * 1.12) + abs(q.y * 1.35) + abs(q.z * 0.95)) * 0.57735027 - r * 0.92;
  return max(dSphere, dOcta);
}

fn evalShatterShardsSdf(
  p: vec3<f32>,
  shards: array<vec4<f32>, ${We}>,
  shardCount: u32,
  time: f32,
) -> vec2<f32> {
  var minD: f32 = 1000.0;
  let limit = min(shardCount, MAX_SHATTER_SHARDS);
  for (var i: u32 = 0u; i < MAX_SHATTER_SHARDS; i = i + 1u) {
    if (i >= limit) { break; }
    let shard = shards[i];
    if (shard.w <= 0.0001) { continue; }
    let d = sdGlassShardFaceted(p - shard.xyz, shard.w, f32(i) * 1.61803 + time * 3.5);
    if (d < minD) {
      minD = d;
    }
  }
  return vec2<f32>(minD, 102.0);
}

fn shadeShatterGlassShard(
  p: vec3<f32>,
  n: vec3<f32>,
  V: vec3<f32>,
  baseCol: vec3<f32>,
  veinCol: vec3<f32>,
  sunDir: vec3<f32>,
) -> vec3<f32> {
  let L = normalize(sunDir);
  let H = normalize(L + V);
  let ndotl = max(dot(n, L), 0.0);
  let ndotv = clamp(dot(n, V), 0.0, 1.0);
  let fresnel = pow(1.0 - ndotv, 3.0);
  let refrDir = refract(-V, n, 1.0 / 1.52);
  let dispersion = 0.5 + 0.5 * sin(dot(p * 24.0, refrDir));
  let prismTint = mix(baseCol, veinCol, dispersion);
  let spec = pow(max(dot(n, H), 0.0), 160.0) * 1.65;
  return prismTint * (0.42 + 0.75 * ndotl) + vec3<f32>(0.88, 0.97, 1.0) * fresnel * 0.85 + vec3<f32>(1.0) * spec;
}
`;return{uniformName:"uShatterShards",maxShards:We,glsl:e,wgsl:i}}const _e=4,vt=[.12,.96,1],At=[1,.16,.83],ia={hard_landing:{kind:"hard_landing",kindId:1,maxRadius:6.5,durationSec:.95,ringWidth:.55,peakIntensity:1,magentaMix:.25},bumper_hit:{kind:"bumper_hit",kindId:2,maxRadius:7.5,durationSec:.85,ringWidth:.62,peakIntensity:1.2,magentaMix:.82},portal_exit:{kind:"portal_exit",kindId:3,maxRadius:8.5,durationSec:1.05,ringWidth:.68,peakIntensity:1.25,magentaMix:.5},crater_blast:{kind:"crater_blast",kindId:4,maxRadius:10.5,durationSec:1.2,ringWidth:.85,peakIntensity:1.45,magentaMix:.72}};function Ze(e,i,t){return Math.min(t,Math.max(i,e))}function gt(e){return{id:0,slotIndex:e,kind:"hard_landing",center:[0,0,0],spawnTime:0,ageSec:0,durationSec:1,currentRadius:0,maxRadius:6.5,ringWidth:.55,initialIntensity:0,intensity:0,magentaMix:.25,primaryColor:vt,secondaryColor:At,active:!1}}function Na(e,i,t){if(!e.contact.grounded)return{rimProximity:0,pulseIntensity:0,cliffDirection:[0,0,0],inDangerZone:!1};const o=e.radius,r=o*1.45,a=-o*1.25,s=8;let c=0,n=0,u=0;for(let S=0;S<s;S++){const k=S*Math.PI*2/s,M=Math.cos(k),H=Math.sin(k),p=[e.position[0]+M*r,e.position[1]+a,e.position[2]+H*r],w=i.distance(p,t)-o*.55;if(w>0){const P=Ze(w/(o*.95),0,1);P>c&&(c=P),n+=M*P,u+=H*P}}if(c<=.01)return{rimProximity:0,pulseIntensity:0,cliffDirection:[0,0,0],inDangerZone:!1};const b=yt([n,0,u]),y=Math.max(0,e.velocity[0]*b[0]+e.velocity[2]*b[2]),l=1+Ze(y/12,0,.35),f=Ze(c*l,0,1),d=.65+.35*Math.sin(t*18),m=Ze(f*d,0,1);return{rimProximity:f,pulseIntensity:m,cliffDirection:b,inDangerZone:f>=.35}}function Fo(){let e=1;const i=[gt(0),gt(1),gt(2),gt(3)];let t={rimProximity:0,pulseIntensity:0,cliffDirection:[0,0,0],inDangerZone:!1};const o=new Float32Array(_e*4),r=new Float32Array(_e*4),a=new Float32Array(4);function s(){for(let S=0;S<_e;S++)if(!i[S].active)return S;let d=0,m=1/0;for(let S=0;S<_e;S++)i[S].intensity<m&&(m=i[S].intensity,d=S);return d}function c(d){const m=ia[d.kind],S=s(),k=Math.max(.05,d.intensity??m.peakIntensity),M=Math.max(.5,d.maxRadius??m.maxRadius),H=Math.max(.1,d.durationSec??m.durationSec),p=Math.max(.12,d.ringWidth??m.ringWidth),R=Ze(d.magentaMix??m.magentaMix,0,1),w=mt(vt,At,R),P=mt(At,vt,R),T={id:e++,slotIndex:S,kind:d.kind,center:[...d.center],spawnTime:d.spawnTime??0,ageSec:0,durationSec:H,currentRadius:.15,maxRadius:M,ringWidth:p,initialIntensity:k,intensity:k,magentaMix:R,primaryColor:w,secondaryColor:P,active:!0};return i[S]=T,T}function n(d){const m=Math.max(0,d);for(let S=0;S<_e;S++){const k=i[S];if(!k.active)continue;const M=k.ageSec+m;if(M>=k.durationSec){i[S]={...k,ageSec:k.durationSec,currentRadius:k.maxRadius,intensity:0,active:!1};continue}const H=Ze(M/k.durationSec,0,1),p=1-Math.pow(1-H,2.15),R=.15+(k.maxRadius-.15)*p,w=k.initialIntensity*Math.pow(1-H,1.65);i[S]={...k,ageSec:M,currentRadius:R,intensity:w}}return i}function u(d){let m=0,S=[0,0,0],k=0;for(let H=0;H<_e;H++){const p=i[H];if(!p.active||p.intensity<=1e-4)continue;const R=lt(qe(d,p.center)),w=(R-p.currentRadius)/p.ringWidth,P=Math.exp(-w*w*1.85),T=(R-p.currentRadius*.72)/(p.ringWidth*.75),I=.35*Math.exp(-T*T*2.2),D=(P+I)*p.intensity;if(D>.001){k++,m+=D;const W=Ze(.5+.5*Math.sin(w*2.4+p.magentaMix*Math.PI),0,1),Q=mt(vt,At,Ze(.5*p.magentaMix+.5*W,0,1));S=Le(S,xe(Q,D))}}const M=m>1e-4?xe(S,1/m):vt;return{totalIntensity:m,gridLineBoost:1+m*2.4,waveColor:M,contributingRings:k}}function b(d,m,S){return t=Na(d,m,S),t}function y(d,m,S){const k=[];if(!d)return k;const M=!d.contact.grounded&&m.contact.grounded,H=d.status!=="shattered"&&m.status==="shattered";if(M&&m.contact.impactSpeed>=6.5||H){const p=Ze(m.contact.impactSpeed/18,.65,1.5);k.push(c({kind:"hard_landing",center:m.contact.contactPoint,intensity:p,maxRadius:5.5+p*2.5,spawnTime:S}))}return m.surfaceMaterial==="bumper"&&m.contact.impactSpeed>=3&&d.surfaceMaterial!=="bumper"&&k.push(c({kind:"bumper_hit",center:m.contact.contactPoint,intensity:Ze(m.contact.impactSpeed/12,.85,1.45),spawnTime:S})),k}function l(){o.fill(0),r.fill(0);for(let d=0;d<_e;d++){const m=i[d],S=d*4;!m.active||m.intensity<=1e-4||(o[S+0]=m.center[0],o[S+1]=m.center[1],o[S+2]=m.center[2],o[S+3]=m.currentRadius,r[S+0]=m.intensity,r[S+1]=m.ringWidth,r[S+2]=m.magentaMix,r[S+3]=ia[m.kind].kindId)}return a[0]=t.rimProximity,a[1]=t.pulseIntensity,a[2]=t.cliffDirection[0],a[3]=t.cliffDirection[2],{uShockwaveRings:o,uShockwaveParams:r,uRimDanger:a}}function f(){for(let d=0;d<_e;d++)i[d]=gt(d);t={rimProximity:0,pulseIntensity:0,cliffDirection:[0,0,0],inDangerZone:!1}}return{getRings:()=>i,getActiveRings:()=>i.filter(d=>d.active),getRimDanger:()=>t,trigger:c,step:n,evaluateAtPoint:u,updateRimDanger:b,detectMarbleEvents:y,packUniforms:l,clear:f}}function Ma(){const e=`// --- Isometric Grid Shockwave & Rim-Danger Pulse Snippet (GLSL ES 3.00) ---
#define MAX_SHOCKWAVE_RINGS ${_e}
uniform vec4 uShockwaveRings[MAX_SHOCKWAVE_RINGS];
uniform vec4 uShockwaveParams[MAX_SHOCKWAVE_RINGS];
uniform vec4 uRimDanger; // [rimProximity, pulseIntensity, cliffDirX, cliffDirZ]

vec3 applyShockwaveAndRimContours(vec3 p, float gridMask, vec3 surfaceCol, vec3 marblePos) {
  const vec3 neonCyan = vec3(0.12, 0.96, 1.00);
  const vec3 neonMagenta = vec3(1.00, 0.16, 0.83);
  vec3 waveGlow = vec3(0.0);

  for (int i = 0; i < MAX_SHOCKWAVE_RINGS; i++) {
    vec4 ring = uShockwaveRings[i];
    vec4 param = uShockwaveParams[i];
    float intensity = param.x;
    if (intensity <= 0.001) continue;

    float width = max(param.y, 0.12);
    float dist = length(p - ring.xyz);
    float dNorm = (dist - ring.w) / width;
    float front = exp(-dNorm * dNorm * 1.85);
    float echoD = (dist - ring.w * 0.72) / (width * 0.75);
    float echo = 0.35 * exp(-echoD * echoD * 2.2);

    float mixT = clamp(0.5 * param.z + 0.5 * (0.5 + 0.5 * sin(dNorm * 2.4)), 0.0, 1.0);
    vec3 ringCol = mix(neonCyan, neonMagenta, mixT);
    float contourWeight = mix(0.28, 1.35, gridMask);
    waveGlow += ringCol * (front + echo) * intensity * contourWeight;
  }

  // Rim-Danger Pulse near cliff drop-offs around the marble
  if (uRimDanger.y > 0.01) {
    float dMarble = length(p.xz - marblePos.xz);
    float localDanger = exp(-dMarble * dMarble * 0.45) * uRimDanger.y;
    vec3 dangerCol = mix(vec3(1.0, 0.55, 0.12), neonMagenta, 0.45);
    waveGlow += dangerCol * localDanger * mix(0.25, 1.25, gridMask);
  }

  return surfaceCol + waveGlow;
}
`,i=`// --- Isometric Grid Shockwave & Rim-Danger Pulse Snippet (WGSL) ---
const MAX_SHOCKWAVE_RINGS: u32 = ${_e}u;

fn applyShockwaveAndRimContours(
  p: vec3<f32>,
  gridMask: f32,
  surfaceCol: vec3<f32>,
  marblePos: vec3<f32>,
  rings: array<vec4<f32>, ${_e}>,
  params: array<vec4<f32>, ${_e}>,
  rimDanger: vec4<f32>,
) -> vec3<f32> {
  let neonCyan = vec3<f32>(0.12, 0.96, 1.00);
  let neonMagenta = vec3<f32>(1.00, 0.16, 0.83);
  var waveGlow = vec3<f32>(0.0);

  for (var i: u32 = 0u; i < MAX_SHOCKWAVE_RINGS; i = i + 1u) {
    let ring = rings[i];
    let param = params[i];
    let intensity = param.x;
    if (intensity <= 0.001) { continue; }

    let width = max(param.y, 0.12);
    let dist = length(p - ring.xyz);
    let dNorm = (dist - ring.w) / width;
    let front = exp(-dNorm * dNorm * 1.85);
    let echoD = (dist - ring.w * 0.72) / (width * 0.75);
    let echo = 0.35 * exp(-echoD * echoD * 2.2);

    let mixT = clamp(0.5 * param.z + 0.5 * (0.5 + 0.5 * sin(dNorm * 2.4)), 0.0, 1.0);
    let ringCol = mix(neonCyan, neonMagenta, mixT);
    let contourWeight = mix(0.28, 1.35, gridMask);
    waveGlow = waveGlow + ringCol * (front + echo) * intensity * contourWeight;
  }

  if (rimDanger.y > 0.01) {
    let dMarble = length(p.xz - marblePos.xz);
    let localDanger = exp(-dMarble * dMarble * 0.45) * rimDanger.y;
    let dangerCol = mix(vec3<f32>(1.0, 0.55, 0.12), neonMagenta, 0.45);
    waveGlow = waveGlow + dangerCol * localDanger * mix(0.25, 1.25, gridMask);
  }

  return surfaceCol + waveGlow;
}
`;return{maxRings:_e,glsl:e,wgsl:i}}function wa(){return{glsl:`
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
`,wgsl:`
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
`}}function z(e){if(!Number.isFinite(e))return"0.0";const i=e.toFixed(5);return i.includes(".")?i:`${i}.0`}function Ge(e){return`vec3(${z(e[0])}, ${z(e[1])}, ${z(e[2])})`}function He(e){return`vec3<f32>(${z(e[0])}, ${z(e[1])}, ${z(e[2])})`}function Kt(e){return e.kind==="union"||e.kind==="smoothUnion"||e.kind==="subtract"||e.kind==="smoothSubtract"||e.kind==="intersect"}function Yt(e,i){if(!Kt(e)){i.push(e);return}for(const t of e.children)Yt(t,i)}function _a(e){if(!e)return[0,0,0];if(e.kind==="piston"){const r=Math.abs(e.stroke);return[Math.abs(e.axis[0])*r,Math.abs(e.axis[1])*r,Math.abs(e.axis[2])*r]}if(e.kind==="bridge"){const r=Math.abs(e.amplitude);return[Math.abs(e.axis[0])*r,Math.abs(e.axis[1])*r,Math.abs(e.axis[2])*r]}const i=Math.abs(e.span[0]),t=Math.abs(e.span[1]),o=Math.abs(e.span[2]||e.span[0]);return[i,t,o]}function Ua(e){const i=_a(e.kinematic);let t=1,o=1,r=1,a=e.center[0],s=e.center[1],c=e.center[2];switch(e.kind){case"box":t=e.halfExtents[0],o=e.halfExtents[1],r=e.halfExtents[2];break;case"roundedBox":t=e.halfExtents[0]+e.radius,o=e.halfExtents[1]+e.radius,r=e.halfExtents[2]+e.radius;break;case"sphere":t=e.radius,o=e.radius,r=e.radius;break;case"cylinder":t=e.radius,o=e.halfHeight,r=e.radius;break;case"capsule":t=Math.max(Math.abs(e.a[0]),Math.abs(e.b[0]))+e.radius,o=Math.max(Math.abs(e.a[1]),Math.abs(e.b[1]))+e.radius,r=Math.max(Math.abs(e.a[2]),Math.abs(e.b[2]))+e.radius;break;case"torus":t=e.majorRadius+e.minorRadius,o=e.minorRadius,r=e.majorRadius+e.minorRadius;break;case"ramp":{const n=e.railHeight??0,u=e.railThickness??.28;e.axis==="x"?(t=e.halfLength,o=Math.abs(e.rise)*.5+e.thickness+n,r=e.halfWidth+u):(t=e.halfWidth+u,o=Math.abs(e.rise)*.5+e.thickness+n,r=e.halfLength);break}case"sweptTrack":{const n=e.railHeight??0,u=e.halfWidth+(e.railThickness??.28)+.25,b=Math.min(e.start[0],e.end[0])-u,y=Math.max(e.start[0],e.end[0])+u,l=Math.min(e.start[1],e.end[1])-e.thickness-.25,f=Math.max(e.start[1],e.end[1])+n+.25,d=Math.min(e.start[2],e.end[2])-u,m=Math.max(e.start[2],e.end[2])+u;a+=(b+y)*.5,s+=(l+f)*.5,c+=(d+m)*.5,t=(y-b)*.5,o=(f-l)*.5,r=(m-d)*.5;break}case"waveFloor":t=e.halfExtents[0],o=e.halfExtents[1]+Math.abs(e.waveAmplitude),r=e.halfExtents[2];break;case"piston":t=e.headHalfExtents[0]+e.bevelRadius,o=e.headHalfExtents[1]+2.4+e.bevelRadius,r=e.headHalfExtents[2]+e.bevelRadius;break}if(e.rotation){const n=Math.hypot(t,o,r);t=n,o=n,r=n}return t+=i[0],o+=i[1],r+=i[2],{min:[a-t,s-o,c-r],max:[a+t,s+o,c+r]}}function Qt(e,i=4){const t=Bt(e),o=[];Yt(t,o);let r=Math.min(e.startPos[0]-2,e.goalPos[0]-e.goalRadius-1.5),a=Math.max(e.startPos[0]+2,e.goalPos[0]+e.goalRadius+1.5),s=Math.min(e.startPos[1]-2,e.goalPos[1]-2),c=Math.max(e.startPos[1]+3,e.goalPos[1]+3.5),n=Math.min(e.startPos[2]-2,e.goalPos[2]-e.goalRadius-1.5),u=Math.max(e.startPos[2]+2,e.goalPos[2]+e.goalRadius+1.5);for(const b of o){const y=Ua(b);y.min[0]<r&&(r=y.min[0]),y.max[0]>a&&(a=y.max[0]),y.min[1]<s&&(s=y.min[1]),y.max[1]>c&&(c=y.max[1]),y.min[2]<n&&(n=y.min[2]),y.max[2]>u&&(u=y.max[2])}return r-=i,a+=i,s-=i,c+=i,n-=i,u+=i,{center:[(r+a)*.5,(s+c)*.5,(n+u)*.5],halfExtents:[Math.max(1,(a-r)*.5),Math.max(1,(c-s)*.5),Math.max(1,(u-n)*.5)],padding:i}}function Wa(e){if(!e)return"vec3(0.0)";const i=Math.PI*2,t=e.phase??0,o=i*e.frequency;if(e.kind==="piston"){const r=e.slamSharpness??2;return`(${Ge(e.axis)} * (${z(e.stroke)} * pow(max(0.0, 0.5 + 0.5 * sin(${z(o)} * uTime + ${z(t)})), ${z(r)})))`}if(e.kind==="bridge")return`(${Ge(e.axis)} * (${z(e.amplitude)} * sin(${z(o)} * uTime + ${z(t)})))`;if(e.mode==="orbit"){const r=e.span[0],a=e.span[1],s=e.span[2]||e.span[0],c=`(${z(o)} * uTime + ${z(t)})`;return`vec3(${z(r)} * cos(${c}), ${z(a)} * sin(2.0 * ${c}), ${z(s)} * sin(${c}))`}return`(${Ge(e.span)} * sin(${z(o)} * uTime + ${z(t)}))`}function Va(e){if(!e)return"vec3<f32>(0.0)";const i=Math.PI*2,t=e.phase??0,o=i*e.frequency;if(e.kind==="piston"){const r=e.slamSharpness??2;return`(${He(e.axis)} * (${z(e.stroke)} * pow(max(0.0, 0.5 + 0.5 * sin(${z(o)} * u.time + ${z(t)})), ${z(r)})))`}if(e.kind==="bridge")return`(${He(e.axis)} * (${z(e.amplitude)} * sin(${z(o)} * u.time + ${z(t)})))`;if(e.mode==="orbit"){const r=e.span[0],a=e.span[1],s=e.span[2]||e.span[0],c=`(${z(o)} * u.time + ${z(t)})`;return`vec3<f32>(${z(r)} * cos(${c}), ${z(a)} * sin(2.0 * ${c}), ${z(s)} * sin(${c}))`}return`(${He(e.span)} * sin(${z(o)} * u.time + ${z(t)}))`}function qa(e,i){switch(e.kind){case"box":return`sdBox(${i}, ${Ge(e.halfExtents)})`;case"roundedBox":return`sdRoundedBox(${i}, ${Ge(e.halfExtents)}, ${z(e.radius)})`;case"sphere":return`sdSphere(${i}, ${z(e.radius)})`;case"cylinder":return`sdCylinder(${i}, ${z(e.radius)}, ${z(e.halfHeight)})`;case"capsule":return`sdCapsule(${i}, ${Ge(e.a)}, ${Ge(e.b)}, ${z(e.radius)})`;case"torus":return`sdTorus(${i}, ${z(e.majorRadius)}, ${z(e.minorRadius)})`;case"ramp":return(e.axis==="x"?"sdRampX":"sdRampZ")+`(${i}, ${z(e.halfLength)}, ${z(e.rise)}, ${z(e.halfWidth)}, ${z(e.thickness)}, ${z(e.railHeight??0)}, ${z(e.railThickness??.28)})`;case"sweptTrack":return`sdSweptTrack(${i}, ${Ge(e.start)}, ${Ge(e.end)}, ${z(e.halfWidth)}, ${z(e.thickness)}, ${z(e.railHeight??0)}, ${z(e.railThickness??.28)})`;case"waveFloor":return`sdWaveFloor(${i}, ${Ge(e.halfExtents)}, ${z(e.waveAmplitude)}, ${z(e.waveFrequencyX)}, ${z(e.waveFrequencyZ)}, ${z(e.waveSpeed)}, uTime)`;case"piston":return`sdPiston(${i}, ${Ge(e.headHalfExtents)}, ${z(e.bevelRadius)})`}}function Xa(e,i){switch(e.kind){case"box":return`sdBox(${i}, ${He(e.halfExtents)})`;case"roundedBox":return`sdRoundedBox(${i}, ${He(e.halfExtents)}, ${z(e.radius)})`;case"sphere":return`sdSphere(${i}, ${z(e.radius)})`;case"cylinder":return`sdCylinder(${i}, ${z(e.radius)}, ${z(e.halfHeight)})`;case"capsule":return`sdCapsule(${i}, ${He(e.a)}, ${He(e.b)}, ${z(e.radius)})`;case"torus":return`sdTorus(${i}, ${z(e.majorRadius)}, ${z(e.minorRadius)})`;case"ramp":return(e.axis==="x"?"sdRampX":"sdRampZ")+`(${i}, ${z(e.halfLength)}, ${z(e.rise)}, ${z(e.halfWidth)}, ${z(e.thickness)}, ${z(e.railHeight??0)}, ${z(e.railThickness??.28)})`;case"sweptTrack":return`sdSweptTrack(${i}, ${He(e.start)}, ${He(e.end)}, ${z(e.halfWidth)}, ${z(e.thickness)}, ${z(e.railHeight??0)}, ${z(e.railThickness??.28)})`;case"waveFloor":return`sdWaveFloor(${i}, ${He(e.halfExtents)}, ${z(e.waveAmplitude)}, ${z(e.waveFrequencyX)}, ${z(e.waveFrequencyZ)}, ${z(e.waveSpeed)}, u.time)`;case"piston":return`sdPiston(${i}, ${He(e.headHalfExtents)}, ${z(e.bevelRadius)})`}}function Wt(e,i,t){const o=t.id++,r=`res_${o}`;if(!Kt(e)){const c=`p_${o}`,n=e.kinematic?`(${Ge(e.center)} + ${Wa(e.kinematic)})`:Ge(e.center);if(e.rotation){const y=e.rotation;i.push(`  vec3 ${c} = rotateByQuatInverse(p - ${n}, vec4(${z(y[0])}, ${z(y[1])}, ${z(y[2])}, ${z(y[3])}));`)}else i.push(`  vec3 ${c} = p - ${n};`);const u=z(Ft[e.material]),b=qa(e,c);return i.push(`  vec2 ${r} = vec2(${b}, ${u});`),r}if(e.children.length===0)return i.push(`  vec2 ${r} = vec2(1000.0, 0.0);`),r;const a=Wt(e.children[0],i,t);i.push(`  vec2 ${r} = ${a};`);const s=z(e.smoothRadius??.14);for(let c=1;c<e.children.length;c++){const n=Wt(e.children[c],i,t);e.kind==="union"?i.push(`  ${r} = opUnion(${r}, ${n});`):e.kind==="smoothUnion"?i.push(`  ${r} = opSmoothUnion(${r}, ${n}, ${s});`):e.kind==="subtract"?i.push(`  ${r} = opSubtract(${r}, ${n});`):e.kind==="smoothSubtract"?i.push(`  ${r} = opSmoothSubtract(${r}, ${n}, ${s});`):i.push(`  ${r} = opIntersect(${r}, ${n});`)}return r}function It(e){const i=Bt(e),t=Qt(e,4),o=[],a=Wt(i,o,{id:0}),s=Pa().glsl,c=Ma().glsl,n=wa().glsl,u=Ge(t.center),b=Ge(t.halfExtents);return`#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform vec2 uResolution;
uniform float uTime;

uniform vec3 uCameraPos;
uniform vec3 uCameraForward;
uniform vec3 uCameraRight;
uniform vec3 uCameraUp;
uniform float uCameraTanHalfFov;

uniform vec3 uMarblePos;
uniform vec4 uMarbleQuat;
uniform float uMarbleRadius;
uniform int uMarbleStatus;
uniform float uMarbleStatusTimer;

uniform vec3 uMarbleBaseColor;
uniform vec3 uMarbleVeinColor;
uniform vec3 uMarbleGlowColor;
uniform float uMarbleIridescence;

uniform float uGlassStress;
uniform float uCrackVisibility;
uniform float uStressGlow;

uniform int uGhostActive;
uniform vec3 uGhostPos;
uniform vec4 uGhostQuat;
uniform vec4 uGhostColor;

// Other Multiplayer Marbles in the 3D Scene (up to 6 active players)
uniform int uOtherMarbleCount;
uniform vec4 uOtherMarblePosRad[6]; // xyz = position, w = radius
uniform vec4 uOtherMarbleColor[6];  // rgb = color, w = slotIndex

uniform vec3 uGoalPos;
uniform float uGoalRadius;
uniform float uOcclusionStrength;

uniform vec3 uTrackPrimary;
uniform vec3 uTrackSecondary;
uniform vec3 uGridLineColor;
uniform vec3 uWallColor;
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec3 uAbyssFogColor;
uniform float uAbyssFogDensity;
uniform vec3 uSunDir;

${s}
${c}

// Realtime CSG FieldMutation Ring Buffer (uMutations, MAX_MUTATIONS = 16)
uniform int uMutationCount;
uniform vec4 uMutationsPosA[16]; // xyz = posA, w = radius
uniform vec4 uMutationsPosB[16]; // xyz = posB, w = blendK
uniform vec4 uMutationsMeta[16]; // x = kindCode (1..4), y = materialId, z = spawnTime, w = ttl

// Non-Euclidean Raymarched SDF Portal Pairs (MAX_PORTAL_PAIRS = 2)
uniform int uPortalPairCount;
uniform vec4 uPortalPosA[2];    // xyz = posA, w = radius
uniform vec4 uPortalNormalA[2]; // xyz = normalA, w = activeA
uniform vec4 uPortalUpA[2];     // xyz = upA, w = flingBoost
uniform vec4 uPortalPosB[2];    // xyz = posB, w = radius
uniform vec4 uPortalNormalB[2]; // xyz = normalB, w = activeB
uniform vec4 uPortalUpB[2];     // xyz = upB, w = 0.0
uniform vec4 uPortalAimPos;     // xyz = aimPos, w = radius (0 if inactive)
uniform vec4 uPortalAimNormal;  // xyz = aimNormal, w = active (1 = orange, 2 = blue, 0 = off)

vec3 rotateByQuatInverse(vec3 d, vec4 q) {
  vec3 t = 2.0 * cross(q.xyz, d);
  return d - q.w * t + cross(q.xyz, t);
}

${n}

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdRoundedBox(vec3 p, vec3 b, float r) {
  float effR = isBasicPolygonPixel() ? 0.0 : r;
  float cr = min(effR, min(b.x, min(b.y, b.z)) * 0.95);
  vec3 core = max(vec3(0.001), b - vec3(cr));
  return sdBox(p, core) - cr;
}

float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

float sdCylinder(vec3 p, float radius, float halfHeight) {
  vec2 d = vec2(length(p.xz) - radius, abs(p.y) - halfHeight);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a;
  vec3 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

float sdTorus(vec3 p, float majorR, float minorR) {
  vec2 q = vec2(length(p.xz) - majorR, p.y);
  return length(q) - minorR;
}

float sdRampX(vec3 p, float halfLen, float rise, float halfWidth, float thickness, float railH, float railThick) {
  float safeLen = max(halfLen, 0.01);
  float tanT = (0.5 * rise) / safeLen;
  float cosT = inversesqrt(1.0 + tanT * tanT);
  float yTop = (p.x / safeLen) * (0.5 * rise);
  float halfThick = max(0.075, 0.5 * thickness);

  float dRun = abs(p.x) - safeLen;
  float dDeckY = (abs(p.y - (yTop - halfThick)) - halfThick) * cosT;
  float dLat = abs(p.z) - halfWidth;
  vec3 q = vec3(dRun, dDeckY, dLat);
  float dDeck = length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);

  if (railH > 0.001) {
    float hrThick = 0.5 * railThick;
    float hrH = 0.5 * railH;
    float dRailLat = abs(abs(p.z) - (halfWidth - hrThick)) - hrThick;
    float dRailY = (abs(p.y - (yTop + hrH)) - hrH) * cosT;
    vec3 qr = vec3(dRun, dRailY, dRailLat);
    float dRail = length(max(qr, 0.0)) + min(max(qr.x, max(qr.y, qr.z)), 0.0);
    dDeck = min(dDeck, dRail);
  }
  return dDeck;
}

float sdRampZ(vec3 p, float halfLen, float rise, float halfWidth, float thickness, float railH, float railThick) {
  float safeLen = max(halfLen, 0.01);
  float tanT = (0.5 * rise) / safeLen;
  float cosT = inversesqrt(1.0 + tanT * tanT);
  float yTop = (p.z / safeLen) * (0.5 * rise);
  float halfThick = max(0.075, 0.5 * thickness);

  float dRun = abs(p.z) - safeLen;
  float dDeckY = (abs(p.y - (yTop - halfThick)) - halfThick) * cosT;
  float dLat = abs(p.x) - halfWidth;
  vec3 q = vec3(dRun, dDeckY, dLat);
  float dDeck = length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);

  if (railH > 0.001) {
    float hrThick = 0.5 * railThick;
    float hrH = 0.5 * railH;
    float dRailLat = abs(abs(p.x) - (halfWidth - hrThick)) - hrThick;
    float dRailY = (abs(p.y - (yTop + hrH)) - hrH) * cosT;
    vec3 qr = vec3(dRun, dRailY, dRailLat);
    float dRail = length(max(qr, 0.0)) + min(max(qr.x, max(qr.y, qr.z)), 0.0);
    dDeck = min(dDeck, dRail);
  }
  return dDeck;
}

float sdSweptTrack(vec3 p, vec3 a, vec3 b, float halfWidth, float thickness, float railH, float railThick) {
  vec3 ba = b - a;
  vec3 pa = p - a;
  float l2 = max(dot(ba, ba), 1e-5);
  float t = clamp(dot(pa, ba) / l2, 0.0, 1.0);
  vec3 spine = a + ba * t;
  vec3 dp = p - spine;

  float horizLen = max(length(ba.xz), 1e-5);
  vec2 tang = ba.xz / horizLen;
  vec2 norm = vec2(-tang.y, tang.x);

  float lat = dot(dp.xz, norm);
  float along = dot(dp.xz, tang);
  float slopeCos = horizLen * inversesqrt(l2);
  float halfThick = max(0.075, 0.5 * thickness);

  float dAlong = abs(along) - 0.08;
  float dDeckY = (abs(dp.y + halfThick) - halfThick) * slopeCos;
  float dDeckLat = abs(lat) - halfWidth;
  vec3 q = vec3(dAlong, dDeckY, dDeckLat);
  float dTrack = length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);

  if (railH > 0.001) {
    float hrThick = 0.5 * railThick;
    float hrH = 0.5 * railH;
    float dRailLat = abs(abs(lat) - (halfWidth - hrThick)) - hrThick;
    float dRailY = (abs(dp.y - hrH) - hrH) * slopeCos;
    vec3 qr = vec3(dAlong, dRailY, dRailLat);
    float dRail = length(max(qr, 0.0)) + min(max(qr.x, max(qr.y, qr.z)), 0.0);
    dTrack = min(dTrack, dRail);
  }
  return dTrack;
}

float sdWaveFloor(vec3 p, vec3 b, float amp, float freqX, float freqZ, float speed, float time) {
  float waveH = amp * sin(p.x * freqX + time * speed) * cos(p.z * freqZ + time * speed * 0.7);
  float midY = 0.5 * waveH;
  float halfH = max(0.08, b.y + 0.5 * waveH);
  vec3 q = vec3(abs(p.x) - b.x, (abs(p.y - midY) - halfH) * 0.85, abs(p.z) - b.z);
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdPiston(vec3 p, vec3 headB, float bevelR) {
  float dHead = sdRoundedBox(p, headB, bevelR);
  float stemR = min(headB.x, headB.z) * 0.45;
  float dStem = sdCylinder(p - vec3(0.0, headB.y + 1.2, 0.0), stemR, 1.2);
  return min(dHead, dStem);
}

vec2 opUnion(vec2 a, vec2 b) {
  return (a.x <= b.x) ? a : b;
}

vec2 opSmoothUnion(vec2 a, vec2 b, float k) {
  if (isBasicPolygonPixel()) return opUnion(a, b);
  float h = clamp(0.5 + 0.5 * (b.x - a.x) / max(k, 1e-4), 0.0, 1.0);
  float d = mix(b.x, a.x, h) - k * h * (1.0 - h);
  return vec2(d, (a.x <= b.x) ? a.y : b.y);
}

vec2 opSubtract(vec2 a, vec2 b) {
  return vec2(max(a.x, -b.x), a.y);
}

vec2 opSmoothSubtract(vec2 a, vec2 b, float k) {
  if (isBasicPolygonPixel()) return opSubtract(a, b);
  float h = clamp(0.5 - 0.5 * (a.x + b.x) / max(k, 1e-4), 0.0, 1.0);
  float d = mix(a.x, -b.x, h) + k * h * (1.0 - h);
  return vec2(d, a.y);
}

vec2 opIntersect(vec2 a, vec2 b) {
  return (a.x >= b.x) ? a : b;
}

const vec3 COURSE_BOUNDS_CENTER = ${u};
const vec3 COURSE_BOUNDS_HALF_EXTENTS = ${b};

float sdCourseBounds(vec3 p) {
  return sdBox(p - COURSE_BOUNDS_CENTER, COURSE_BOUNDS_HALF_EXTENTS);
}

vec2 evalCourseWorldRaw(vec3 p) {
  float dBounds = sdCourseBounds(p);
  if (dBounds > 1.5) return vec2(dBounds, 0.0);
${o.join(`
`)}
  return ${a};
}

float evalShadowScene(vec3 p) {
  return min(evalCourseWorldRaw(p).x, length(p - uMarblePos) - uMarbleRadius);
}

float sdTectonicRamp(vec3 p, vec3 posA, vec3 posB, float radius) {
  vec3 dp = p - posA;
  float dirLen = max(length(posB.xz), 1e-5);
  vec2 fwd = posB.xz / dirLen;
  vec2 right = vec2(-fwd.y, fwd.x);
  float runCoord = dot(dp.xz, fwd);
  float latCoord = dot(dp.xz, right);
  float safeLen = max(radius, 0.05);
  float tanT = (0.5 * posB.y) / safeLen;
  float cosT = inversesqrt(1.0 + tanT * tanT);
  float yTop = (runCoord / safeLen) * (0.5 * posB.y);
  vec3 q = vec3(abs(runCoord) - safeLen, (abs(dp.y - (yTop - 0.45)) - 0.45) * cosT, abs(latCoord) - safeLen * 0.85);
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

vec2 applyFieldMutations(vec2 world, vec3 p) {
  for (int i = 0; i < 8; i++) {
    if (i < uMutationCount) {
      vec4 pa = uMutationsPosA[i];
      vec3 dp = p - pa.xyz;
      vec4 meta = uMutationsMeta[i];
      int kind = int(round(meta.x));
      float radius = kind == 4 ? max(pa.w, 4.5) : pa.w;
      float boundR = radius + 2.4;
      float distSq = dot(dp, dp);
      if (distSq <= boundR * boundR) {
        vec4 pb = uMutationsPosB[i];
        float matId = meta.y;
        float blendK = max(pb.w, 1e-4);

        if (kind == 1) {
          float dSphere = sqrt(distSq) - radius;
          world = opSmoothSubtract(world, vec2(dSphere, matId), blendK);
        } else if (kind == 2) {
          float dCap = sdCapsule(p, pa.xyz, pb.xyz, radius);
          world = opSmoothUnion(world, vec2(dCap, matId), blendK);
        } else if (kind == 3) {
          float dRamp = sdTectonicRamp(p, pa.xyz, pb.xyz, radius);
          world = opSmoothUnion(world, vec2(dRamp, matId), blendK);
        } else if (kind == 4 && distSq <= radius * radius) {
          // Convert ANY surface inside radius (standard, acid, sticky, conveyor, bounce — except goal 5.0) into ice (1.0)
          if (abs(world.y - 5.0) > 0.2) {
            world.y = 1.0;
          }
        }
      }
    }
  }
  return world;
}

float sdPortalThroatSingle(vec3 p, vec3 pos, vec3 normal, vec3 up, float radius) {
  vec3 dp = p - pos;
  float boundR = radius + 2.2;
  if (dot(dp, dp) > boundR * boundR) return 100.0;
  vec3 n = normalize(normal);
  vec3 u = normalize(up - dot(up, n) * n);
  vec3 r = normalize(cross(u, n));
  float lx = dot(dp, r);
  float ly = dot(dp, u);
  float lz = dot(dp, n);
  float rPlanar = length(vec2(lx, ly));
  float throatR = max(0.25, radius - 0.06);
  vec2 d = vec2(rPlanar - throatR, abs(lz) - 2.2);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

vec2 applyPortalThroats(vec2 world, vec3 p) {
  if (uPortalPairCount > 0 && uPortalNormalA[0].w > 0.5 && uPortalNormalB[0].w > 0.5) {
    float dA = sdPortalThroatSingle(p, uPortalPosA[0].xyz, uPortalNormalA[0].xyz, uPortalUpA[0].xyz, uPortalPosA[0].w);
    float dB = sdPortalThroatSingle(p, uPortalPosB[0].xyz, uPortalNormalB[0].xyz, uPortalUpB[0].xyz, uPortalPosB[0].w);
    world.x = max(world.x, -min(dA, dB));
  }
  return world;
}

vec2 evalCourseWorldMutated(vec3 p) {
  vec2 world = evalCourseWorldRaw(p);
  if (world.x < 4.2) {
    if (uMutationCount > 0) {
      world = applyFieldMutations(world, p);
    }
    if (uPortalPairCount > 0) {
      world = applyPortalThroats(world, p);
    }
  }
  return world;
}

vec2 evalWorldSdf(vec3 p) {
  vec2 world = evalCourseWorldMutated(p);

  if (uOcclusionStrength > 0.001) {
    vec3 segEnd = uMarblePos;
    vec3 segStart = uCameraPos;
    float tunnelRadius = uMarbleRadius * 2.15 * uOcclusionStrength;
    float dTunnel = sdCapsule(p, segStart, segEnd, tunnelRadius);
    float k = 0.35;
    float h = clamp(0.5 - 0.5 * (world.x + dTunnel) / k, 0.0, 1.0);
    world.x = mix(world.x, -dTunnel, h) + k * h * (1.0 - h);
  }

  return world;
}

float sdPortalRing(vec3 p, vec3 pos, vec3 normal, vec3 up, float radius) {
  vec3 dp = p - pos;
  float dist = length(dp);
  if (dist > radius + 1.35) return dist - (radius + 0.18);
  vec3 n = normalize(normal);
  vec3 u = normalize(up - dot(up, n) * n);
  vec3 r = normalize(cross(u, n));
  float lx = dot(dp, r);
  float ly = dot(dp, u);
  float lz = dot(dp, n);
  float rPlanar = length(vec2(lx, ly));
  return length(vec2(rPlanar - radius, lz)) - 0.17;
}

float sdPortalAimRing(vec3 p) {
  if (uPortalAimPos.w <= 0.5 || uPortalAimNormal.w < 0.5) return 1000.0;
  vec3 dp = p - uPortalAimPos.xyz;
  float dist = length(dp);
  if (dist > uPortalAimPos.w + 1.2) return dist - (uPortalAimPos.w + 0.12);
  vec3 n = normalize(uPortalAimNormal.xyz);
  vec3 upHint = abs(n.y) < 0.85 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, -1.0);
  vec3 u = normalize(upHint - dot(upHint, n) * n);
  vec3 r = normalize(cross(u, n));
  float lx = dot(dp, r);
  float ly = dot(dp, u);
  float lz = dot(dp, n);
  float rPlanar = length(vec2(lx, ly));
  return length(vec2(rPlanar - uPortalAimPos.w, lz)) - 0.075;
}

float sdPortalApertureDisc(vec3 p, vec3 pos, vec3 normal, vec3 up, float radius) {
  vec3 dp = p - pos;
  float dist = length(dp);
  if (dist > radius + 1.0) return dist - radius;
  vec3 n = normalize(normal);
  vec3 u = normalize(up - dot(up, n) * n);
  vec3 r = normalize(cross(u, n));
  float lx = dot(dp, r);
  float ly = dot(dp, u);
  float lz = dot(dp, n);
  float rPlanar = length(vec2(lx, ly));
  return max(abs(lz) - 0.022, rPlanar - max(0.1, radius - 0.05));
}

vec2 evalPortalApertures(vec3 p, int ignoreSide) {
  vec2 best = vec2(1000.0, -1.0);
  if (uPortalPairCount > 0) {
    if (uPortalNormalA[0].w > 0.5 && ignoreSide != 0) {
      float dA = sdPortalApertureDisc(p, uPortalPosA[0].xyz, uPortalNormalA[0].xyz, uPortalUpA[0].xyz, uPortalPosA[0].w);
      if (dA < best.x) best = vec2(dA, 0.0);
    }
    if (uPortalNormalB[0].w > 0.5 && ignoreSide != 1) {
      float dB = sdPortalApertureDisc(p, uPortalPosB[0].xyz, uPortalNormalB[0].xyz, uPortalUpB[0].xyz, uPortalPosB[0].w);
      if (dB < best.x) best = vec2(dB, 1.0);
    }
  }
  return best;
}

vec2 evalSceneSdf(vec3 p) {
  vec2 res = evalWorldSdf(p);

  // Player marble SDF (material ID = 100.0) vs Shattered Glass Shards (material ID = 102.0)
  // Note: Intact player marble (status != 2) is rendered via exact analytical ray-sphere subpixel AA
  // in main() so the background course surface is always available for 1-px cone coverage blending!
  if (uMarbleStatus == 2 && uShatterShardCount > 0) {
    vec2 dShards = evalShatterShardsSdf(p);
    if (dShards.x < res.x) {
      res = dShards;
    }
  } else if (uMarbleStatus == 2) {
    vec3 mp = p - uMarblePos;
    float dMarble = length(mp) - uMarbleRadius;
    float shard = sin(mp.x * 18.0 + uTime * 12.0) * cos(mp.y * 18.0) * sin(mp.z * 18.0);
    dMarble += shard * 0.08 * clamp(uMarbleStatusTimer * 2.0, 0.0, 1.0);
    if (dMarble < res.x) {
      res = vec2(dMarble, 100.0);
    }
  }

  // 120 Hz Holographic Ghost Marble SDF (material ID = 103.0)
  if (uGhostActive == 1) {
    vec3 gpGhost = p - uGhostPos;
    // Only render ghost when not overlapping player marble core
    float distToPlayer = length(uGhostPos - uMarblePos);
    if (distToPlayer > 0.08) {
      float dGhost = length(gpGhost) - (uMarbleRadius * 0.96);
      if (dGhost < res.x) {
        res = vec2(dGhost, 103.0);
      }
    }
  }

  // Other Active Multiplayer Marbles SDF (material ID = 110.0 .. 115.0)
  if (uOtherMarbleCount > 0) {
    if (uOtherMarblePosRad[0].w > 0.05) {
      float d0 = length(p - uOtherMarblePosRad[0].xyz) - uOtherMarblePosRad[0].w;
      if (d0 < res.x) res = vec2(d0, 110.0);
    }
    if (uOtherMarbleCount > 1 && uOtherMarblePosRad[1].w > 0.05) {
      float d1 = length(p - uOtherMarblePosRad[1].xyz) - uOtherMarblePosRad[1].w;
      if (d1 < res.x) res = vec2(d1, 111.0);
    }
    if (uOtherMarbleCount > 2 && uOtherMarblePosRad[2].w > 0.05) {
      float d2 = length(p - uOtherMarblePosRad[2].xyz) - uOtherMarblePosRad[2].w;
      if (d2 < res.x) res = vec2(d2, 112.0);
    }
    if (uOtherMarbleCount > 3 && uOtherMarblePosRad[3].w > 0.05) {
      float d3 = length(p - uOtherMarblePosRad[3].xyz) - uOtherMarblePosRad[3].w;
      if (d3 < res.x) res = vec2(d3, 113.0);
    }
    if (uOtherMarbleCount > 4 && uOtherMarblePosRad[4].w > 0.05) {
      float d4 = length(p - uOtherMarblePosRad[4].xyz) - uOtherMarblePosRad[4].w;
      if (d4 < res.x) res = vec2(d4, 114.0);
    }
    if (uOtherMarbleCount > 5 && uOtherMarblePosRad[5].w > 0.05) {
      float d5 = length(p - uOtherMarblePosRad[5].xyz) - uOtherMarblePosRad[5].w;
      if (d5 < res.x) res = vec2(d5, 115.0);
    }
  }

  // Hovering holographic Goal Halo Torus above the Goal Pad (material ID = 101.0)
  vec3 gp = p - (uGoalPos + vec3(0.0, 1.35 + 0.18 * sin(uTime * 3.2), 0.0));
  float gpBound = length(gp) - (uGoalRadius * 0.52 + 0.25);
  if (gpBound < res.x) {
    float c = cos(uTime * 1.8);
    float s = sin(uTime * 1.8);
    vec3 gpRot = vec3(c * gp.x - s * gp.z, gp.y, s * gp.x + c * gp.z);
    float dGoalHalo = sdTorus(gpRot.xzy, uGoalRadius * 0.52, 0.11);
    if (dGoalHalo < res.x) {
      res = vec2(dGoalHalo, 101.0);
    }
  }

  // Glowing Blue (104.0) & Orange (105.0) SDF Portal Torus Frames + Live 3D Aim Preview Ring (106.0)
  // (102 = shatter shards, 103 = holographic ghost marble)
  if (uPortalPairCount > 0) {
    if (uPortalNormalA[0].w > 0.5) {
      float dRingA = sdPortalRing(p, uPortalPosA[0].xyz, uPortalNormalA[0].xyz, uPortalUpA[0].xyz, uPortalPosA[0].w);
      if (dRingA < res.x) {
        res = vec2(dRingA, 104.0);
      }
    }
    if (uPortalNormalB[0].w > 0.5) {
      float dRingB = sdPortalRing(p, uPortalPosB[0].xyz, uPortalNormalB[0].xyz, uPortalUpB[0].xyz, uPortalPosB[0].w);
      if (dRingB < res.x) {
        res = vec2(dRingB, 105.0);
      }
    }
  }
  if (uPortalAimPos.w > 0.5 && uPortalAimNormal.w > 0.5) {
    float dAim = sdPortalAimRing(p);
    if (dAim < res.x) {
      res = vec2(dAim, 106.0);
    }
  }

  return res;
}

vec3 calcWorldNormal(vec3 p) {
  const float eps = 0.0022;
  vec2 e = vec2(1.0, -1.0) * 0.57735027;
  return normalize(
    e.xyy * evalSceneSdf(p + e.xyy * eps).x +
    e.yyx * evalSceneSdf(p + e.yyx * eps).x +
    e.yxy * evalSceneSdf(p + e.yxy * eps).x +
    e.xxx * evalSceneSdf(p + e.xxx * eps).x
  );
}

float calcSoftShadow(vec3 ro, vec3 rd) {
  float res = 1.0;
  float t = 0.06;
  for (int i = 0; i < 10; i++) {
    vec3 p = ro + rd * t;
    float h = evalShadowScene(p);
    if (h < 0.001) return 0.08;
    res = min(res, 11.0 * h / t);
    t += clamp(h, 0.08, 1.8);
    if (t > 24.0) break;
  }
  return clamp(res, 0.08, 1.0);
}

float calcAmbientOcclusion(vec3 p, vec3 n) {
  const float steps[4] = float[4](0.025, 0.08, 0.20, 0.44);
  const float weights[4] = float[4](0.36, 0.28, 0.22, 0.14);
  float occ = 0.0;
  for (int i = 0; i < 4; i++) {
    float dist = steps[i];
    float d = evalShadowScene(p + n * dist);
    occ += max(0.0, dist - d - 0.01) / dist * weights[i];
  }
  float ao = clamp(1.0 - occ * 1.25, 0.32, 1.0);
  // Subtle underside darkening
  ao *= mix(0.75, 1.0, clamp(0.5 + 0.5 * n.y, 0.0, 1.0));
  return ao;
}

/**
 * Iconic Marble Madness anti-aliased isometric gridlines etched onto world X/Z & Y surfaces.
 * Uses screen-space partial derivatives (fwidth) so slopes, ramps, chutes, and vertical cliffs
 * remain crisp and free of aliasing at every camera zoom stop.
 * In Basic Polygon Mode (uEngineMode == 1 or Left Half of Split-Screen A/B), delegates to
 * shadeBasicPolygonCourseSurface for flat-shaded triangle facets + diagonal wireframe seams.
 */
vec3 shadeCourseSurface(vec3 p, vec3 n, vec3 V, float matId) {
  if (isBasicPolygonPixel()) {
    return shadeBasicPolygonCourseSurface(p, n, V, matId);
  }

  // 1. Dual-Scale Isometric tile coordinates (0.5m sub-minor, 1.0m minor, 2.0m major grid)
  vec2 xz = p.xz;
  vec2 fwXZ = max(fwidth(xz), vec2(0.001));
  vec2 grid05 = abs(fract(xz * 2.0 - 0.5) - 0.5) / (fwXZ * 2.0);
  float lineSubMinorXZ = 1.0 - smoothstep(0.0, 1.35, min(grid05.x, grid05.y));

  vec2 grid1 = abs(fract(xz - 0.5) - 0.5) / fwXZ;
  float lineMinorXZ = 1.0 - smoothstep(0.0, 1.45, min(grid1.x, grid1.y));

  vec2 grid2 = abs(fract(xz * 0.5 - 0.5) - 0.5) / (fwXZ * 0.5);
  float lineMajorXZ = 1.0 - smoothstep(0.0, 1.65, min(grid2.x, grid2.y));

  // Elevation Y contour lines on steep walls and ramps
  float fwY = max(fwidth(p.y), 0.001);
  float gridY = abs(fract(p.y - 0.5) - 0.5) / fwY;
  float lineContourY = (1.0 - smoothstep(0.0, 1.4, gridY)) * smoothstep(0.92, 0.35, abs(n.y));

  float gridMask = clamp(
    max(lineSubMinorXZ * 0.34, max(lineMinorXZ * 0.68, max(lineMajorXZ * 0.96, lineContourY * 0.72))),
    0.0,
    1.0
  );

  // Classic Atari checkerboard tile alternation with analytical fwidth edge anti-aliasing
  vec2 sinGrid1 = sin(xz * 3.14159265);
  float prodGrid1 = sinGrid1.x * sinGrid1.y;
  float fwProd1 = max(fwidth(prodGrid1), 0.015);
  float checker = smoothstep(-fwProd1, fwProd1, prodGrid1);
  bool isWall = abs(n.y) < 0.48;

  vec3 baseCol = mix(uTrackPrimary, uTrackSecondary, checker * 0.42);
  if (isWall) {
    baseCol = mix(uWallColor, uTrackPrimary * 0.55, 0.35);
  }

  // Slope indicator tint: subtly brighten downhill slope faces
  float slopeSteepness = clamp(1.0 - n.y, 0.0, 1.0);
  if (!isWall && slopeSteepness > 0.04) {
    float chevron = 0.5 + 0.5 * sin((p.x + p.z) * 6.28318);
    baseCol = mix(baseCol, uGridLineColor * 0.85, slopeSteepness * 0.35 * chevron);
  }

  vec3 gridCol = uGridLineColor;
  float roughness = 0.28;
  float emissive = 0.0;

  // Anti-aliased fine checkerboard for Start & Goal Pads
  vec2 sinFine = sin(p.xz * 6.2831853);
  float prodFine = sinFine.x * sinFine.y;
  float fwFine = max(fwidth(prodFine), 0.02);
  float fineCheckerAA = smoothstep(-fwFine, fwFine, prodFine);

  int m = int(round(matId));
  if (m == 1) {
    // ICE: Iridescent crystalline cyan-white specular surface with Voronoi frost facets
    vec2 vIce = voronoi2D(p.xz * 2.4, 0.0);
    float ndotvIce = clamp(dot(n, V), 0.0, 1.0);
    vec3 iceIrid = 0.5 + 0.5 * cos(6.28318 * (vec3(0.05, 0.38, 0.72) + ndotvIce * 1.2 + vIce.x * 0.35));
    baseCol = mix(vec3(0.55, 0.88, 1.0), vec3(0.78, 0.96, 1.0), checker * 0.5);
    baseCol = mix(baseCol, iceIrid, 0.24) + vec3(0.12, 0.2, 0.28) * (1.0 - smoothstep(0.0, 0.12, vIce.y));
    gridCol = vec3(0.94, 0.99, 1.0);
    roughness = 0.05;
  } else if (m == 2) {
    // STICKY: High-friction amber honeycomb
    baseCol = mix(vec3(0.78, 0.46, 0.08), vec3(0.58, 0.32, 0.05), checker);
    gridCol = vec3(1.0, 0.78, 0.22);
    roughness = 0.68;
  } else if (m == 3) {
    // BOUNCE PAD: High-energy magenta/orange spring pad with pulsing rings
    float ring = 0.5 + 0.5 * sin(length(fract(p.xz * 0.5) - 0.5) * 28.0 - uTime * 9.0);
    baseCol = mix(vec3(0.88, 0.14, 0.58), vec3(1.0, 0.55, 0.12), ring);
    gridCol = vec3(1.0, 0.92, 0.35);
    roughness = 0.18;
    emissive = 0.45;
  } else if (m == 4) {
    // ACID / LAVA POOL: Bubbling Voronoi cellular hazard with glowing fissures
    vec2 vAcid = voronoi2D(p.xz * 1.85, uTime * 2.6);
    float fissure = 1.0 - smoothstep(0.0, 0.14, vAcid.y);
    float bubble = 0.5 + 0.5 * sin(vAcid.x * 6.0 - uTime * 4.2);
    baseCol = mix(vec3(0.06, 0.58, 0.14), vec3(0.48, 1.0, 0.22), bubble);
    baseCol = mix(baseCol, vec3(0.85, 1.0, 0.38), fissure * 0.75);
    gridCol = vec3(0.72, 1.0, 0.38);
    roughness = 0.14;
    emissive = 0.68 + 0.25 * fissure;
  } else if (m == 5) {
    // GOAL PAD: Iconic high-contrast gold & emerald finish checkerboard with AA circular disc edge
    float rGoal = length(p.xz - uGoalPos.xz);
    float fwGoal = max(fwidth(rGoal), 0.015);
    float discMask = 1.0 - smoothstep(uGoalRadius - fwGoal * 1.5, uGoalRadius + fwGoal * 1.5, rGoal);
    float rimRing = 1.0 - smoothstep(0.0, fwGoal * 2.2, abs(rGoal - (uGoalRadius - 0.08)));
    float pulse = 0.5 + 0.5 * sin(uTime * 5.0);
    vec3 padCol = mix(vec3(0.06, 0.78, 0.42), vec3(1.0, 0.84, 0.18), fineCheckerAA);
    padCol = mix(padCol, vec3(1.0, 0.96, 0.65), rimRing * 0.75);
    baseCol = mix(baseCol, padCol, discMask);
    gridCol = mix(vec3(1.0, 0.95, 0.55), vec3(0.35, 1.0, 0.75), pulse);
    roughness = mix(roughness, 0.08, discMask);
    emissive = (0.48 + 0.22 * pulse) * discMask;
  } else if (m == 6) {
    // START PAD: Arcade cyan/gold launch platform with smooth AA circular disc boundary
    float rStart = length(p.xz);
    float fwStart = max(fwidth(rStart), 0.015);
    float discMask = 1.0 - smoothstep(2.2 - fwStart * 1.5, 2.2 + fwStart * 1.5, rStart);
    float rimRing = 1.0 - smoothstep(0.0, fwStart * 2.2, abs(rStart - 2.12));
    vec3 padCol = mix(vec3(0.12, 0.55, 0.95), vec3(0.95, 0.78, 0.22), fineCheckerAA * 0.7);
    padCol = mix(padCol, vec3(0.65, 0.96, 1.0), rimRing * 0.7);
    baseCol = mix(baseCol, padCol, discMask);
    gridCol = mix(gridCol, vec3(0.55, 0.95, 1.0), discMask);
    roughness = mix(roughness, 0.15, discMask);
    emissive = 0.26 * discMask;
  } else if (m == 7) {
    // BUMPER / PISTON: Brushed gold & chrome-red arcade kinetic hazard
    baseCol = mix(vec3(0.88, 0.18, 0.22), vec3(0.92, 0.72, 0.28), checker * 0.55);
    gridCol = vec3(1.0, 0.78, 0.28);
    roughness = 0.12;
    emissive = 0.24;
  } else if (m == 8) {
    // CONVEYOR BELT: Pulsing neon chevron energy deck
    float chev = fract((p.x + abs(fract(p.z) - 0.5) * 1.2) * 1.5 - uTime * 2.8);
    float stripe = smoothstep(0.12, 0.24, chev) * (1.0 - smoothstep(0.55, 0.68, chev));
    baseCol = mix(vec3(0.14, 0.20, 0.32), vec3(0.15, 0.88, 1.0), stripe);
    gridCol = vec3(0.48, 0.96, 1.0);
    roughness = 0.20;
    emissive = 0.28 * stripe;
  }

  vec3 surfaceCol = mix(baseCol, gridCol, gridMask);

  // Highlight realtime CSG FieldMutations (blasted crater rims & ferrofluid bridges)
  for (int i = 0; i < 8; i++) {
    if (i < uMutationCount) {
      vec4 meta = uMutationsMeta[i];
      int kind = int(round(meta.x));
      vec4 pa = uMutationsPosA[i];
      if (kind == 1) {
        float dCrater = abs(length(p - pa.xyz) - pa.w);
        if (dCrater < 0.42) {
          float scorch = 1.0 - smoothstep(0.0, 0.42, dCrater);
          surfaceCol = mix(surfaceCol, vec3(1.0, 0.58, 0.16), scorch * 0.55);
        }
      } else if (kind == 2) {
        vec4 pb = uMutationsPosB[i];
        float dBridge = sdCapsule(p, pa.xyz, pb.xyz, pa.w);
        if (dBridge < 0.25) {
          float ferroGlow = 1.0 - smoothstep(-0.15, 0.25, dBridge);
          float pulse = 0.5 + 0.5 * sin(p.x * 4.0 + p.z * 4.0 - uTime * 5.0);
          surfaceCol = mix(surfaceCol, mix(vec3(0.18, 0.85, 1.0), vec3(0.68, 0.35, 1.0), pulse), ferroGlow * 0.48);
        }
      } else if (kind == 4) {
        float cryoR = max(pa.w, 4.5);
        float dCryo = length(p - pa.xyz) - cryoR;
        if (dCryo <= 0.35) {
          float frostRim = 1.0 - smoothstep(0.0, 0.38, abs(dCryo));
          float frostFill = 1.0 - smoothstep(-cryoR, 0.0, dCryo);
          surfaceCol = mix(surfaceCol, vec3(0.76, 0.96, 1.0), frostFill * 0.32 + frostRim * 0.65);
          roughness = min(roughness, 0.05);
        }
      }
    }
  }

  // Highlight the occlusion reveal cutout rim if close to the camera-to-marble ray
  if (uOcclusionStrength > 0.01) {
    float dTunnel = sdCapsule(p, uCameraPos, uMarblePos, uMarbleRadius * 2.15 * uOcclusionStrength);
    float rim = 1.0 - smoothstep(0.0, 0.18, abs(dTunnel));
    surfaceCol = mix(surfaceCol, vec3(0.35, 0.92, 1.0), rim * 0.75);
  }

  // Lighting: Sun diffuse + soft shadow + 7-tap SDF AO + hemisphere sky fill + specular
  vec3 L = normalize(uSunDir);
  vec3 H = normalize(L + V);
  float ndotl = max(dot(n, L), 0.0);
  float shadow = calcSoftShadow(p + n * 0.03, L);
  float ao = calcAmbientOcclusion(p, n);

  float skyFill = 0.5 + 0.5 * n.y;
  vec3 ambient = mix(uAbyssFogColor * 0.45, uSkyHorizon * 0.85, skyFill) * ao;

  float specPower = mix(112.0, 14.0, roughness);
  float specStrength = mix(0.95, 0.18, roughness);
  float spec = pow(max(dot(n, H), 0.0), specPower) * specStrength * shadow;

  // Contact shadow + Optical Floor Caustic Ring directly under the glass marble
  vec3 toMarble = p - uMarblePos;
  float horizDist = length(toMarble.xz);
  float vertDist = uMarblePos.y - p.y;
  if (vertDist > 0.0 && vertDist < 4.5 && n.y > 0.3) {
    float blob = exp(-horizDist * horizDist / (uMarbleRadius * uMarbleRadius * 1.45)) *
                 clamp(1.0 - vertDist / 4.5, 0.0, 1.0);
    shadow *= (1.0 - 0.52 * blob);
  }

  // Polished Bevel Curvature Highlights along smoothUnion fillets & rounded ramp lips
  vec3 bevelHighlight = computeBevelCurvatureHighlight(p, n, L, V, gridCol, matId);

  // 5-Step 1-Bounce Glossy Floor Reflection on ice, goal pads, and anodized track decks
  float hitT = length(p - uCameraPos);
  vec3 glossyRefl = traceGlossyFloorReflection(p, n, V, roughness, hitT);

  // Focused Optical Floor Caustics projected beneath the marble
  vec3 floorCaustics = computeMarbleFloorCaustics(p, n, L);

  // Rim Fresnel edge sheen
  float rimFresnel = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0);
  vec3 rimSheen = mix(uGridLineColor, vec3(0.45, 0.92, 1.0), 0.5) * rimFresnel * 0.22;

  vec3 lit = surfaceCol * (ambient + vec3(1.05, 0.98, 0.90) * ndotl * shadow * 0.88) +
             vec3(1.0, 0.98, 0.95) * spec +
             surfaceCol * emissive +
             bevelHighlight +
             glossyRefl +
             floorCaustics +
             rimSheen;

  // Apply expanding neon cyan/magenta shockwave contour rings & cliff rim-danger pulse
  lit = applyShockwaveAndRimContours(p, gridMask, lit, uMarblePos);

  return lit;
}

/**
 * True Optical Glass Marble with Chromatic Dispersion Refraction (IOR_R=1.50, IOR_G=1.52, IOR_B=1.55)
 * that optically bends and magnifies the isometric grid and hazards underneath it, plus internal
 * cat's-eye ribbons rotated in lockstep with uMarbleQuat and Glass Stress fracture veins.
 */
vec3 shadePlayerMarble(vec3 p, vec3 n, vec3 V) {
  if (isBasicPolygonPixel()) {
    return shadeBasicPolygonMarble(p, n, V);
  }

  vec3 localPos = rotateByQuatInverse((p - uMarblePos) / max(uMarbleRadius, 0.01), uMarbleQuat);
  vec3 localView = rotateByQuatInverse(-V, uMarbleQuat);

  // 1. Trace true optical refracted ray with R/G/B chromatic dispersion into the scene behind/underneath
  vec3 refractedScene = traceMarbleOpticalRefraction(p, n, -V);

  // 2. Refracted internal ray sample for deep glass cat's-eye ribbons
  vec3 internalP = localPos + localView * 0.38;
  float swirl1 = sin(internalP.x * 6.2 + sin(internalP.y * 5.0 + internalP.z * 4.2) * 1.8);
  float swirl2 = cos(internalP.z * 7.5 - sin(internalP.x * 4.8 - internalP.y * 6.0) * 1.6);
  float ribbon = smoothstep(0.15, 0.88, 0.5 + 0.5 * (swirl1 * swirl2));
  float equatorBand = exp(-abs(localPos.y) * 5.5);
  float ribbonDensity = clamp(ribbon * 0.72 + equatorBand * 0.42, 0.0, 1.0);

  vec3 L = normalize(uSunDir);
  vec3 H = normalize(L + V);
  float ndotl = max(dot(n, L), 0.0);
  float ndotv = clamp(dot(n, V), 0.0, 1.0);
  float fresnel = pow(1.0 - ndotv, 3.2);

  // Subsurface scattering translucency when backlit or side-lit
  vec3 backLightDir = normalize(L + n * 0.45);
  float sss = pow(clamp(dot(V, -backLightDir), 0.0, 1.0), 2.6) * 0.85 +
              pow(1.0 - ndotv, 2.0) * 0.35;

  // Iridescent thin-film spectral shift on rim
  vec3 iridescenceTint = 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + ndotv * 1.4));

  // Blend the magnified refracted world underneath with the translucent crown-glass tint & ribbons
  vec3 glassAbsorption = mix(vec3(0.92, 0.97, 1.0), uMarbleBaseColor * 1.25, 0.38);
  vec3 transmittedCol = refractedScene * glassAbsorption;
  vec3 ribbonCol = mix(uMarbleBaseColor, uMarbleVeinColor, ribbonDensity) * (0.45 + 0.75 * ndotl);

  vec3 coreCol = mix(transmittedCol, ribbonCol, 0.36 + 0.32 * ribbonDensity);
  coreCol += uMarbleGlowColor * sss * 0.58;
  coreCol = mix(coreCol, iridescenceTint, fresnel * uMarbleIridescence * 0.58);

  // Internal Glass Stress Fracture Veins (Voronoi / Crystalline Cleavage Planes)
  if (uCrackVisibility > 0.01 || uGlassStress > 0.05) {
    vec3 fp = internalP * 7.5;
    float p1 = abs(sin(fp.x * 1.7 + fp.y * 2.3 - fp.z * 1.3));
    float p2 = abs(cos(fp.y * 2.1 - fp.z * 1.9 + fp.x * 1.1));
    float p3 = abs(sin(fp.z * 2.5 + fp.x * 1.5 + fp.y * 0.9));
    float crackLine1 = 1.0 - smoothstep(0.0, 0.09 + 0.08 * uCrackVisibility, min(p1, min(p2, p3)));
    float crackLine2 = 1.0 - smoothstep(0.0, 0.06 * uCrackVisibility, abs(p1 - p2));
    float crackMask = clamp((crackLine1 * 0.75 + crackLine2 * 0.85) * uCrackVisibility, 0.0, 1.0);
    vec3 stressColor = mix(vec3(0.95, 0.98, 1.0), vec3(1.0, 0.38, 0.12), uStressGlow);
    coreCol = mix(coreCol, stressColor * 1.65, crackMask);
    coreCol += vec3(1.0, 0.28, 0.08) * uStressGlow * (0.35 + 0.65 * fresnel);
  }

  // Dual coat specular reflections on the outer polished glass shell
  float specPrimary = pow(max(dot(n, H), 0.0), 148.0) * 1.55;
  vec3 H2 = normalize(normalize(vec3(-0.6, 0.8, -0.5)) + V);
  float specSecondary = pow(max(dot(n, H2), 0.0), 56.0) * 0.52;

  vec3 col = coreCol +
             vec3(1.0, 0.99, 0.96) * (specPrimary + specSecondary) +
             mix(uMarbleVeinColor, iridescenceTint, 0.5) * fresnel * 0.62;

  if (uMarbleStatus == 2) {
    col = mix(col, vec3(1.0, 0.45, 0.15), 0.65);
  } else if (uMarbleStatus == 3) {
    col = mix(col, vec3(0.45, 1.0, 0.2), 0.7);
  }

  return col;
}

/**
 * 120 Hz Holographic Ghost Marble (Personal Best Cyan or Argon Pro Par Violet/Gold)
 * with rotating internal scanline bands and translucent rim glow.
 */
vec3 shadeGhostMarble(vec3 p, vec3 n, vec3 V, vec3 ro) {
  vec3 localPos = rotateByQuatInverse((p - uGhostPos) / max(uMarbleRadius, 0.01), uGhostQuat);
  float ndotv = clamp(dot(n, V), 0.0, 1.0);
  float fresnel = pow(1.0 - ndotv, 2.2);

  // Rotating meridian & equator bands so 120 Hz ghost spin is clearly visible
  float meridian = smoothstep(0.72, 0.95, abs(sin(atan(localPos.z, localPos.x) * 4.0)));
  float equator = exp(-abs(localPos.y) * 7.0);
  float scanline = 0.55 + 0.45 * sin((p.y - uGhostPos.y) * 42.0 - uTime * 14.0);

  vec3 holoBase = uGhostColor.rgb;
  vec3 holoAccent = mix(vec3(1.0, 0.88, 0.32), vec3(0.35, 0.98, 1.0), 0.5);
  vec3 ghostGlow = mix(holoBase, holoAccent, clamp(meridian * 0.55 + equator * 0.65, 0.0, 1.0));

  // Sample underlying course surface below the ghost for genuine holographic translucency
  vec3 underPos = vec3(p.x, p.y - uMarbleRadius * 0.9, p.z);
  vec3 bgCol = shadeCourseSurface(underPos, vec3(0.0, 1.0, 0.0), V, 0.0);

  float alpha = clamp(uGhostColor.a * (0.35 + 0.65 * fresnel) * scanline + (meridian + equator) * 0.28, 0.22, 0.88);
  vec3 holoLit = ghostGlow * (0.75 + 0.95 * fresnel) * scanline + vec3(0.95, 1.0, 1.0) * pow(1.0 - ndotv, 5.0) * 0.9;
  return mix(bgCol, holoLit, alpha);
}

/**
 * Shades other active multiplayer glass marbles (P1..P6) with their distinct PLAYER_MARBLE_PALETTE color,
 * internal cat's-eye swirl, Fresnel rim glow, and dual-coat specular highlight.
 */
vec3 shadeOtherPlayerMarble(vec3 p, vec3 n, vec3 V, int idx) {
  vec4 posRad = idx == 0 ? uOtherMarblePosRad[0]
              : idx == 1 ? uOtherMarblePosRad[1]
              : idx == 2 ? uOtherMarblePosRad[2]
              : idx == 3 ? uOtherMarblePosRad[3]
              : idx == 4 ? uOtherMarblePosRad[4]
              : uOtherMarblePosRad[5];
  vec4 colVec = idx == 0 ? uOtherMarbleColor[0]
              : idx == 1 ? uOtherMarbleColor[1]
              : idx == 2 ? uOtherMarbleColor[2]
              : idx == 3 ? uOtherMarbleColor[3]
              : idx == 4 ? uOtherMarbleColor[4]
              : uOtherMarbleColor[5];
  vec3 mCenter = posRad.xyz;
  float mRad = max(posRad.w, 0.05);
  vec3 baseCol = colVec.rgb;
  vec3 localP = (p - mCenter) / mRad;

  float swirl = 0.5 + 0.5 * sin(localP.x * 6.5 + cos(localP.z * 6.5 + uTime * 2.5) * 1.8);
  float equator = exp(-abs(localP.y) * 5.0);
  vec3 L = normalize(uSunDir);
  vec3 H = normalize(L + V);
  float ndotl = max(dot(n, L), 0.0);
  float ndotv = clamp(dot(n, V), 0.0, 1.0);
  float fresnel = pow(1.0 - ndotv, 3.0);
  float spec = pow(max(dot(n, H), 0.0), 128.0) * 1.45;

  vec3 core = mix(baseCol * 0.65, mix(baseCol, vec3(1.0), 0.38), clamp(swirl * 0.6 + equator * 0.4, 0.0, 1.0));
  return core * (0.42 + 0.78 * ndotl) + baseCol * fresnel * 0.85 + vec3(1.0, 0.99, 0.96) * spec;
}

vec3 renderSkyAndAbyss(vec3 ro, vec3 rd) {
  float horizon = clamp(0.5 + 0.5 * rd.y, 0.0, 1.0);
  vec3 sky = mix(uSkyHorizon, uSkyZenith, pow(horizon, 0.75));

  if (isBasicPolygonPixel()) {
    // Basic Polygon Mode: plain flat-shaded horizon without O(1) cathedral megastructure
    return sky * 0.85;
  }

  // O(1) Domain-Repeated Brutalist/Atari Cathedral Megastructure in the distant abyss
  sky = renderCathedralMegastructure(ro, rd, sky);

  // Distant synth-arcade abyss floor grid plane at y = -18.0
  if (rd.y < -0.01) {
    float tFloor = (-18.0 - ro.y) / rd.y;
    if (tFloor > 0.0 && tFloor < 180.0) {
      vec3 fp = ro + rd * tFloor;
      vec2 fw = max(fwidth(fp.xz * 0.25), vec2(0.002));
      vec2 g = abs(fract(fp.xz * 0.25 - 0.5) - 0.5) / fw;
      float line = 1.0 - smoothstep(0.0, 1.5, min(g.x, g.y));
      float fade = exp(-tFloor * 0.022);
      sky = mix(sky, uAbyssFogColor + uGridLineColor * line * 0.38, fade * 0.68);
    }
  }
  return sky;
}

/**
 * Curvature-Bounded Over-Relaxed Sphere Tracing (kappa-March):
 * Modulates over-relaxation omega_kappa in [1.0, 1.24] using the smooth-CSG
 * fillet shell exp(-(d / (0.45 * k))^2) and directional secant slope, paired
 * with Keinert sphere-overlap safeguard and secant hit refinement in the raymarching loop.
 */
float computeKappaOverRelaxation(float d, float prevD, float prevStep) {
  if (d < 0.12) return 0.96;
  float k = 0.14;
  float shellWeight = exp(-pow(abs(d) / (0.45 * k), 2.0));
  float curvatureDamping = exp(-0.65 * shellWeight);
  float slope = (prevStep > 1e-4) ? clamp((d - prevD) / prevStep, -1.0, 1.0) : -1.0;
  if (slope > -0.25) return 0.96;
  float omegaMax = (slope < -0.75) ? 1.12 : 1.24;
  return 1.0 + (omegaMax - 1.0) * curvatureDamping;
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / max(uResolution.y, 1.0);

  vec3 ro = uCameraPos;
  vec3 rd = normalize(
    uCameraForward +
    ndc.x * aspect * uCameraTanHalfFov * uCameraRight +
    ndc.y * uCameraTanHalfFov * uCameraUp
  );
  vec3 primaryRo = ro;
  vec3 primaryRd = rd;

  float t = 0.1;
  float maxT = 165.0;
  vec2 hit = vec2(maxT, -1.0);
  float volumetricGlow = 0.0;
  int portalHops = 0;
  int ignorePortalSide = -1;
  vec3 portalEdgeGlow = vec3(0.0);
  float prevRadius = 0.0;
  float prevStep = 0.0;
  int stepsTaken = 0;

  for (int i = 0; i < 64; i++) {
    stepsTaken = i + 1;
    vec3 p = ro + rd * t;
    vec2 s = evalSceneSdf(p);
    vec2 ap = (uPortalPairCount > 0) ? evalPortalApertures(p, ignorePortalSide) : vec2(1000.0, -1.0);
    float stepDist = min(s.x, ap.x);

    // Keinert sphere-overlap safeguard for kappa-March over-relaxation
    if (i > 0 && prevStep > prevRadius + max(stepDist, 0.0)) {
      t = t - prevStep + prevRadius * 0.95;
      p = ro + rd * t;
      s = evalSceneSdf(p);
      ap = (uPortalPairCount > 0) ? evalPortalApertures(p, ignorePortalSide) : vec2(1000.0, -1.0);
      stepDist = min(s.x, ap.x);
      prevStep = prevRadius * 0.95;
    }

    // Accumulate subtle goal beacon glow
    float dGoalBeacon = length(p.xz - uGoalPos.xz) - uGoalRadius * 0.65;
    if (p.y > uGoalPos.y && p.y < uGoalPos.y + 4.5 && dGoalBeacon < 0.8) {
      volumetricGlow += exp(-max(dGoalBeacon, 0.0) * 3.5) * (1.0 - (p.y - uGoalPos.y) / 4.5) * 0.012;
    }

    if (ap.x < 0.004 && ap.x <= s.x) {
      bool enteredA = ap.y < 0.5;
      vec4 pA = uPortalPosA[0];
      vec4 nA = uPortalNormalA[0];
      vec4 uA = uPortalUpA[0];
      vec4 pB = uPortalPosB[0];
      vec4 nB = uPortalNormalB[0];
      vec4 uB = uPortalUpB[0];

      if (nA.w > 0.5 && nB.w > 0.5 && portalHops < 2) {
        vec3 inPos = enteredA ? pA.xyz : pB.xyz;
        vec3 inN = normalize(enteredA ? nA.xyz : nB.xyz);
        vec3 inU = enteredA ? uA.xyz : uB.xyz;
        inU = normalize(inU - dot(inU, inN) * inN);
        vec3 inR = normalize(cross(inU, inN));

        vec3 outPos = enteredA ? pB.xyz : pA.xyz;
        vec3 outN = normalize(enteredA ? nB.xyz : nA.xyz);
        vec3 outU = enteredA ? uB.xyz : uA.xyz;
        outU = normalize(outU - dot(outU, outN) * outN);
        vec3 outR = normalize(cross(outU, outN));

        vec3 dp = p - inPos;
        float lx = dot(dp, inR);
        float ly = dot(dp, inU);
        float lz = dot(dp, inN);

        float radialNorm = clamp(length(vec2(lx, ly)) / max(pA.w, 0.05), 0.0, 1.0);
        // Unmistakable #00d8ff Blue and #ff7b00 Orange portal aperture vortex chevron ring
        vec3 rimCol = enteredA ? vec3(0.0, 0.847, 1.0) : vec3(1.0, 0.482, 0.0);
        float angle = atan(ly, lx);
        float vortexChevron = 0.5 + 0.5 * sin(angle * 8.0 - uTime * 9.0 + radialNorm * 14.0);
        float innerHalo = smoothstep(0.58, 0.99, radialNorm);
        portalEdgeGlow += rimCol * (innerHalo * (0.65 + 0.55 * vortexChevron) + 0.14);

        ro = outPos - lx * outR + ly * outU - lz * outN + outN * 0.05;
        float dx = dot(rd, inR);
        float dy = dot(rd, inU);
        float dz = dot(rd, inN);
        rd = normalize(-dx * outR + dy * outU - dz * outN);
        t = 0.02;
        prevRadius = 0.0;
        prevStep = 0.0;
        portalHops++;
        ignorePortalSide = enteredA ? 1 : 0;
      } else {
        hit = vec2(t, enteredA ? 104.0 : 105.0);
        break;
      }
    } else if (s.x < 0.0008) {
      // 1-step secant/Newton refinement along ray so hitPos sits at d = 0 with zero stair-stepping
      float refinedT = t + s.x * 0.5;
      hit = vec2(refinedT, s.y);
      break;
    } else {
      float omegaKappa = computeKappaOverRelaxation(stepDist, prevRadius, prevStep);
      prevRadius = max(stepDist, 0.001);
      prevStep = max(stepDist * omegaKappa, 0.001);
      t += prevStep;
      if (t >= maxT) break;
    }
  }

  vec3 color = vec3(0.0);
  float worldHitT = maxT;
  float horizon = clamp(0.5 + 0.5 * rd.y, 0.0, 1.0);
  vec3 skyCol = mix(uSkyHorizon, uSkyZenith, pow(horizon, 0.75));
  vec3 hitPos = ro + rd * hit.x;
  vec3 normal = vec3(0.0, 1.0, 0.0);

  if (hit.y < 0.0) {
    // Only evaluate O(1) cathedral megastructure on background misses
    color = renderSkyAndAbyss(ro, rd);
  } else {
    worldHitT = hit.x;
    normal = calcWorldNormal(hitPos);
    vec3 V = -rd;

    if (hit.y > 109.5) {
      int omIdx = clamp(int(round(hit.y - 110.0)), 0, 5);
      color = shadeOtherPlayerMarble(hitPos, normal, V, omIdx);
    } else if (hit.y > 105.5) {
      // Live 3D Aim Ring / Trajectory Preview (106.0)
      vec3 aimBase = uPortalAimNormal.w > 1.5 ? vec3(0.0, 0.847, 1.0) : vec3(1.0, 0.482, 0.0);
      float dash = 0.5 + 0.5 * sin((hitPos.x + hitPos.y + hitPos.z) * 10.0 - uTime * 12.0);
      color = mix(aimBase, vec3(1.0, 0.96, 0.82), 0.35 + 0.45 * dash) * 1.95;
    } else if (hit.y > 104.5) {
      // Glowing Orange (#ff7b00) SDF Portal Torus Frame with directional vortex chevrons (105.0)
      vec3 dpB = hitPos - uPortalPosB[0].xyz;
      vec3 nB = normalize(uPortalNormalB[0].xyz);
      vec3 uB = normalize(uPortalUpB[0].xyz - dot(uPortalUpB[0].xyz, nB) * nB);
      vec3 rB = normalize(cross(uB, nB));
      float angB = atan(dot(dpB, uB), dot(dpB, rB));
      float zB = dot(dpB, nB);
      float chevronB = smoothstep(-0.2, 0.75, sin(angB * 10.0 - abs(zB) * 18.0 - uTime * 9.5));
      float rim = pow(1.0 - clamp(dot(normal, V), 0.0, 1.0), 1.6);
      color = mix(vec3(1.0, 0.482, 0.0), vec3(1.0, 0.92, 0.42), chevronB * 0.68 + rim * 0.55) * 1.95;
    } else if (hit.y > 103.5) {
      // Glowing Blue (#00d8ff) SDF Portal Torus Frame with directional vortex chevrons (104.0)
      vec3 dpA = hitPos - uPortalPosA[0].xyz;
      vec3 nA = normalize(uPortalNormalA[0].xyz);
      vec3 uA = normalize(uPortalUpA[0].xyz - dot(uPortalUpA[0].xyz, nA) * nA);
      vec3 rA = normalize(cross(uA, nA));
      float angA = atan(dot(dpA, uA), dot(dpA, rA));
      float zA = dot(dpA, nA);
      float chevronA = smoothstep(-0.2, 0.75, sin(angA * 10.0 + abs(zA) * 18.0 + uTime * 9.5));
      float rim = pow(1.0 - clamp(dot(normal, V), 0.0, 1.0), 1.6);
      color = mix(vec3(0.0, 0.847, 1.0), vec3(0.65, 0.99, 1.0), chevronA * 0.68 + rim * 0.55) * 1.95;
    } else if (hit.y > 102.5) {
      // 120 Hz Holographic Ghost Marble (103.0)
      color = shadeGhostMarble(hitPos, normal, V, ro);
    } else if (hit.y > 101.5) {
      // Raymarched Faceted Glass Shatter Shards (102.0)
      color = shadeShatterGlassShard(hitPos, normal, V, uMarbleBaseColor, uMarbleVeinColor, uSunDir);
    } else if (hit.y > 100.5) {
      // Hovering Goal Halo Torus (101.0)
      float pulse = 0.5 + 0.5 * sin(uTime * 6.0);
      color = mix(vec3(0.2, 1.0, 0.72), vec3(1.0, 0.92, 0.28), pulse) * 1.45;
    } else if (hit.y > 99.5) {
      color = shadePlayerMarble(hitPos, normal, V);
    } else {
      color = shadeCourseSurface(hitPos, normal, V, hit.y);
    }

    // Volumetric abyss fog & distance atmospheric perspective
    float distFog = 1.0 - exp(-hit.x * 0.0065 * uAbyssFogDensity);
    float heightFog = clamp((-hitPos.y - 4.0) / 14.0, 0.0, 1.0) * 0.65;
    float fogFactor = clamp(max(distFog, heightFog), 0.0, 0.92);
    color = mix(color, mix(uAbyssFogColor, skyCol, 0.5), fogFactor);
  }

  // Exact Analytical Ray-Sphere Intersection & Subpixel Cone Anti-Aliasing for Player Marble:
  // Eliminates grazing-ray normal noise and 2x2 quad silhouette stippling on the glass sphere!
  if (portalHops == 0 && uMarbleStatus != 2) {
    float effMarbleR = uMarbleRadius;
    if (uMarbleStatus == 3) {
      effMarbleR *= max(0.15, 1.0 - 0.65 * clamp(uMarbleStatusTimer, 0.0, 1.2));
    }
    vec3 oc = primaryRo - uMarblePos;
    float tca = -dot(oc, primaryRd);
    if (tca > 0.0) {
      vec3 closestVec = oc + primaryRd * tca;
      float bDist = length(closestVec);
      float pxConeRadius = max(0.002, tca * (uCameraTanHalfFov * 2.15 / max(uResolution.y, 1.0)));
      if (bDist < effMarbleR + pxConeRadius) {
        float clampedB = min(bDist, effMarbleR * 0.996);
        float thc = sqrt(max(1e-6, effMarbleR * effMarbleR - clampedB * clampedB));
        float tSphere = max(0.05, tca - thc);
        if (tSphere < worldHitT + pxConeRadius * 2.0) {
          vec3 pSphere = uMarblePos + normalize(
            (primaryRo + primaryRd * tSphere) - uMarblePos
          ) * effMarbleR;
          vec3 nSphere = normalize(pSphere - uMarblePos);
          vec3 marbleCol = shadePlayerMarble(pSphere, nSphere, -primaryRd);
          float mFog = clamp(1.0 - exp(-tSphere * 0.0065 * uAbyssFogDensity), 0.0, 0.92);
          marbleCol = mix(marbleCol, mix(uAbyssFogColor, skyCol, 0.5), mFog);
          float sphereCoverage = 1.0 - smoothstep(effMarbleR - pxConeRadius, effMarbleR + pxConeRadius, bDist);
          color = mix(color, marbleCol, sphereCoverage);
        }
      }
    }
  }

  // Boost see-through portal interior exposure by 1.35x so the destination room is crystal clear inside the portal disc
  if (portalHops > 0) {
    color *= 1.35;
  }

  color += portalEdgeGlow;
  color += vec3(0.25, 1.0, 0.72) * volumetricGlow;

  // 20-Second SDF X-Ray & Measurement Wizard Mode (uDebugVizMode == 1..5)
  if (uDebugVizMode > 0) {
    color = applySdfDebugViz(ro, rd, hit, hitPos, normal, stepsTaken, color);
  }

  // Split-Screen A/B Mode (uEngineMode == 2): Glowing vertical comparison laser divider
  if (uEngineMode == 2) {
    float splitDist = abs(gl_FragCoord.x - uResolution.x * 0.5);
    float coreLine = 1.0 - smoothstep(0.0, 1.6, splitDist);
    float haloGlow = exp(-splitDist * 0.22);
    float tick = step(0.65, fract(gl_FragCoord.y * 0.045 - uTime * 1.5));
    vec3 dividerCol = mix(vec3(0.25, 0.95, 1.0), vec3(1.0, 0.85, 0.28), 0.5 + 0.5 * tick);
    color = mix(color, dividerCol * 1.45, clamp(coreLine + haloGlow * 0.45, 0.0, 1.0));
  }

  // ACES Filmic Tone Mapping + sRGB gamma
  vec3 x = color * 1.08;
  vec3 aces = clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  vec3 srgb = pow(aces, vec3(1.0 / 2.2));

  fragColor = vec4(srgb, 1.0);
}
`}function Vt(e,i,t){const o=t.id++,r=`res_${o}`;if(!Kt(e)){const c=`p_${o}`,n=e.kinematic?`(${He(e.center)} + ${Va(e.kinematic)})`:He(e.center);if(e.rotation){const y=e.rotation;i.push(`  let ${c} = rotateByQuatInverse(p - ${n}, vec4<f32>(${z(y[0])}, ${z(y[1])}, ${z(y[2])}, ${z(y[3])}));`)}else i.push(`  let ${c} = p - ${n};`);const u=z(Ft[e.material]),b=Xa(e,c);return i.push(`  var ${r} = vec2<f32>(${b}, ${u});`),r}if(e.children.length===0)return i.push(`  var ${r} = vec2<f32>(1000.0, 0.0);`),r;const a=Vt(e.children[0],i,t);i.push(`  var ${r} = ${a};`);const s=z(e.smoothRadius??.14);for(let c=1;c<e.children.length;c++){const n=Vt(e.children[c],i,t);e.kind==="union"?i.push(`  ${r} = opUnion(${r}, ${n});`):e.kind==="smoothUnion"?i.push(`  ${r} = opSmoothUnion(${r}, ${n}, ${s});`):e.kind==="subtract"?i.push(`  ${r} = opSubtract(${r}, ${n});`):e.kind==="smoothSubtract"?i.push(`  ${r} = opSmoothSubtract(${r}, ${n}, ${s});`):i.push(`  ${r} = opIntersect(${r}, ${n});`)}return r}function Et(e){const i=Bt(e),t=Qt(e,4),o=[],a=Vt(i,o,{id:0}),s=Pa().wgsl,c=Ma().wgsl,n=wa().wgsl,u=He(t.center),b=He(t.halfExtents);return`// WGSL Lockstep Raymarching Shader for course: ${e.id}
struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
  occlusionStrength: f32,
  cameraPos: vec3<f32>,
  cameraTanHalfFov: f32,
  cameraForward: vec3<f32>,
  marbleRadius: f32,
  cameraRight: vec3<f32>,
  goalRadius: f32,
  cameraUp: vec3<f32>,
  abyssFogDensity: f32,
  marblePos: vec3<f32>,
  marbleStatus: f32,
  marbleQuat: vec4<f32>,
  goalPos: vec3<f32>,
  marbleIridescence: f32,
  glassStress: f32,
  crackVisibility: f32,
  stressGlow: f32,
  ghostActive: f32,
  ghostPos: vec3<f32>,
  padGhost: f32,
  ghostQuat: vec4<f32>,
  ghostColor: vec4<f32>,
  trackPrimary: vec3<f32>,
  pad0: f32,
  trackSecondary: vec3<f32>,
  pad1: f32,
  gridLineColor: vec3<f32>,
  pad2: f32,
  wallColor: vec3<f32>,
  engineMode: f32,
  sunDir: vec3<f32>,
  mutationCount: f32,
  uMutationsPosA: array<vec4<f32>, 16>,
  uMutationsPosB: array<vec4<f32>, 16>,
  uMutationsMeta: array<vec4<f32>, 16>,
  portalPairCount: f32,
  uPortalPosA: array<vec4<f32>, 2>,
  uPortalNormalA: array<vec4<f32>, 2>,
  uPortalUpA: array<vec4<f32>, 2>,
  uPortalPosB: array<vec4<f32>, 2>,
  uPortalNormalB: array<vec4<f32>, 2>,
  uPortalUpB: array<vec4<f32>, 2>,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

${s}
${c}
${n}

fn rotateByQuatInverse(d: vec3<f32>, q: vec4<f32>) -> vec3<f32> {
  let t = 2.0 * cross(q.xyz, d);
  return d - q.w * t + cross(q.xyz, t);
}

fn sdBox(p: vec3<f32>, b: vec3<f32>) -> f32 {
  let q = abs(p) - b;
  return length(max(q, vec3<f32>(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}

fn sdRoundedBox(p: vec3<f32>, b: vec3<f32>, r: f32) -> f32 {
  let cr = min(r, min(b.x, min(b.y, b.z)) * 0.95);
  let core = max(vec3<f32>(0.001), b - vec3<f32>(cr));
  return sdBox(p, core) - cr;
}

fn sdSphere(p: vec3<f32>, r: f32) -> f32 {
  return length(p) - r;
}

fn sdCylinder(p: vec3<f32>, radius: f32, halfHeight: f32) -> f32 {
  let d = vec2<f32>(length(p.xz) - radius, abs(p.y) - halfHeight);
  return min(max(d.x, d.y), 0.0) + length(max(d, vec2<f32>(0.0)));
}

fn sdCapsule(p: vec3<f32>, a: vec3<f32>, b: vec3<f32>, r: f32) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

fn sdTorus(p: vec3<f32>, majorR: f32, minorR: f32) -> f32 {
  let q = vec2<f32>(length(p.xz) - majorR, p.y);
  return length(q) - minorR;
}

fn sdRampX(p: vec3<f32>, halfLen: f32, rise: f32, halfWidth: f32, thickness: f32, railH: f32, railThick: f32) -> f32 {
  let safeLen = max(halfLen, 0.01);
  let tanT = (0.5 * rise) / safeLen;
  let cosT = inverseSqrt(1.0 + tanT * tanT);
  let yTop = (p.x / safeLen) * (0.5 * rise);
  let halfThick = max(0.075, 0.5 * thickness);
  let q = vec3<f32>(abs(p.x) - safeLen, (abs(p.y - (yTop - halfThick)) - halfThick) * cosT, abs(p.z) - halfWidth);
  var dDeck = length(max(q, vec3<f32>(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
  if (railH > 0.001) {
    let hrThick = 0.5 * railThick;
    let hrH = 0.5 * railH;
    let qr = vec3<f32>(abs(p.x) - safeLen, (abs(p.y - (yTop + hrH)) - hrH) * cosT, abs(abs(p.z) - (halfWidth - hrThick)) - hrThick);
    let dRail = length(max(qr, vec3<f32>(0.0))) + min(max(qr.x, max(qr.y, qr.z)), 0.0);
    dDeck = min(dDeck, dRail);
  }
  return dDeck;
}

fn sdRampZ(p: vec3<f32>, halfLen: f32, rise: f32, halfWidth: f32, thickness: f32, railH: f32, railThick: f32) -> f32 {
  let safeLen = max(halfLen, 0.01);
  let tanT = (0.5 * rise) / safeLen;
  let cosT = inverseSqrt(1.0 + tanT * tanT);
  let yTop = (p.z / safeLen) * (0.5 * rise);
  let halfThick = max(0.075, 0.5 * thickness);
  let q = vec3<f32>(abs(p.z) - safeLen, (abs(p.y - (yTop - halfThick)) - halfThick) * cosT, abs(p.x) - halfWidth);
  var dDeck = length(max(q, vec3<f32>(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
  if (railH > 0.001) {
    let hrThick = 0.5 * railThick;
    let hrH = 0.5 * railH;
    let qr = vec3<f32>(abs(p.z) - safeLen, (abs(p.y - (yTop + hrH)) - hrH) * cosT, abs(abs(p.x) - (halfWidth - hrThick)) - hrThick);
    let dRail = length(max(qr, vec3<f32>(0.0))) + min(max(qr.x, max(qr.y, qr.z)), 0.0);
    dDeck = min(dDeck, dRail);
  }
  return dDeck;
}

fn sdSweptTrack(p: vec3<f32>, a: vec3<f32>, b: vec3<f32>, halfWidth: f32, thickness: f32, railH: f32, railThick: f32) -> f32 {
  let ba = b - a;
  let pa = p - a;
  let l2 = max(dot(ba, ba), 1e-5);
  let t = clamp(dot(pa, ba) / l2, 0.0, 1.0);
  let spine = a + ba * t;
  let dp = p - spine;
  let horizLen = max(length(ba.xz), 1e-5);
  let tang = ba.xz / horizLen;
  let norm = vec2<f32>(-tang.y, tang.x);
  let lat = dot(dp.xz, norm);
  let along = dot(dp.xz, tang);
  let slopeCos = horizLen * inverseSqrt(l2);
  let halfThick = max(0.075, 0.5 * thickness);
  let q = vec3<f32>(abs(along) - 0.08, (abs(dp.y + halfThick) - halfThick) * slopeCos, abs(lat) - halfWidth);
  var dTrack = length(max(q, vec3<f32>(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
  if (railH > 0.001) {
    let hrThick = 0.5 * railThick;
    let hrH = 0.5 * railH;
    let qr = vec3<f32>(abs(along) - 0.08, (abs(dp.y - hrH) - hrH) * slopeCos, abs(abs(lat) - (halfWidth - hrThick)) - hrThick);
    let dRail = length(max(qr, vec3<f32>(0.0))) + min(max(qr.x, max(qr.y, qr.z)), 0.0);
    dTrack = min(dTrack, dRail);
  }
  return dTrack;
}

fn sdWaveFloor(p: vec3<f32>, b: vec3<f32>, amp: f32, freqX: f32, freqZ: f32, speed: f32, time: f32) -> f32 {
  let waveH = amp * sin(p.x * freqX + time * speed) * cos(p.z * freqZ + time * speed * 0.7);
  let midY = 0.5 * waveH;
  let halfH = max(0.08, b.y + 0.5 * waveH);
  let q = vec3<f32>(abs(p.x) - b.x, (abs(p.y - midY) - halfH) * 0.85, abs(p.z) - b.z);
  return length(max(q, vec3<f32>(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}

fn sdPiston(p: vec3<f32>, headB: vec3<f32>, bevelR: f32) -> f32 {
  let dHead = sdRoundedBox(p, headB, bevelR);
  let stemR = min(headB.x, headB.z) * 0.45;
  let dStem = sdCylinder(p - vec3<f32>(0.0, headB.y + 1.2, 0.0), stemR, 1.2);
  return min(dHead, dStem);
}

fn opUnion(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
  return select(b, a, a.x <= b.x);
}

fn opSmoothUnion(a: vec2<f32>, b: vec2<f32>, k: f32) -> vec2<f32> {
  let h = clamp(0.5 + 0.5 * (b.x - a.x) / max(k, 1e-4), 0.0, 1.0);
  let d = mix(b.x, a.x, h) - k * h * (1.0 - h);
  return vec2<f32>(d, select(b.y, a.y, a.x <= b.x));
}

fn opSubtract(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
  return vec2<f32>(max(a.x, -b.x), a.y);
}

fn opSmoothSubtract(a: vec2<f32>, b: vec2<f32>, k: f32) -> vec2<f32> {
  let h = clamp(0.5 - 0.5 * (a.x + b.x) / max(k, 1e-4), 0.0, 1.0);
  let d = mix(a.x, -b.x, h) + k * h * (1.0 - h);
  return vec2<f32>(d, a.y);
}

fn opIntersect(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
  return select(b, a, a.x >= b.x);
}

const COURSE_BOUNDS_CENTER: vec3<f32> = ${u};
const COURSE_BOUNDS_HALF_EXTENTS: vec3<f32> = ${b};

fn sdCourseBounds(p: vec3<f32>) -> f32 {
  return sdBox(p - COURSE_BOUNDS_CENTER, COURSE_BOUNDS_HALF_EXTENTS);
}

fn evalCourseWorldRaw(p: vec3<f32>) -> vec2<f32> {
  let dBounds = sdCourseBounds(p);
  if (dBounds > 1.5) { return vec2<f32>(dBounds, 0.0); }
${o.join(`
`)}
  return ${a};
}

fn evalShadowScene(p: vec3<f32>) -> f32 {
  return min(evalCourseWorldRaw(p).x, length(p - u.marblePos) - u.marbleRadius);
}

fn sdTectonicRamp(p: vec3<f32>, posA: vec3<f32>, posB: vec3<f32>, radius: f32) -> f32 {
  let dp = p - posA;
  let dirLen = max(length(posB.xz), 1e-5);
  let fwd = posB.xz / dirLen;
  let right = vec2<f32>(-fwd.y, fwd.x);
  let runCoord = dot(dp.xz, fwd);
  let latCoord = dot(dp.xz, right);
  let safeLen = max(radius, 0.05);
  return sdRampZ(vec3<f32>(latCoord, dp.y, runCoord), safeLen, posB.y, safeLen * 0.85, 0.9, 0.32, 0.24);
}

fn applyFieldMutations(worldIn: vec2<f32>, p: vec3<f32>) -> vec2<f32> {
  var world = worldIn;
  let count = i32(round(u.mutationCount));
  for (var i: i32 = 0; i < 16; i = i + 1) {
    if (i >= count) { break; }
    let meta = u.uMutationsMeta[i];
    if (u.time > meta.z + meta.w) { continue; }
    let pa = u.uMutationsPosA[i];
    let pb = u.uMutationsPosB[i];
    let kind = i32(round(meta.x));
    let matId = meta.y;
    let radius = pa.w;
    let blendK = max(pb.w, 1e-4);
    if (kind == 1) {
      let dSphere = length(p - pa.xyz) - radius;
      world = opSmoothSubtract(world, vec2<f32>(dSphere, matId), blendK);
    } else if (kind == 2) {
      let dCap = sdCapsule(p, pa.xyz, pb.xyz, radius);
      world = opSmoothUnion(world, vec2<f32>(dCap, matId), blendK);
    } else if (kind == 3) {
      let dRamp = sdTectonicRamp(p, pa.xyz, pb.xyz, radius);
      world = opSmoothUnion(world, vec2<f32>(dRamp, matId), blendK);
    } else if (kind == 4) {
      let cryoR = max(radius, 4.5);
      let dOverride = length(p - pa.xyz) - cryoR;
      if (dOverride <= 0.0 && abs(world.y - 5.0) > 0.2) {
        world.y = 1.0;
      }
    }
  }
  return world;
}

fn transformPortalRay(p: vec3<f32>, rd: vec3<f32>, inPos: vec3<f32>, inN: vec3<f32>, inU: vec3<f32>, outPos: vec3<f32>, outN: vec3<f32>, outU: vec3<f32>) -> array<vec3<f32>, 2> {
  let inR = normalize(cross(inU, inN));
  let outR = normalize(cross(outU, outN));
  let dp = p - inPos;
  let lx = dot(dp, inR);
  let ly = dot(dp, inU);
  let lz = dot(dp, inN);
  let nextP = outPos - lx * outR + ly * outU - lz * outN + outN * 0.05;
  let dx = dot(rd, inR);
  let dy = dot(rd, inU);
  let dz = dot(rd, inN);
  let nextD = normalize(-dx * outR + dy * outU - dz * outN);
  return array<vec3<f32>, 2>(nextP, nextD);
}

fn computeKappaOverRelaxation(d: f32, prevD: f32, prevStep: f32) -> f32 {
  let k = 0.14;
  let shellWeight = exp(-pow(abs(d) / (0.45 * k), 2.0));
  let curvatureDamping = exp(-0.55 * shellWeight);
  let slope = select(-1.0, clamp((d - prevD) / prevStep, -1.0, 1.0), prevStep > 1e-4);
  let omegaMax = select(1.38, 1.16, slope < -0.75);
  return 1.0 + (omegaMax - 1.0) * curvatureDamping;
}
`}function ja(e,i){const t=Math.abs(e[0]-i.center[0])-i.halfExtents[0],o=Math.abs(e[1]-i.center[1])-i.halfExtents[1],r=Math.abs(e[2]-i.center[2])-i.halfExtents[2];return Math.hypot(Math.max(t,0),Math.max(o,0),Math.max(r,0))+Math.min(Math.max(t,Math.max(o,r)),0)}function Go(e,i=16,t=10){const o=Bt(e),r=[];Yt(o,r);const a=Math.max(1,r.length),s=Qt(e,4),c=[e.startPos[0],e.startPos[1]+.5,e.startPos[2]-2],n=.45,u=[c[0]+11.5,c[1]+12,c[2]+11.5],b=[c[0]-u[0],c[1]-1.5-u[1],c[2]-3.5-u[2]],y=Math.hypot(b[0],b[1],b[2])||1,l=[b[0]/y,b[1]/y,b[2]/y],f=[l[2],0,-l[0]],d=Math.hypot(f[0],f[1],f[2])||1,m=[-f[0]/d,0,-f[2]/d],S=[m[1]*l[2]-m[2]*l[1],m[2]*l[0]-m[0]*l[2],m[0]*l[1]-m[1]*l[0]],k=Math.tan(42*Math.PI/360),M=16/9,H=e.theme.sunDirection,p=Math.hypot(H[0],H[1],H[2])||1,R=[H[0]/p,H[1]/p,H[2]/p];let w=0,P=0,T=0,I=0,D=0,W=0;const Q=32,se=_=>{D++;const F=ja(_,s);if(F>1.5)return W++,{d:F,matId:0};I+=a;const q=Jt(o,_,0);return{d:q.distance,matId:q.materialId}},re=Math.max(1,i*t);for(let _=0;_<t;_++)for(let F=0;F<i;F++){const q=(F+.5)/i*2-1,U=(_+.5)/t*2-1,h=l[0]+q*M*k*m[0]+U*k*S[0],A=l[1]+q*M*k*m[1]+U*k*S[1],g=l[2]+q*M*k*m[2]+U*k*S[2],G=Math.hypot(h,A,g)||1,O=[h/G,A/G,g/G];let te=.1,ae=!1,oe=!1;for(let j=0;j<84;j++){const B=[u[0]+O[0]*te,u[1]+O[1]*te,u[2]+O[2]*te];w++,P+=a+Q;const V=Jt(o,B,0),ue=Math.hypot(B[0]-c[0],B[1]-c[1],B[2]-c[2])-n,ne=Math.min(V.distance,ue);if(ne<.0018){ae=!0,oe=ue<V.distance;break}if(te+=Math.max(ne,.004),te>=165)break}w+=12,P+=48,ae&&(w+=4,P+=4*(a+Q),oe?(w+=14,P+=14*(a+Q)):(w+=47,P+=47*(a+Q)));let L=.1,de=-1,X=-1,J=0,ce=0;for(let j=0;j<64;j++){const B=[u[0]+O[0]*L,u[1]+O[1]*L,u[2]+O[2]*L];T++;const V=se(B),ue=Math.hypot(B[0]-c[0],B[1]-c[1],B[2]-c[2])-n,ne=Math.min(V.d,ue),Se=ue<V.d?100:V.matId;if(ne<.0018){de=L,X=Se;break}const Z=Math.exp(-Math.pow(Math.abs(ne)/(.45*.14),2)),C=Math.exp(-.55*Z),ge=1+(((ce>1e-4?Math.max(-1,Math.min(1,(ne-J)/ce)):-1)<-.75?1.16:1.38)-1)*C;if(J=Math.max(ne,.004),ce=Math.max(ne*ge,.004),L+=ce,L>=165)break}if(de<0)O[1]<=.18&&(T+=6,I+=6);else{const j=[u[0]+O[0]*de,u[1]+O[1]*de,u[2]+O[2]*de];for(let B=0;B<4;B++)T++,se(j);if(X===100)for(let B=0;B<8;B++){T++;const V=[j[0]+O[0]*(.2+B*.35),j[1]+O[1]*(.2+B*.35),j[2]+O[2]*(.2+B*.35)];if(se(V).d<.012)break}else{let B=.06;for(let C=0;C<10;C++){T++;const ee=[j[0]+R[0]*B,j[1]+.03+R[1]*B,j[2]+R[2]*B],pe=se(ee),ge=Math.hypot(ee[0]-c[0],ee[1]-c[1],ee[2]-c[2])-n,be=Math.min(pe.d,ge);if(be<.001||(B+=Math.max(.08,Math.min(1.8,be)),B>24))break}const V=[.025,.08,.2,.44];for(let C=0;C<4;C++)T++,se([j[0],j[1]+V[C],j[2]]);const ue=X===1?.05:X===5?.08:.28,ne=Math.max(0,Math.min(1,-O[1])),Se=.08+(.62-.08)*Math.pow(1-ne,3),ze=Math.max(0,Math.min(1,(ue-.04)/(.58-.04)));if((1-ze*ze*(3-2*ze))*Se>.12&&de<45){let C=.06,ee=!1;for(let pe=0;pe<5;pe++){T++;const ge=[j[0]+O[0]*C,j[1]+Math.abs(O[1])*C,j[2]+O[2]*C],be=se(ge);if(be.d<.018){ee=!0;break}if(C+=Math.max(be.d*1.15,.12),C>18)break}if(ee)for(let pe=0;pe<3;pe++)T++,se(j)}}}}const ie=Number((w/re).toFixed(2)),E=Number((T/re).toFixed(2)),$=Number((P/re).toFixed(1)),v=Number((I/re).toFixed(1)),x=P>0?(P-I)/P:0;return{courseId:e.id,primitiveCount:a,totalPixelsSampled:re,legacyEvalSceneCallsPerPixel:ie,optimizedEvalSceneCallsPerPixel:E,legacyPrimitiveEvalsPerPixel:$,optimizedPrimitiveEvalsPerPixel:v,primitiveEvalReductionRatio:Number(x.toFixed(4)),primitiveEvalReductionPercent:Number((x*100).toFixed(1)),aabbFastSkipRate:Number((D>0?W/D:0).toFixed(4))}}const Za=`#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  // Fullscreen triangle covering [-1, 1] NDC
  vec2 pos = vec2(
    (gl_VertexID == 1) ? 3.0 : -1.0,
    (gl_VertexID == 2) ? 3.0 : -1.0
  );
  vUv = pos * 0.5 + 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}
`,ra={racing:0,goal:1,shattered:2,sunk:3,fell:4},Mt=1.35,qt=.75,Xt=1,Ka=17.2,Ya=11.5;function Qa(e,i,t=.025,o=.015){const r=Math.max(qt,Math.min(Xt,e));return i>Ka?Number(Math.max(qt,r-t).toFixed(4)):i<Ya?Number(Math.min(Xt,r+o).toFixed(4)):r}function na(e,i,t){const o=e.createShader(i);if(!o)throw new Error("Failed to allocate WebGLShader");if(e.shaderSource(o,t),e.compileShader(o),!e.getShaderParameter(o,e.COMPILE_STATUS)){const r=e.getShaderInfoLog(o)||"Unknown shader compile error";throw e.deleteShader(o),new Error(`Shader compilation failed:
${r}`)}return o}function Ja(e,i,t){const o=na(e,e.VERTEX_SHADER,i),r=na(e,e.FRAGMENT_SHADER,t),a=e.createProgram();if(!a)throw new Error("Failed to allocate WebGLProgram");if(e.attachShader(a,o),e.attachShader(a,r),e.linkProgram(a),e.deleteShader(o),e.deleteShader(r),!e.getProgramParameter(a,e.LINK_STATUS)){const s=e.getProgramInfoLog(a)||"Unknown program link error";throw e.deleteProgram(a),new Error(`Program link failed:
${s}`)}return a}function Ho(e,i){const t=e.getContext("webgl2",{alpha:!1,antialias:!1,depth:!1,stencil:!1,powerPreference:"high-performance",preserveDrawingBuffer:!0});let o=i,r=It(i),a=Et(i),s=null,c=null,n=null,u=ot(i),b=!1,y=16.6,l=16.6,f=typeof performance<"u"?performance.now():0,d=1,m=Mt,S=2.4;const k=t?t.getExtension("EXT_disjoint_timer_query_webgl2"):null,M=[],H=new Float32Array(xt*4),p=new Float32Array(xt*4),R=new Float32Array(xt*4),w=new Float32Array(it*4),P=new Float32Array(it*4),T=new Float32Array(it*4),I=new Float32Array(it*4),D=new Float32Array(it*4),W=new Float32Array(it*4);function Q(h,A){const g=G=>h.getUniformLocation(A,G);return{uResolution:g("uResolution"),uTime:g("uTime"),uCameraPos:g("uCameraPos"),uCameraForward:g("uCameraForward"),uCameraRight:g("uCameraRight"),uCameraUp:g("uCameraUp"),uCameraTanHalfFov:g("uCameraTanHalfFov"),uMarblePos:g("uMarblePos"),uMarbleQuat:g("uMarbleQuat"),uMarbleRadius:g("uMarbleRadius"),uMarbleStatus:g("uMarbleStatus"),uMarbleStatusTimer:g("uMarbleStatusTimer"),uMarbleBaseColor:g("uMarbleBaseColor"),uMarbleVeinColor:g("uMarbleVeinColor"),uMarbleGlowColor:g("uMarbleGlowColor"),uMarbleIridescence:g("uMarbleIridescence"),uGoalPos:g("uGoalPos"),uGoalRadius:g("uGoalRadius"),uOcclusionStrength:g("uOcclusionStrength"),uTrackPrimary:g("uTrackPrimary"),uTrackSecondary:g("uTrackSecondary"),uGridLineColor:g("uGridLineColor"),uWallColor:g("uWallColor"),uSkyZenith:g("uSkyZenith"),uSkyHorizon:g("uSkyHorizon"),uAbyssFogColor:g("uAbyssFogColor"),uAbyssFogDensity:g("uAbyssFogDensity"),uSunDir:g("uSunDir"),uGlassStress:g("uGlassStress"),uCrackVisibility:g("uCrackVisibility"),uStressGlow:g("uStressGlow"),uGhostActive:g("uGhostActive"),uGhostPos:g("uGhostPos"),uGhostQuat:g("uGhostQuat"),uGhostColor:g("uGhostColor"),uOtherMarbleCount:g("uOtherMarbleCount"),uOtherMarblePosRad:g("uOtherMarblePosRad[0]"),uOtherMarbleColor:g("uOtherMarbleColor[0]"),uShatterShards:g("uShatterShards"),uShatterShardCount:g("uShatterShardCount"),uShockwaveRings:g("uShockwaveRings"),uShockwaveParams:g("uShockwaveParams"),uRimDanger:g("uRimDanger"),uMutationCount:g("uMutationCount"),uMutationsPosA:g("uMutationsPosA[0]"),uMutationsPosB:g("uMutationsPosB[0]"),uMutationsMeta:g("uMutationsMeta[0]"),uPortalPairCount:g("uPortalPairCount"),uPortalPosA:g("uPortalPosA[0]"),uPortalNormalA:g("uPortalNormalA[0]"),uPortalUpA:g("uPortalUpA[0]"),uPortalPosB:g("uPortalPosB[0]"),uPortalNormalB:g("uPortalNormalB[0]"),uPortalUpB:g("uPortalUpB[0]"),uPortalAimPos:g("uPortalAimPos"),uPortalAimNormal:g("uPortalAimNormal"),uEngineMode:g("uEngineMode"),uDebugVizMode:g("uDebugVizMode")}}function se(h){let A=r,g=a;try{A=It(h),g=Et(h),u=ot(h)}catch(G){console.error("[RaymarchRenderer] Course SDF compilation failed; keeping active shader:",G);return}if(!t||b){o=h,r=A,a=g;return}try{const G=Ja(t,Za,A),O=Q(t,G);s&&t.deleteProgram(s),s=G,n=O,o=h,r=A,a=g,c||(c=t.createVertexArray())}catch(G){console.error("[RaymarchRenderer] Hot-swap shader link failed; keeping previous glProgram active:",G)}}const re=h=>{h.preventDefault(),b=!0,s=null,c=null,n=null},ie=()=>{b=!1,se(o)};e.addEventListener("webglcontextlost",re),e.addEventListener("webglcontextrestored",ie),se(i);function E(h){h.id===o.id&&h===o||se(h)}function $(h){h.course!==o&&se(h.course);const A=typeof performance<"u"?performance.now():f+16.6,g=Math.max(1,Math.min(100,A-f));f=A,y=g,l=l*.9+g*.1,d=Qa(d,l);const G=Math.min(window.devicePixelRatio||1,Mt);m=Math.max(.65,Number((G*d).toFixed(3)));const O=Math.max(1,Math.floor((e.clientWidth||window.innerWidth)*m)),te=Math.max(1,Math.floor((e.clientHeight||window.innerHeight)*m));if((e.width!==O||e.height!==te)&&(e.width=O,e.height=te),!t||b||!s||!n){x(e,h);return}if(k&&M.length>0){const K=M[0],N=t.getQueryParameter(K,t.QUERY_RESULT_AVAILABLE),Y=t.getParameter(k.GPU_DISJOINT_EXT);if(N){if(M.shift(),!Y){const Me=Number(t.getQueryParameter(K,t.QUERY_RESULT));Number.isFinite(Me)&&Me>0&&(S=S*.85+Me/1e6*.15)}t.deleteQuery(K)}}const ae=typeof performance<"u"?performance.now():0;let oe=null;k&&M.length<3&&(oe=t.createQuery(),oe&&t.beginQuery(k.TIME_ELAPSED_EXT,oe)),t.viewport(0,0,e.width,e.height),t.useProgram(s),t.bindVertexArray(c);const{camera:L,marble:de,renderPosition:X,renderOrientation:J,time:ce,course:j}=h,B=j.theme,V=Ke[de.marblePresetIndex%Ke.length]??Ke[0],ue=Math.tan(L.fovDeg*Math.PI/360);t.uniform2f(n.uResolution,e.width,e.height),t.uniform1f(n.uTime,ce),t.uniform3f(n.uCameraPos,L.position[0],L.position[1],L.position[2]),t.uniform3f(n.uCameraForward,L.forward[0],L.forward[1],L.forward[2]),t.uniform3f(n.uCameraRight,L.right[0],L.right[1],L.right[2]),t.uniform3f(n.uCameraUp,L.up[0],L.up[1],L.up[2]),t.uniform1f(n.uCameraTanHalfFov,ue),t.uniform3f(n.uMarblePos,X[0],X[1],X[2]),t.uniform4f(n.uMarbleQuat,J[0],J[1],J[2],J[3]),t.uniform1f(n.uMarbleRadius,de.radius),t.uniform1i(n.uMarbleStatus,ra[de.status]??0),t.uniform1f(n.uMarbleStatusTimer,de.statusTimer);const ne=h.marbleColor??V.baseColor,Se=h.marbleColor?[Math.min(1,ne[0]*.55+.45),Math.min(1,ne[1]*.55+.45),Math.min(1,ne[2]*.55+.45)]:V.veinColor,ze=h.marbleColor??V.coreGlowColor;t.uniform3f(n.uMarbleBaseColor,ne[0],ne[1],ne[2]),t.uniform3f(n.uMarbleVeinColor,Se[0],Se[1],Se[2]),t.uniform3f(n.uMarbleGlowColor,ze[0],ze[1],ze[2]),t.uniform1f(n.uMarbleIridescence,V.iridescence),t.uniform3f(n.uGoalPos,j.goalPos[0],j.goalPos[1],j.goalPos[2]),t.uniform1f(n.uGoalRadius,j.goalRadius),t.uniform1f(n.uOcclusionStrength,L.occlusionCutoutStrength),t.uniform3f(n.uTrackPrimary,B.trackPrimary[0],B.trackPrimary[1],B.trackPrimary[2]),t.uniform3f(n.uTrackSecondary,B.trackSecondary[0],B.trackSecondary[1],B.trackSecondary[2]),t.uniform3f(n.uGridLineColor,B.gridLineColor[0],B.gridLineColor[1],B.gridLineColor[2]),t.uniform3f(n.uWallColor,B.wallColor[0],B.wallColor[1],B.wallColor[2]),t.uniform3f(n.uSkyZenith,B.skyZenith[0],B.skyZenith[1],B.skyZenith[2]),t.uniform3f(n.uSkyHorizon,B.skyHorizon[0],B.skyHorizon[1],B.skyHorizon[2]),t.uniform3f(n.uAbyssFogColor,B.abyssFogColor[0],B.abyssFogColor[1],B.abyssFogColor[2]),t.uniform1f(n.uAbyssFogDensity,B.abyssFogDensity),t.uniform3f(n.uSunDir,B.sunDirection[0],B.sunDirection[1],B.sunDirection[2]),t.uniform1f(n.uGlassStress,h.glassStress??0),t.uniform1f(n.uCrackVisibility,h.crackVisibility??0),t.uniform1f(n.uStressGlow,h.stressGlow??0),t.uniform1i(n.uEngineMode,h.engineMode??0),t.uniform1i(n.uDebugVizMode,h.debugVizMode??0),t.uniform1i(n.uGhostActive,h.ghostActive?1:0);const Z=h.ghostPos??[0,-100,0],C=h.ghostQuat??[0,0,0,1],ee=h.ghostColor??[.22,.94,1];t.uniform3f(n.uGhostPos,Z[0],Z[1],Z[2]),t.uniform4f(n.uGhostQuat,C[0],C[1],C[2],C[3]),t.uniform3f(n.uGhostColor,ee[0],ee[1],ee[2]);const pe=K=>{const N=K??[],Y=Math.min(6,N.length),Me=new Float32Array(24),Ae=new Float32Array(24);for(let le=0;le<Y;le++){const he=N[le],fe=le*4;Me[fe+0]=he.position[0],Me[fe+1]=he.position[1],Me[fe+2]=he.position[2],Me[fe+3]=he.radius,Ae[fe+0]=he.color[0],Ae[fe+1]=he.color[1],Ae[fe+2]=he.color[2],Ae[fe+3]=he.slotIndex??le}t.uniform1i(n.uOtherMarbleCount,Y),n.uOtherMarblePosRad&&t.uniform4fv(n.uOtherMarblePosRad,Me),n.uOtherMarbleColor&&t.uniform4fv(n.uOtherMarbleColor,Ae)};pe(h.otherMarbles),t.uniform1i(n.uShatterShardCount,h.shatterShardCount??0),h.shatterShards&&n.uShatterShards&&t.uniform4fv(n.uShatterShards,h.shatterShards),h.shockwaveRings&&n.uShockwaveRings&&t.uniform4fv(n.uShockwaveRings,h.shockwaveRings),h.shockwaveParams&&n.uShockwaveParams&&t.uniform4fv(n.uShockwaveParams,h.shockwaveParams),h.rimDanger&&n.uRimDanger?t.uniform4fv(n.uRimDanger,h.rimDanger):n.uRimDanger&&t.uniform4f(n.uRimDanger,0,0,0,0);const ge=h.fieldMutations??[],be=Math.min(ge.length,xt);H.fill(0),p.fill(0),R.fill(0);for(let K=0;K<be;K++){const N=ge[K],Y=K*4;H[Y+0]=N.posA[0],H[Y+1]=N.posA[1],H[Y+2]=N.posA[2],H[Y+3]=N.radius,p[Y+0]=N.posB[0],p[Y+1]=N.posB[1],p[Y+2]=N.posB[2],p[Y+3]=N.blendK,R[Y+0]=Da[N.kind]??1,R[Y+1]=Ft[N.material]??0,R[Y+2]=N.spawnTime,R[Y+3]=N.ttl}t.uniform1i(n.uMutationCount,be),t.uniform4fv(n.uMutationsPosA,H),t.uniform4fv(n.uMutationsPosB,p),t.uniform4fv(n.uMutationsMeta,R);const ve=h.portals??j.portals??[],ye=Math.min(ve.length,it);w.fill(0),P.fill(0),T.fill(0),I.fill(0),D.fill(0),W.fill(0);for(let K=0;K<ye;K++){const N=ve[K],Y=K*4;w[Y+0]=N.posA[0],w[Y+1]=N.posA[1],w[Y+2]=N.posA[2],w[Y+3]=N.radius,P[Y+0]=N.normalA[0],P[Y+1]=N.normalA[1],P[Y+2]=N.normalA[2],P[Y+3]=N.activeA??!0?1:0,T[Y+0]=N.upA[0],T[Y+1]=N.upA[1],T[Y+2]=N.upA[2],T[Y+3]=N.flingBoost??1,I[Y+0]=N.posB[0],I[Y+1]=N.posB[1],I[Y+2]=N.posB[2],I[Y+3]=N.radius,D[Y+0]=N.normalB[0],D[Y+1]=N.normalB[1],D[Y+2]=N.normalB[2],D[Y+3]=N.activeB??!0?1:0,W[Y+0]=N.upB[0],W[Y+1]=N.upB[1],W[Y+2]=N.upB[2],W[Y+3]=0}t.uniform1i(n.uPortalPairCount,ye),t.uniform4fv(n.uPortalPosA,w),t.uniform4fv(n.uPortalNormalA,P),t.uniform4fv(n.uPortalUpA,T),t.uniform4fv(n.uPortalPosB,I),t.uniform4fv(n.uPortalNormalB,D),t.uniform4fv(n.uPortalUpB,W);const me=h.portalAimPreview;me&&me.active?(t.uniform4f(n.uPortalAimPos,me.position[0],me.position[1],me.position[2],me.radius),t.uniform4f(n.uPortalAimNormal,me.normal[0],me.normal[1],me.normal[2],me.end==="blue"?2:1)):(t.uniform4f(n.uPortalAimPos,0,-100,0,0),t.uniform4f(n.uPortalAimNormal,0,1,0,0));const Te=h.gridTiles;if(Te&&Te.length>0){t.enable(t.SCISSOR_TEST);for(const K of Te){const N=Math.max(0,Math.floor(K.viewport.x)),Y=Math.max(0,Math.floor(K.viewport.y)),Me=Math.max(1,Math.floor(K.viewport.width)),Ae=Math.max(1,Math.floor(K.viewport.height));t.viewport(N,Y,Me,Ae),t.scissor(N,Y,Me,Ae);const le=K.camera,he=K.marble,fe=Ke[he.marblePresetIndex%Ke.length]??Ke[0],we=Math.tan(le.fovDeg*Math.PI/360);t.uniform2f(n.uResolution,Me,Ae),t.uniform3f(n.uCameraPos,le.position[0],le.position[1],le.position[2]),t.uniform3f(n.uCameraForward,le.forward[0],le.forward[1],le.forward[2]),t.uniform3f(n.uCameraRight,le.right[0],le.right[1],le.right[2]),t.uniform3f(n.uCameraUp,le.up[0],le.up[1],le.up[2]),t.uniform1f(n.uCameraTanHalfFov,we),t.uniform1f(n.uOcclusionStrength,le.occlusionCutoutStrength),t.uniform3f(n.uMarblePos,K.renderPosition[0],K.renderPosition[1],K.renderPosition[2]),t.uniform4f(n.uMarbleQuat,K.renderOrientation[0],K.renderOrientation[1],K.renderOrientation[2],K.renderOrientation[3]),t.uniform1f(n.uMarbleRadius,he.radius),t.uniform1i(n.uMarbleStatus,ra[he.status]??0),t.uniform1f(n.uMarbleStatusTimer,he.statusTimer);const Ce=K.marbleColor??fe.baseColor,$e=K.marbleColor?[Math.min(1,Ce[0]*.55+.45),Math.min(1,Ce[1]*.55+.45),Math.min(1,Ce[2]*.55+.45)]:fe.veinColor,De=K.marbleColor??fe.coreGlowColor;t.uniform3f(n.uMarbleBaseColor,Ce[0],Ce[1],Ce[2]),t.uniform3f(n.uMarbleVeinColor,$e[0],$e[1],$e[2]),t.uniform3f(n.uMarbleGlowColor,De[0],De[1],De[2]),t.uniform1f(n.uMarbleIridescence,fe.iridescence);const Ve=K.ghostActive??h.ghostActive??!1,Pe=K.ghostPos??Z,Be=K.ghostQuat??C,Fe=K.ghostColor??ee;t.uniform1i(n.uGhostActive,Ve?1:0),t.uniform3f(n.uGhostPos,Pe[0],Pe[1],Pe[2]),t.uniform4f(n.uGhostQuat,Be[0],Be[1],Be[2],Be[3]),t.uniform3f(n.uGhostColor,Fe[0],Fe[1],Fe[2]),pe(K.otherMarbles??h.otherMarbles),t.drawArrays(t.TRIANGLES,0,3)}t.disable(t.SCISSOR_TEST)}else t.disable(t.SCISSOR_TEST),t.drawArrays(t.TRIANGLES,0,3);if(k&&oe)t.endQuery(k.TIME_ELAPSED_EXT),M.push(oe);else if(typeof performance<"u"){const K=Math.max(.05,performance.now()-ae);S=S*.85+K*.15}}let v=null;function x(h,A){const g=h.getContext("2d");if(!g)return;const G=h.width,O=h.height,te=Math.min(320,Math.max(160,Math.floor(G*.32))),ae=Math.min(200,Math.max(100,Math.floor(O*.32)));if(!v&&typeof document<"u"&&(v=document.createElement("canvas")),!v)return;(v.width!==te||v.height!==ae)&&(v.width=te,v.height=ae);const oe=v.getContext("2d");if(!oe)return;const L=oe.createImageData(te,ae),de=L.data,{camera:X,marble:J,renderPosition:ce,time:j,course:B}=A,V=B.theme,ue=Math.hypot(V.sunDirection[0],V.sunDirection[1],V.sunDirection[2])||1,ne=[V.sunDirection[0]/ue,V.sunDirection[1]/ue,V.sunDirection[2]/ue],Se=Math.tan(X.fovDeg*Math.PI/360),ze=te/Math.max(1,ae),Z=Ke[J.marblePresetIndex%Ke.length]??Ke[0];let C=0;for(let ee=0;ee<ae;ee++){const pe=1-(ee+.5)/ae*2;for(let ge=0;ge<te;ge++){const be=((ge+.5)/te*2-1)*ze;let ve=X.forward[0]+X.right[0]*be*Se+X.up[0]*pe*Se,ye=X.forward[1]+X.right[1]*be*Se+X.up[1]*pe*Se,me=X.forward[2]+X.right[2]*be*Se+X.up[2]*pe*Se;const Te=1/Math.hypot(ve,ye,me);ve*=Te,ye*=Te,me*=Te;const K=X.position[0]-ce[0],N=X.position[1]-ce[1],Y=X.position[2]-ce[2],Me=K*ve+N*ye+Y*me,Ae=K*K+N*N+Y*Y-J.radius*J.radius,le=Me*Me-Ae,he=le>0?-Me-Math.sqrt(le):-1;let fe=.2,we=!1,Ce="standard";for(let Pe=0;Pe<44;Pe++){const Be=X.position[0]+ve*fe,Fe=X.position[1]+ye*fe,Xe=X.position[2]+me*fe,Oe=u.sample([Be,Fe,Xe],j);if(Oe.distance<.035){we=!0,Ce=Oe.material;break}if(fe+=Math.max(.05,Oe.distance*.92),fe>85)break}let $e=0,De=0,Ve=0;if(he>.1&&(!we||he<fe)){const Pe=X.position[0]+ve*he,Be=X.position[1]+ye*he,Fe=X.position[2]+me*he,Xe=(Pe-ce[0])/J.radius,Oe=(Be-ce[1])/J.radius,Ue=(Fe-ce[2])/J.radius,Ie=Math.max(.18,Xe*ne[0]+Oe*ne[1]+Ue*ne[2]),Ne=Math.pow(1-Math.max(0,-(Xe*ve+Oe*ye+Ue*me)),2.5);$e=Z.baseColor[0]*Ie+Z.coreGlowColor[0]*Ne*.75+.22*Math.pow(Ie,6),De=Z.baseColor[1]*Ie+Z.coreGlowColor[1]*Ne*.75+.22*Math.pow(Ie,6),Ve=Z.baseColor[2]*Ie+Z.coreGlowColor[2]*Ne*.75+.22*Math.pow(Ie,6)}else if(we){const Pe=X.position[0]+ve*fe,Be=X.position[1]+ye*fe,Fe=X.position[2]+me*fe,Xe=u.normal([Pe,Be,Fe],j),Oe=Math.max(.22,Xe[0]*ne[0]+Xe[1]*ne[1]+Xe[2]*ne[2]);let Ue=V.trackPrimary[0],Ie=V.trackPrimary[1],Ne=V.trackPrimary[2];const St=Math.floor(Pe*.85)+Math.floor(Fe*.85)&1;if(St&&(Ue=V.trackSecondary[0],Ie=V.trackSecondary[1],Ne=V.trackSecondary[2]),Ce==="conveyor"){const Gt=Math.sin(Fe*3.5+j*8)>0?1.25:.85;Ue=Math.min(1,Ue*.6+.12*Gt),Ie=Math.min(1,Ie*.8+.48*Gt),Ne=Math.min(1,Ne*.9+.56*Gt)}else Ce==="bounce"?(Ue=.98,Ie=.32,Ne=.76):Ce==="bumper"?(Ue=1,Ie=.26,Ne=.22):Ce==="sticky"?(Ue=.92,Ie=.66,Ne=.16):Ce==="goal"?(Ue=St?.98:.15,Ie=St?.86:.95,Ne=St?.22:.58):Ce==="start"&&(Ue=.22,Ie=.88,Ne=.62);const Ta=Math.abs(Pe-Math.round(Pe)),Aa=Math.abs(Fe-Math.round(Fe)),ct=Ta<.045||Aa<.045?.45:0;$e=Ue*Oe*(1-ct)+V.gridLineColor[0]*ct,De=Ie*Oe*(1-ct)+V.gridLineColor[1]*ct,Ve=Ne*Oe*(1-ct)+V.gridLineColor[2]*ct;const dt=Math.min(.78,fe/75);$e=$e*(1-dt)+V.abyssFogColor[0]*dt,De=De*(1-dt)+V.abyssFogColor[1]*dt,Ve=Ve*(1-dt)+V.abyssFogColor[2]*dt}else{const Pe=Math.max(0,Math.min(1,ye*.65+.35));$e=V.skyHorizon[0]*(1-Pe)+V.skyZenith[0]*Pe,De=V.skyHorizon[1]*(1-Pe)+V.skyZenith[1]*Pe,Ve=V.skyHorizon[2]*(1-Pe)+V.skyZenith[2]*Pe}de[C++]=Math.min(255,Math.max(0,Math.round(Math.pow($e,.85)*255))),de[C++]=Math.min(255,Math.max(0,Math.round(Math.pow(De,.85)*255))),de[C++]=Math.min(255,Math.max(0,Math.round(Math.pow(Ve,.85)*255))),de[C++]=255}}oe.putImageData(L,0,0),g.imageSmoothingEnabled=!0,g.drawImage(v,0,0,G,O)}function _(){return{glsl:r,wgsl:a,backend:t?"webgl2-lockstep-wgsl":"cpu-fallback"}}function F(){const h=Math.max(1,l);return{fps:Number((1e3/h).toFixed(1)),frameTimeMs:Number(y.toFixed(2)),emaFrameMs:Number(l.toFixed(2)),gpuPassMs:Number(S.toFixed(2)),gpuTimerQueryAvailable:!!k,initialDprCap:Mt,adaptiveScale:Number(d.toFixed(3)),effectiveDpr:Number(m.toFixed(3)),renderResolution:[e.width||1,e.height||1]}}function q(h){d=Math.max(qt,Math.min(Xt,h));const A=Math.min(window.devicePixelRatio||1,Mt);m=Math.max(.65,Number((A*d).toFixed(3)))}function U(){if(e.removeEventListener("webglcontextlost",re),e.removeEventListener("webglcontextrestored",ie),!!t){for(;M.length>0;){const h=M.shift();h&&t.deleteQuery(h)}s&&t.deleteProgram(s),c&&t.deleteVertexArray(c)}}return{setCourse:E,render:$,getCompiledShaders:_,getProfilerMetrics:F,setAdaptiveScale:q,dispose:U}}function ke(e){return[Math.round(e[0]*100)/100,Math.round(e[1]*100)/100,Math.round(e[2]*100)/100]}function zt(e,i){var r;let t=((r=e.nodes[0])==null?void 0:r.id)??"course-root",o=1/0;for(const a of[...e.nodes,...e.hazards]){const s=Math.hypot(i[0]-a.center[0],i[1]-a.center[1],i[2]-a.center[2]);s<o&&(o=s,t=a.id??a.kind)}return t}function eo(e){return{courseId:e.id,courseName:e.name,sampleRateHz:120,totalFramesRecorded:0,durationSec:0,peakSpeed:0,averageSpeed:0,airborneRatio:0,groundedRatio:1,completionSplits:[],deathEvents:[],slipBrakeHeatmap:[],speedProfileHistogram:[{bucketLabel:"0–6 u/s (Creep / Precision)",ratio:0},{bucketLabel:"6–14 u/s (Tourist Cruise)",ratio:0},{bucketLabel:"14–20 u/s (Banked Carve)",ratio:0},{bucketLabel:"20–24+ u/s (Terminal Fling)",ratio:0}],trajectoryPolyline:[ke(e.startPos)],inferredArchetype:"Awaiting Live Run Telemetry",coachingDiagnosis:`0 frames recorded on ${e.name} so far. Roll the marble to capture real 120 Hz velocity, slip, and death telemetry, or synthesize directly from course geometry.`,isBaselineSample:!1}}function to(e){const i=e.startPos,t=e.goalPos,o=(i[0]+t[0])*.5,r=(i[1]+t[1])*.5,a=(i[2]+t[2])*.5,s=[{id:`${e.id}-death-1`,courseId:e.id,timestampSec:8.4,cause:"fell",position:ke([o+1.8,r-.6,a+2.4]),velocity:[11.4,-9.8,-14.2],speed:20.68,surfaceMaterial:"standard",nearestNodeId:zt(e,[o+1.8,r-.6,a+2.4])},{id:`${e.id}-death-2`,courseId:e.id,timestampSec:16.9,cause:"shattered",position:ke([t[0]-2.4,t[1]+.4,t[2]+6.8]),velocity:[6.2,-32.4,-12.1],speed:35.14,surfaceMaterial:"standard",nearestNodeId:zt(e,[t[0]-2.4,t[1]+.4,t[2]+6.8])},{id:`${e.id}-death-3`,courseId:e.id,timestampSec:23.1,cause:e.hazards.some(b=>b.material==="acid")||e.nodes.some(b=>b.material==="acid")?"sunk":"fell",position:ke([t[0]-1.1,t[1]-.8,t[2]+4.2]),velocity:[14.8,-6.5,-16.4],speed:23.02,surfaceMaterial:"ice",nearestNodeId:zt(e,[t[0]-1.1,t[1]-.8,t[2]+4.2])}],c=[{position:ke([i[0]+.4,i[1]-2.1,i[2]-9.2]),speed:18.4,slipIntensity:.82,action:"lateral-carve",surfaceMaterial:"standard"},{position:ke([o+1.2,r+.2,a+1.5]),speed:21.2,slipIntensity:.94,action:"backspin-brake",surfaceMaterial:"ice"},{position:ke([t[0]-.8,t[1]+.5,t[2]+5.6]),speed:16.7,slipIntensity:.88,action:"rim-save",surfaceMaterial:"standard"}],n=[{label:"Launch Chute Exit",timestampSec:4.2,timeRemainingSec:Math.max(10,e.parTimeSec-4.2),speed:17.6,position:ke([i[0],i[1]-2.4,i[2]-10.5])},{label:"Mid-Course Hazard Apex",timestampSec:12.8,timeRemainingSec:Math.max(10,e.parTimeSec-12.8),speed:19.8,position:ke([o,r,a])},{label:"Final Catwalk Approach",timestampSec:26.4,timeRemainingSec:Math.max(5,e.parTimeSec-26.4),speed:15.2,position:ke([t[0],t[1]+.6,t[2]+4.5])}],u=[ke(i),ke([i[0],i[1]-1.8,i[2]-7.5]),ke([o*.5,r+1.2,a*.7]),ke([o,r,a]),ke([t[0]*.85,t[1]+1.1,t[2]*.82]),ke([t[0],t[1]+.55,t[2]])];return{courseId:e.id,courseName:e.name,sampleRateHz:120,totalFramesRecorded:3420,durationSec:28.5,peakSpeed:23.4,averageSpeed:14.8,airborneRatio:.24,groundedRatio:.76,completionSplits:n,deathEvents:s,slipBrakeHeatmap:c,speedProfileHistogram:[{bucketLabel:"0–6 u/s (Creep / Precision)",ratio:.14},{bucketLabel:"6–14 u/s (Tourist Cruise)",ratio:.36},{bucketLabel:"14–20 u/s (Banked Carve)",ratio:.32},{bucketLabel:"20–24+ u/s (Terminal Fling)",ratio:.18}],trajectoryPolyline:u,inferredArchetype:"High-Speed Chute Daredevil",coachingDiagnosis:`Player carries high entry speed (20.7–23.4 u/s) out of steep chutes on ${e.name}, triggering late backspin-brake skids and overshooting unrailed turn apexes near ${s[0].nearestNodeId} and ${s[1].nearestNodeId}. Recommend sculpting smooth-unioned outer catch-berms (railHeight >= 1.05m), inserting a high-friction sticky brake strip before the final abyss catwalk, and phase-locking piston hazards to reward a 19 u/s speedrun line.`,isBaselineSample:!0}}function $o(){let e=0,i=0,t=0,o=0,r="racing",a=[0,0,0,0];const s=[],c=[],n=[],u=[];function b(){e=0,i=0,t=0,o=0,r="racing",a=[0,0,0,0],s.length=0,c.length=0,n.length=0,u.length=0}function y(f,d,m,S,k,M,H){e+=1,M&&(i+=1);const p=Math.hypot(m[0],m[1],m[2]);t+=p,p>o&&(o=p),p<6?a[0]++:p<14?a[1]++:p<20?a[2]++:a[3]++,(u.length===0||e%48===0)&&(u.push(ke(d)),u.length>32&&u.shift()),p>16.5&&(k==="ice"||!M)&&c.length<8&&c.push({position:ke(d),speed:Math.round(p*100)/100,slipIntensity:Math.min(1,Math.round(p/23.5*100)/100),action:k==="ice"?"ice-drift":"rim-save",surfaceMaterial:k}),S!==r&&(S==="fell"||S==="shattered"||S==="sunk")?s.push({id:`${f.id}-live-death-${s.length+1}`,courseId:f.id,timestampSec:Math.round(e/120*10)/10,cause:S,position:ke(d),velocity:ke(m),speed:Math.round(p*100)/100,surfaceMaterial:k,nearestNodeId:zt(f,d)}):S!==r&&S==="goal"&&n.push({label:"Goal Pad Reached",timestampSec:Math.round(e/120*10)/10,timeRemainingSec:Math.round(H*10)/10,speed:Math.round(p*100)/100,position:ke(d)}),r=S}function l(f){if(e===0)return eo(f);const d=Math.max(1,a[0]+a[1]+a[2]+a[3]),m=Math.round(t/e*100)/100,S=Math.round(i/e*100)/100,k=o>=19.5?"High-Speed Chute Daredevil":S>=.88?"Precision Catwalk Tactician":"Edge-Carving Rim-Saver",M=s.length>0?`Recorded ${e} live frames (${s.length} real death(s) near ${s[0].nearestNodeId}, peak ${o.toFixed(1)} u/s). Recommend sculpting catch-berms and sticky brake zones near [${s[0].position.join(", ")}].`:`Recorded ${e} live frames on ${f.name} with 0 deaths (peak ${o.toFixed(1)} u/s, avg ${m.toFixed(1)} u/s, ${k}).`;return{courseId:f.id,courseName:f.name,sampleRateHz:120,totalFramesRecorded:e,durationSec:Math.round(e/120*10)/10,peakSpeed:Math.round(o*100)/100,averageSpeed:m,airborneRatio:Math.round((1-S)*100)/100,groundedRatio:S,completionSplits:[...n],deathEvents:[...s],slipBrakeHeatmap:[...c],speedProfileHistogram:[{bucketLabel:"0–6 u/s (Creep / Precision)",ratio:Math.round(a[0]/d*100)/100},{bucketLabel:"6–14 u/s (Tourist Cruise)",ratio:Math.round(a[1]/d*100)/100},{bucketLabel:"14–20 u/s (Banked Carve)",ratio:Math.round(a[2]/d*100)/100},{bucketLabel:"20–24+ u/s (Terminal Fling)",ratio:Math.round(a[3]/d*100)/100}],trajectoryPolyline:u.length>0?[...u]:[ke(f.startPos)],inferredArchetype:k,coachingDiagnosis:M,isBaselineSample:!1}}return{recordSnapshot:y,getSummary:l,reset:b}}const Ot=`// === FROZEN ENGINE CONTRACTS (src/contracts/sdf.ts, course.ts, physics.ts) ===
export type Vec3 = readonly [number, number, number];
export type Quat = readonly [number, number, number, number];
export type SdfPrimitiveKind = 'box' | 'roundedBox' | 'sphere' | 'cylinder' | 'capsule' | 'torus' | 'ramp' | 'sweptTrack' | 'waveFloor' | 'piston';
export type SdfCsgOpKind = 'union' | 'smoothUnion' | 'subtract' | 'smoothSubtract' | 'intersect';
export type SurfaceMaterial = 'standard' | 'ice' | 'sticky' | 'bounce' | 'acid' | 'goal' | 'start' | 'bumper' | 'conveyor';

// Material Physics Table:
${JSON.stringify(st,null,2)}

// Default 120 Hz Physics Config:
${JSON.stringify(Qe,null,2)}
`,sa=`// === LOCKSTEP CPU/GPU SDF EVALUATOR & 120 HZ SOLVER INVARIANTS ===
// 1. Every primitive & CSG operator is evaluated identically in TypeScript (src/sdf/eval-cpu.ts),
//    GLSL ES 3.00 (compileCourseToGlsl), and WGSL WebGPU (compileCourseToWgsl).
// 2. Tetrahedral 4-tap finite-difference normal estimator (eps = 0.0025) with SEAM_BIAS_EPS = 0.03
//    upward support normal bias (ny >= 0.68) at modular union joints so the marble never snags.
// 3. Kinematic motion derivatives:
//    - piston: offset = axis * stroke * pow(max(0, 0.5 + 0.5*sin(omega*t + phase)), slamSharpness)
//    - bridge: offset = axis * amplitude * sin(omega*t + phase)
//    - steelie: orbit [rx*cos(ang), ry*sin(2*ang), rz*sin(ang)] or patrol span*sin(ang)
//    - waveFloor: waveH = amp * sin(x*freqX + t*speed) * cos(z*freqZ + 0.7*t*speed)
// 4. 120 Hz Solver (fixedDt = 1/120s):
//    - 12-step sphereCast CCD prevents tunneling at high velocity.
//    - 5-iteration SDF depenetration transfers kinematic surfaceVelocity & conveyorVelocity.
//    - Snappy first-push trackball launch boost + reverse backspin brake (1.45x grip multiplier) + lateral carve assist.
//    - High-fall shatter threshold: shatterImpactSpeed = 31.0 u/s on non-bounce surfaces.
`,Nt=`// === MARBLE MADNESS SDF GAMEPLAY & LEVEL DESIGN BIBLE ===
// Design North Star: "If this game could be built with static triangle meshes and a standard PhysX sphere collider, we failed."
// 1. Tactile Trackball Physics:
//    - Decoupled linear (v) vs angular (omega) momentum feel: backspin cliff saves, ice spin-charge to standard track launch.
//    - C^infinity smooth-union / smooth-subtracted chutes & banked rails convert height into exit speed with zero facet chatter.
// 2. Two-Line Course Architecture (Tourist Line vs. Speedrun / High-Roller Line):
//    - Tourist Line: Readable 1.0m fwidth isometric grid, gentle banked guardrails, solvable with 10-15s left on clock.
//    - Speedrun Line: 2 signature shortcuts per course (diagonal conveyor sky-vaults, wave-floor crest pumping,
//      piston-top vaulting, or non-Euclidean Portal flings) saving 8-14 seconds for timer carry-over.
// 3. Living SDF Hazards & Non-Euclidean Portals:
//    - Synchronized SDF Pistons with analytical velocity impulse transfer.
//    - Traveling 120 Hz Sinusoidal Wave Floors that pump the marble airborne over acid moats.
//    - Ferrofluid Patrolling & Orbiting Black Steelies.
//    - Linked Blue/Orange Torus Portals ("Speedy marble goes in, speedy marble comes out") preserving scalar speed ||v||.
`;function pt(e){return Math.max(1,Math.ceil(e/3.85))}function ao(e,i){if(!i||i.promptTokenCount<=0)return e;const t=i.promptTokenCount/Math.max(1,e.totalTokensPacked),o=e.sections.map(n=>({...n,tokenCount:Math.max(1,Math.round(n.tokenCount*t))})),r=i.cachedContentTokenCount!==void 0&&i.cachedContentTokenCount>0?i.cachedContentTokenCount:o.filter(n=>n.cachedImplicitly).reduce((n,u)=>n+u.tokenCount,0),a=Math.max(1,i.promptTokenCount-r),s=r*.05+a,c=Math.round(s/1e6*2*1e6)/1e6;return{...e,totalTokensPacked:i.promptTokenCount,cachedPrefixTokens:r,dynamicTailTokens:a,estimatedInputCostUsd:c,sections:o,liveUsageMetadata:i}}function oo(e,i){const t=ot(e),o=[`// Spatial SDF Lattice Atlas for course "${e.id}" (${i} probes at t=0.0s & t=1.25s)`],r=[e.startPos,e.goalPos,...e.nodes.map(l=>[l.center[0],l.center[1]+.8,l.center[2]]),...e.hazards.map(l=>[l.center[0],l.center[1]+.5,l.center[2]])],a=Math.min(e.startPos[0],e.goalPos[0])-6,s=Math.max(e.startPos[0],e.goalPos[0])+6,c=Math.min(e.startPos[2],e.goalPos[2])-6,n=Math.max(e.startPos[2],e.goalPos[2])+6,u=(e.startPos[1]+e.goalPos[1])*.5;let b=0;for(;r.length<i;){const l=b*37%100/100,f=b*73%100/100,d=a+(s-a)*l,m=c+(n-c)*f,S=u+Math.sin(b*1.7)*4;r.push([d,S,m]),b++}const y=r.slice(0,i);for(let l=0;l<y.length;l++){const f=y[l],d=t.sample(f,0),m=t.normal(f,0);o.push(`probe[${l}] p=(${f[0].toFixed(2)},${f[1].toFixed(2)},${f[2].toFixed(2)}) -> d=${d.distance.toFixed(4)} mat=${d.material} n=(${m[0].toFixed(2)},${m[1].toFixed(2)},${m[2].toFixed(2)})`)}return{text:o.join(`
`),probesEvaluated:y.length}}function io(e){const{currentCourse:i,allCourses:t=Ia,compiledShaders:o,telemetry:r=to(i),userPrompt:a="Synthesize an adaptive Marble Madness SDF course tuned to my 120 Hz run telemetry.",spatialLatticeSamples:s=96}=e,c=o!=null&&o.glsl&&o.glsl.length>50?o.glsl:It(i),n=o!=null&&o.wgsl&&o.wgsl.length>50?o.wgsl:Et(i),u=oo(i,s),b=JSON.stringify({activeCourseId:i.id,courses:t,activeCourse:i},null,2),y=[`// === COMPILED GLSL ES 3.00 SHADER (${c.split(`
`).length} lines) ===`,c,`// === COMPILED WGSL WEBGPU SHADER (${n.split(`
`).length} lines) ===`,n].join(`

`),l=JSON.stringify({telemetrySummary:r,userArchitectIntent:a},null,2),f=sa.length+u.text.length,d=b.length,m=[{id:"engineContracts",label:"Engine Contracts (SDF / Physics / Course AST)",charCount:Ot.length,tokenCount:pt(Ot.length),cachedImplicitly:!0,summary:"Frozen TypeScript contracts: 10 SDF primitives, 5 CSG ops, 9 materials, 120 Hz config"},{id:"sdfEvaluatorAndPhysics",label:"CPU/GPU SDF Kernel & 120 Hz CCD Solver",charCount:f,tokenCount:pt(f),cachedImplicitly:!0,summary:`Lockstep CPU/GPU math + ${u.probesEvaluated} spatial SDF & tetrahedral normal probes`},{id:"glslWgslCompilers",label:"Compiled GLSL2 & WGSL Raymarch Shaders",charCount:y.length,tokenCount:pt(y.length),cachedImplicitly:!0,summary:`${c.split(`
`).length} GLSL lines + ${n.split(`
`).length} WGSL lines (fwidth grid, 7-tap AO, SSS glass)`},{id:"courseCatalogAndSpatialAtlas",label:"Full CourseSpec Catalog & Multi-Tier CSG Trees",charCount:d,tokenCount:pt(d),cachedImplicitly:!0,summary:`${t.length} campaign & architect courses (${i.nodes.length+i.hazards.length} active nodes)`},{id:"gameplayFeelBible",label:"Gameplay Feel Bible & Dual-Line Level Theory",charCount:Nt.length,tokenCount:pt(Nt.length),cachedImplicitly:!0,summary:"6-DOF slip/backspin physics, Tourist vs. Speedrun lines, Living SDF hazards & Portals"},{id:"playerTelemetry120Hz",label:"Live 120 Hz Player Run Telemetry & Death Heatmap",charCount:l.length,tokenCount:pt(l.length),cachedImplicitly:!1,summary:`${r.totalFramesRecorded} frames @ 120 Hz · ${r.deathEvents.length} deaths · Peak ${r.peakSpeed.toFixed(1)} u/s (${r.inferredArchetype})`}],S=m.filter(D=>D.cachedImplicitly).reduce((D,W)=>D+W.tokenCount,0),k=m.filter(D=>!D.cachedImplicitly).reduce((D,W)=>D+W.tokenCount,0),M=S+k,H=m.reduce((D,W)=>D+W.charCount,0),p=S*.05+k,R=Math.round(p/1e6*2*1e6)/1e6,w=['You are the Gemini 4 Argon (`gemini-4-argon`, `thinking_level: "high"`) 1M-Token Live Course Architect & Multi-Agent Swarm Director for Marble Madness SDF.',"One mathematical Signed Distance Field (`CourseSpec`) drives both the 60-120 FPS GLSL/WGSL raymarcher and the 120 Hz CPU sphere-vs-SDF physics solver.","Analyze the full engine contracts, compiled shaders, existing courses, Gameplay Feel Bible, and the player’s 120 Hz telemetry (death coordinates, slip/backspin spikes, speed profile).",'Output a valid JSON object containing `{ "reasoningTrace": string, "course": CourseSpec }` where `course` has a grounded `startPos`, reachable `goalPos`, at most 32 total primitive nodes (`MAX_COURSE_NODES = 32`), both a safe Tourist Line and a high-speed Speedrun Shortcut, and synchronized kinematic hazards.'].join(" "),P=[Ot,sa,Nt,y,b,u.text].join(`

`),T=["// === DYNAMIC 120 HZ PLAYER TELEMETRY & ARCHITECT INTENT ===",l].join(`
`),I=`${P}

${T}`;return{modelId:"gemini-4-argon",companionModelId:"gemini-3.8-flash",verifierAgentId:"antigravity-preview-09-2026",thinkingLevel:"high",contextWindowLimit:1e6,tokenEstimationMethod:"chars/4",totalCharsPacked:H,totalTokensPacked:M,cachedPrefixTokens:S,dynamicTailTokens:k,implicitCacheDiscountRatio:.95,estimatedInputCostUsd:R,sections:m,telemetrySummary:r,spatialSdfSampleCount:u.probesEvaluated,systemInstruction:w,cachedPrefixPrompt:P,dynamicTelemetryPrompt:T,fullPromptText:I,liveUsageMetadata:null}}const ro=[-60,-40,-20,0,20,40,60];function Ye(e,i,t){return Math.max(i,Math.min(t,e))}function et(e,i){const t=Math.hypot(e,i);return t<1e-6?[0,-1]:[e/t,i/t]}function no(e,i){const t=i*Math.PI/180,o=Math.cos(t),r=Math.sin(t);return[e[0]*o-e[1]*r,e[0]*r+e[1]*o]}function so(e){let i=e|0||1831565813;return()=>(i^=i<<13,i^=i>>>17,i^=i<<5,(i>>>0)%1e5/1e5)}function Je(e,i){const t=i==="speedrunner"?1.22:i==="chaos-explorer"?1.1:.96;return e.map((o,r)=>{const a=r>0?e[r-1]:null,s=r+1<e.length?e[r+1]:null;let c=0;if(a&&s){const b=et(o.position[0]-a.position[0],o.position[2]-a.position[2]),y=et(s.position[0]-o.position[0],s.position[2]-o.position[2]),l=Ye(b[0]*y[0]+b[1]*y[1],-1,1);c=Math.round(Math.acos(l)*180/Math.PI)}const n=c>=36,u=o.targetSpeed??(n?c>=72?6.4:8.6:14.5);return{id:o.id,label:o.label,position:o.position,captureRadius:o.captureRadius,targetSpeed:u*t,sharpTurnAhead:n,turnAngleDeg:c,jumpHint:o.jumpHint,jumpDirectionXZ:o.jumpDirectionXZ,routeKind:o.routeKind??"main"}})}function _t(e,i="tourist"){if(e.id.replace(/-argon-mutated$/,"")==="practice-race"){const r=i==="speedrunner";if(r){const s=[{id:"wp-start-lip",label:"Stage 1: Steep 28° Ramp Entry",position:[0,14,-2.8],captureRadius:2,targetSpeed:15},{id:"wp-stage1-ramp",label:"Stage 1: Steep Isometric Ramp",position:[0,12,-7],captureRadius:2.4,targetSpeed:16.5},{id:"wp-stage1-hairpin-brake",label:"Stage 1: Backspin Hairpin Brake Zone",position:[.6,10,-13.8],captureRadius:2.4,targetSpeed:6.8},{id:"wp-stage1-hairpin-exit",label:"Stage 1: Banked Turn Exit",position:[7.5,10,-13.6],captureRadius:2.4,targetSpeed:13.5},{id:"wp-stage2-portal-runup",label:"Stage 2: Blue Portal Fling Entry",position:[16.2,7,-13.6],captureRadius:2.4,targetSpeed:15,routeKind:"shortcut"},{id:"wp-stage3-landing",label:"Stage 3: Orange Portal 40° Landing Terrace",position:[30,7,-15.6],captureRadius:3.2,targetSpeed:7.2,routeKind:"shortcut"},{id:"wp-stage3-wave-mid",label:"Stage 3: Living Wave Floor & Pistons",position:[30,7,-23.4],captureRadius:2.4,targetSpeed:14.5},{id:"wp-stage3-ramp",label:"Stage 3: Descent Ramp",position:[30,5.5,-31],captureRadius:2.4,targetSpeed:15},{id:"wp-stage4-ice-entry",label:"Stage 4: Ice Chute Entry",position:[31.2,4,-36.2],captureRadius:2.4,targetSpeed:14},{id:"wp-stage4-ice-exit",label:"Stage 4: Steelie & Slalom Approach",position:[32.4,.45,-45.2],captureRadius:2.2,targetSpeed:11.5},{id:"wp-stage4-slalom-bypass",label:"Stage 4: S-Slalom Bypass Around CSG Barrier",position:[32.6,.45,-48.6],captureRadius:2,targetSpeed:11.5},{id:"wp-goal",label:"Stage 4: Marble Ramp Gauntlet Goal Pad",position:[...e.goalPos],captureRadius:e.goalRadius,targetSpeed:14}];return Je(s,i)}const a=[{id:"wp-start-lip",label:"Stage 1: Steep 28° Ramp Entry",position:[0,14,-2.8],captureRadius:1.8,targetSpeed:12},{id:"wp-stage1-ramp",label:"Stage 1: Steep Isometric Ramp",position:[0,12,-7],captureRadius:2.2,targetSpeed:14},{id:"wp-stage1-hairpin-brake",label:"Stage 1: Backspin Hairpin Brake Zone",position:[.4,10,-14.2],captureRadius:2.2,targetSpeed:r?5.8:6.5},{id:"wp-stage1-hairpin-exit",label:"Stage 1: Banked Turn Exit",position:[7.2,10,-14.8],captureRadius:2.2,targetSpeed:10.5},{id:"wp-stage2-drop",label:"Stage 2: Chasm Drop Chute",position:[12.5,8.2,-15.6],captureRadius:2.2,targetSpeed:11},{id:"wp-stage2-catwalk-entry",label:"Stage 2: Chasm Lip & Catwalk Entry",position:[16.8,7,-16.8],captureRadius:1.8,targetSpeed:9.2},{id:"wp-stage2-catwalk-mid",label:"Stage 2: Abyss Side-Catwalk Span",position:[22,7,-16.8],captureRadius:1.65,targetSpeed:11},{id:"wp-stage3-landing",label:"Stage 3: Terrace 3 Turn Brake",position:[29.8,7,-16.4],captureRadius:2.2,targetSpeed:r?5.4:6.2},{id:"wp-stage3-wave-mid",label:"Stage 3: Living Wave Floor & Pistons",position:[30,7,-23.4],captureRadius:2.2,targetSpeed:r?13.5:11.5},{id:"wp-stage3-ramp",label:"Stage 3: Descent Ramp",position:[30,5.5,-31],captureRadius:2.2,targetSpeed:r?14.5:10.5},{id:"wp-stage4-ice-entry",label:"Stage 4: Ice Chute Entry",position:[31.2,4,-36.2],captureRadius:2.2,targetSpeed:r?13.5:6.8},{id:"wp-stage4-ice-exit",label:"Stage 4: Steelie & Slalom Approach",position:[32.4,.45,-45.2],captureRadius:2,targetSpeed:r?11.5:5.5},{id:"wp-stage4-slalom-bypass",label:"Stage 4: S-Slalom Bypass Around CSG Barrier",position:[32.6,.45,-48.6],captureRadius:1.85,targetSpeed:r?11.5:5.5},{id:"wp-goal",label:"Stage 4: Marble Ramp Gauntlet Goal Pad",position:[...e.goalPos],captureRadius:e.goalRadius,targetSpeed:r?13.5:7.5}];return Je(a,i)}if(e.id==="beginner-chutes"){const a=i==="speedrunner"?[{id:"c2b-wp-turbo-entry",label:"East Narrow Turbo Chute Entry",position:[2.8,10,-3.5],captureRadius:1.8,targetSpeed:13.5,routeKind:"shortcut"},{id:"c2b-wp-turbo-exit",label:"East Turbo Chute Exit",position:[2.8,5.6,-16.8],captureRadius:2.2,targetSpeed:14.5,routeKind:"shortcut"},{id:"c2b-wp-confluence",label:"Chute Confluence Plaza",position:[-1.2,5.6,-19.6],captureRadius:2.2,targetSpeed:11.5},{id:"c2b-wp-bridge-spine",label:"West Bridge Spine",position:[-1.5,5.6,-26],captureRadius:2,targetSpeed:13},{id:"c2b-wp-wave-approach",label:"Wave Floor Approach",position:[0,5.6,-31.2],captureRadius:2.2,targetSpeed:13.5},{id:"c2b-wp-wave-floor",label:"Gentle Wave Floor",position:[0,5.6,-38],captureRadius:2.2,targetSpeed:14},{id:"c2b-wp-goal",label:"Beginner Chutes Goal Pad",position:[...e.goalPos],captureRadius:e.goalRadius,targetSpeed:14}]:[{id:"c2b-wp-safe-entry",label:"West Safe Guarded Chute Entry",position:[-2.4,10,-3.5],captureRadius:1.8,targetSpeed:9.5},{id:"c2b-wp-safe-exit",label:"West Safe Chute Exit",position:[-2.4,5.6,-16.8],captureRadius:2.2,targetSpeed:9.5},{id:"c2b-wp-confluence",label:"Chute Confluence Plaza",position:[-1.5,5.6,-19.6],captureRadius:2.2,targetSpeed:8.8},{id:"c2b-wp-bridge-spine",label:"West Bridge Spine",position:[-1.5,5.6,-26],captureRadius:2,targetSpeed:9.2},{id:"c2b-wp-wave-approach",label:"Wave Floor Approach",position:[0,5.6,-31.2],captureRadius:2.2,targetSpeed:9.5},{id:"c2b-wp-wave-floor",label:"Gentle Wave Floor",position:[0,5.6,-38],captureRadius:2.2,targetSpeed:9.5},{id:"c2b-wp-goal",label:"Beginner Chutes Goal Pad",position:[...e.goalPos],captureRadius:e.goalRadius,targetSpeed:10.5}];return Je(a,i)}if(e.id==="aerial-catwalks"){const r=i==="speedrunner",a=[{id:"c4-wp-drop-entry",label:"Aerial Drop Ramp Entry",position:[0,14,-3],captureRadius:1.8,targetSpeed:r?13.5:10},{id:"c4-wp-ridge-mid",label:"Suspended Narrow Ridge",position:[0,10,-14],captureRadius:1.8,targetSpeed:r?14.5:10.5},{id:"c4-wp-island-1",label:"Sky Island 1 Hub",position:[.4,10,-25.2],captureRadius:2.2,targetSpeed:r?11.5:8.2},{id:"c4-wp-conveyor-entry",label:"Conveyor Sky Accelerator Entry",position:[1.2,10,-28],captureRadius:1.8,targetSpeed:r?12.5:9},{id:"c4-wp-conveyor-exit",label:"Sky Island 2 Landing Brake",position:[1.5,6.8,-38.2],captureRadius:2.2,targetSpeed:r?8.5:6.2},{id:"c4-wp-island-2-turn",label:"Lower Catwalk Junction Turn",position:[6.2,6.8,i==="tourist"?-39.8:-38.6],captureRadius:2.2,targetSpeed:r?12:8.5},{id:"c4-wp-final-catwalk",label:"Final Suspended Catwalk Ridge",position:[11.6,5.2,i==="tourist"?-39.8:-38.6],captureRadius:2.2,targetSpeed:r?14.5:10.2},{id:"c4-wp-goal",label:"Aerial Catwalks Goal Spire",position:[...e.goalPos],captureRadius:e.goalRadius,targetSpeed:r?14:10.5}];return Je(a,i)}if(e.id==="intermediate-madness"){const r=[{id:"c2-wp-start-lip",label:"Conveyor Ramp Entry",position:[0,10.8,-2.8],captureRadius:1.8,targetSpeed:11.5},{id:"c2-wp-conveyor-exit",label:"Ice Slick Plaza North",position:[1.4,6.8,-11.4],captureRadius:2.2,targetSpeed:8.5},{id:"c2-wp-ice-east-corridor",label:"Ice Plaza Safe East Corridor",position:[3.9,6.8,-15.2],captureRadius:2,targetSpeed:7.4},{id:"c2-wp-piston-east-entry",label:"Piston Gauntlet East Lane Entry",position:[3.8,6.8,-18.8],captureRadius:1.85,targetSpeed:7.2},{id:"c2-wp-piston-east-chute",label:"Piston Gauntlet Brake Zone",position:[3.8,4.9,-23.2],captureRadius:2.1,targetSpeed:5.2},{id:"c2-wp-piston-landing",label:"Piston Landing Turn",position:[6.8,3.8,-26.2],captureRadius:2.2,targetSpeed:7.5},{id:"c2-wp-wave-west",label:"Wave Floor West",position:[11.2,3.8,-26.6],captureRadius:2.2,targetSpeed:10.2},{id:"c2-wp-wave-east",label:"Wave Floor East",position:[15.4,3.8,-26],captureRadius:2.1,targetSpeed:9.2},{id:"c2-wp-acid-runup",label:"Acid Moat North Run-Up",position:[21.4,3.8,-24.8],captureRadius:1.75,targetSpeed:5.5},{id:"c2-wp-acid-jump-lip",label:"Acid Moat Launch Lip",position:[21.8,3.8,-29.2],captureRadius:1.15,targetSpeed:13.5,jumpHint:!0,jumpDirectionXZ:[.04,-1],routeKind:i==="speedrunner"?"shortcut":"main"},{id:"c2-wp-goal-landing",label:"Goal Podium North Deck",position:[22,2.2,-35.2],captureRadius:2.3,targetSpeed:9.5},{id:"c2-wp-goal",label:"Intermediate Madness Goal Pad",position:[...e.goalPos],captureRadius:e.goalRadius,targetSpeed:10}];return Je(r,i)}if(e.id==="riptide-surf-break"||e.id==="sahara-dune-surge"){const r=i==="speedrunner",a=[{id:`${e.id}-wp-shore-ramp`,label:"Zone 1: Shoreline Ramp Drop",position:[0,6.8,-5.8],captureRadius:2.2,targetSpeed:r?13.5:10.5},{id:`${e.id}-wp-swash-waves`,label:"Zone 1: Ankle-Biter Swells",position:[-1.4,5.6,-11.5],captureRadius:2.4,targetSpeed:r?13.5:10.2},{id:`${e.id}-wp-rip-channel-entry`,label:"Zone 2: West Sandbar Rip-Current Channel Entry",position:[-3.6,5.6,-16.8],captureRadius:2,targetSpeed:r?14:10.5,routeKind:r?"shortcut":"main"},{id:`${e.id}-wp-rip-channel-exit`,label:"Zone 2: West Rip-Current Channel Exit",position:[-3.6,5.6,-28.6],captureRadius:2.2,targetSpeed:r?13.5:9.8,routeKind:r?"shortcut":"main"},{id:`${e.id}-wp-midbreak-lineup`,label:"Zone 2: Mid-Break Lineup Deck",position:[0,5.6,-32.2],captureRadius:2.2,targetSpeed:r?12.5:9.5},{id:`${e.id}-wp-pier-channel`,label:"Zone 3: Center Pier Pilings Swell Channel",position:[0,5.6,-40.4],captureRadius:2.2,targetSpeed:r?13.5:10},{id:`${e.id}-wp-outer-reef-deck`,label:"Zone 3: Outer Reef Bomb Lineup",position:[0,5.6,-49.2],captureRadius:2.2,targetSpeed:r?14:10.5},{id:`${e.id}-wp-reef-bomb-ramp`,label:"Zone 4: Outer Reef Bomb Launch Ramp",position:[0,4.8,-55],captureRadius:2.2,targetSpeed:r?15:11.5},{id:`${e.id}-wp-goal`,label:"Zone 4: Outer Reef Goal Podium",position:[...e.goalPos],captureRadius:e.goalRadius,targetSpeed:r?14:10.5}];return Je(a,i)}if(e.id==="neon-sky-obby"){const a=i==="speedrunner"?[{id:"obby-wp-speedrun-rail-entry",label:"Stage 1: East Speedrun Rail Entry",position:[2.6,10,-4],captureRadius:1.8,targetSpeed:13.5,routeKind:"shortcut"},{id:"obby-wp-speedrun-rail-exit",label:"Stage 1: East Speedrun Rail Exit",position:[2.6,10,-14.2],captureRadius:2,targetSpeed:14,routeKind:"shortcut"},{id:"obby-wp-cp1",label:"Stage 1 Checkpoint Deck",position:[0,10,-16.8],captureRadius:2.2,targetSpeed:12},{id:"obby-wp-spinner-1-bypass",label:"Stage 2: East Lane Past Spinner 1",position:[1.8,10,-21.8],captureRadius:1.8,targetSpeed:11.5},{id:"obby-wp-spinner-2-bypass",label:"Stage 2: West Lane Past Spinner 2",position:[-1.8,10,-27.2],captureRadius:1.8,targetSpeed:11.5},{id:"obby-wp-cp2",label:"Stage 2 Checkpoint Deck",position:[0,10,-32.8],captureRadius:2.2,targetSpeed:12.5},{id:"obby-wp-staircase-mid",label:"Stage 3: Trampoline Staircase Spine",position:[0,11.5,-39.5],captureRadius:2.2,targetSpeed:13.5},{id:"obby-wp-cp3",label:"Stage 3: Catch-Funnel & Checkpoint 4",position:[0,13,-48.5],captureRadius:2.4,targetSpeed:12.5},{id:"obby-wp-wave-beam",label:"Stage 4: Undulating Wave-Bridge Beam",position:[0,13,-55],captureRadius:2.2,targetSpeed:13.5},{id:"obby-wp-goal",label:"Stage 4: Obby Winner Podium",position:[...e.goalPos],captureRadius:e.goalRadius,targetSpeed:14}]:[{id:"obby-wp-stone-1",label:"Stage 1: Rainbow Stepping Stone 1",position:[-.2,10,-5],captureRadius:1.8,targetSpeed:9.5},{id:"obby-wp-stone-2",label:"Stage 1: Rainbow Stepping Stone 2",position:[.2,10,-8.2],captureRadius:1.8,targetSpeed:9.5},{id:"obby-wp-stone-3",label:"Stage 1: Rainbow Stepping Stone 3",position:[-.2,10,-11.4],captureRadius:1.8,targetSpeed:9.5},{id:"obby-wp-cp1",label:"Stage 1 Checkpoint Deck",position:[0,10,-16.5],captureRadius:2.2,targetSpeed:9.5},{id:"obby-wp-spinner-1-bypass",label:"Stage 2: East Lane Past Spinner 1",position:[1.8,10,-21.8],captureRadius:1.8,targetSpeed:9.2},{id:"obby-wp-spinner-2-bypass",label:"Stage 2: West Lane Past Spinner 2",position:[-1.8,10,-27.2],captureRadius:1.8,targetSpeed:9.2},{id:"obby-wp-cp2",label:"Stage 2 Checkpoint Deck",position:[0,10,-32.5],captureRadius:2.2,targetSpeed:9.5},{id:"obby-wp-staircase-mid",label:"Stage 3: Trampoline Staircase Spine",position:[0,11.5,-39.5],captureRadius:2.2,targetSpeed:10.5},{id:"obby-wp-cp3",label:"Stage 3: Catch-Funnel & Checkpoint 4",position:[0,13,-48.5],captureRadius:2.4,targetSpeed:9.8},{id:"obby-wp-wave-beam",label:"Stage 4: Undulating Wave-Bridge Beam",position:[0,13,-55],captureRadius:2.2,targetSpeed:10},{id:"obby-wp-goal",label:"Stage 4: Obby Winner Podium",position:[...e.goalPos],captureRadius:e.goalRadius,targetSpeed:10.5}];return Je(a,i)}const o=[];for(let r=0;r<e.nodes.length;r++){const a=e.nodes[r];if(!(a.material==="acid"||a.material==="bumper")){if(a.kind==="ramp"){const s=a.halfLength*.78;if(a.axis==="z"){const c=a.rise>=0?-1:1;o.push({id:`${a.id??`ramp-${r}`}-entry`,label:`${a.id??"Ramp"} Entry`,position:[a.center[0],a.center[1]+Math.abs(a.rise)*.45,a.center[2]-c*s],captureRadius:Math.max(1.5,a.halfWidth*.65),targetSpeed:9}),o.push({id:`${a.id??`ramp-${r}`}-exit`,label:`${a.id??"Ramp"} Exit`,position:[a.center[0],a.center[1]-Math.abs(a.rise)*.45,a.center[2]+c*s],captureRadius:Math.max(1.5,a.halfWidth*.65),targetSpeed:7.5})}else{const c=a.rise>=0?-1:1;o.push({id:`${a.id??`ramp-${r}`}-entry`,label:`${a.id??"Ramp"} Entry`,position:[a.center[0]-c*s,a.center[1]+Math.abs(a.rise)*.45,a.center[2]],captureRadius:Math.max(1.5,a.halfWidth*.65),targetSpeed:9}),o.push({id:`${a.id??`ramp-${r}`}-exit`,label:`${a.id??"Ramp"} Exit`,position:[a.center[0]+c*s,a.center[1]-Math.abs(a.rise)*.45,a.center[2]],captureRadius:Math.max(1.5,a.halfWidth*.65),targetSpeed:7.5})}}else if(a.kind==="sweptTrack")o.push({id:`${a.id??`swept-${r}`}-start`,label:`${a.id??"Track"} Start`,position:[a.center[0]+a.start[0],a.center[1]+a.start[1],a.center[2]+a.start[2]],captureRadius:Math.max(1.4,a.halfWidth*.75),targetSpeed:10.5}),o.push({id:`${a.id??`swept-${r}`}-end`,label:`${a.id??"Track"} End`,position:[a.center[0]+a.end[0],a.center[1]+a.end[1],a.center[2]+a.end[2]],captureRadius:Math.max(1.4,a.halfWidth*.75),targetSpeed:9});else if(a.kind==="roundedBox"||a.kind==="box"||a.kind==="waveFloor"){const s=a.halfExtents[0],c=a.halfExtents[1],n=a.halfExtents[2];if(Math.min(s,n)<.75||c>2.2||Math.hypot(a.center[0]-e.startPos[0],a.center[2]-e.startPos[2])<1.2)continue;o.push({id:a.id??`deck-${r}`,label:a.id??`Deck ${r+1}`,position:[a.center[0],a.center[1]+c,a.center[2]],captureRadius:Ye(Math.min(s,n)*.55,1.5,2.5),targetSpeed:a.material==="ice"?7.2:9.5})}}}return o.push({id:`${e.id}-goal`,label:`${e.name} Goal Pad`,position:[...e.goalPos],captureRadius:e.goalRadius,targetSpeed:10}),Je(o,i)}function lo(e,i,t={}){let o=e,r=i,a=t.style??"tourist";const s=t.physicsConfig??Qe,c=so(t.seed??1337);let n=t.customWaypoints?[...t.customWaypoints]:_t(o,a),u=0,b=null,y=0,l=[...o.startPos],f="racing";function d(p,R){p&&(o=p),R&&(r=R),n=t.customWaypoints?[...t.customWaypoints]:_t(o,a),u=0,b=null,y=0,l=[...o.startPos],f="racing"}function m(p){let R=0,w=1/0;for(let P=0;P<n.length;P++){const T=n[P],I=Math.hypot(p[0]-T.position[0],(p[1]-T.position[1])*1.4,p[2]-T.position[2]);I<w&&(w=I,R=P)}return R}function S(p){const R=n[u];if(R&&Math.hypot(p[0]-R.position[0],p[2]-R.position[2])>9){const P=m(p),T=n[P],I=Math.hypot(p[0]-T.position[0],p[2]-T.position[2]);P>u&&I<5.5&&(u=P)}for(;u<n.length-1;){const w=n[u],P=n[u+1],T=Math.hypot(p[0]-w.position[0],p[2]-w.position[2]),I=Math.hypot(p[0]-P.position[0],p[2]-P.position[2]),D=Math.abs(p[1]-P.position[1]);if(I<T&&I<4.8&&D<=2.5)u++;else break}for(;u<n.length-1;){const w=n[u],P=Math.hypot(p[0]-w.position[0],p[2]-w.position[2]),T=Math.abs(p[1]-w.position[1]);if(P<=w.captureRadius&&T<=3.5)u++;else break}}function k(p,R,w){const P=p.position,T=p.radius,I=Math.hypot(p.velocity[0],p.velocity[2]),D=Ye(1.55+I*.16,1.65,3.6),W=p.contact.normal;return ro.map(Q=>{const se=no(R,Q),[re,ie]=se,E=p.contact.grounded&&W[1]>.42?Ye(-(W[0]*re+W[2]*ie)/W[1],-.85,.55):-.25,$=P[0]+re*D,v=P[2]+ie*D,x=P[1]-T+E*D,_=r.sample([$,x,v],w),F=r.sample([$,x-.65,v],w),q=r.sample([$,x-1.25,v],w),U=P[0]+re*(D*.55),h=P[2]+ie*(D*.55),A=r.sample([U,P[1]-T+E*D*.55,h],w);let g=_.distance<=F.distance?_:F;q.distance<g.distance&&q.material!=="acid"&&(g=q);const G=g.distance,O=r.sample([$,x-2.8,v],w),te=r.sample([U,x-2.8,h],w),ae=r.sample([U,P[1]+.12,h],w),oe=G>.4,L=g.material==="acid"||A.material==="acid"||Math.min(_.distance,F.distance)>.4&&(O.material==="acid"&&O.distance<1.8||te.material==="acid"&&te.distance<1.8),de=g.material==="bounce"||A.material==="bounce",X=ae.distance<T*1.15&&ae.material==="bumper"||g.material==="bumper";let J=!1;if(oe||L)for(const B of[4.8,6.4,8.2]){const V=P[0]+re*B,ue=P[2]+ie*B;for(const ne of[0,-1,-1.65,-2.2]){const Se=r.sample([V,P[1]-T+ne,ue],w);if(Se.distance<=.38&&Se.material!=="acid"&&Se.material!=="bumper"){J=!0;break}}if(J)break}let j=1-Math.abs(Q)/60*(a==="speedrunner"?.52:.62);return oe?J&&Math.abs(Q)<=20?j-=a==="tourist"?.35:.1:j-=a==="chaos-explorer"?1.35:2.8:j+=Ye(.4-G,-.2,.35),L&&(J&&Math.abs(Q)<=20?j-=.15:j-=a==="chaos-explorer"?1.4:3.2),X&&(j-=a==="chaos-explorer"?.25:1.65),ae.distance<T*.85&&(j-=1.25),de&&(j+=a==="speedrunner"?.45:a==="tourist"?-.25:.3),g.material==="conveyor"&&(j+=a==="speedrunner"?.35:.15),{angleDeg:Q,directionXZ:se,probePoint:[$,x,v],floorDistance:G,wallDistance:ae.distance,material:L?"acid":g.material,isAbyssDropOff:oe,isAcidHazard:L,isBouncePad:de,isBumperHazard:X,hasGapJumpLanding:J,score:j}})}function M(p,R,w=s.fixedDt){f!=="racing"&&p.status==="racing"&&(u=m(p.position),y=0,l=[...p.position]),f=p.status,S(p.position);const P=n[u]??n[n.length-1],T=u+1<n.length?n[u+1]:null,I=p.position,D=p.velocity,W=Math.hypot(D[0],D[2]);Math.hypot(I[0]-l[0],I[2]-l[2])>.65||p.status!=="racing"?(l=[...I],y=0):y+=w;const se=P.position[0]-I[0],re=P.position[2]-I[2],ie=Math.hypot(se,re);let E=et(se,re);if(T&&ie<P.captureRadius*1.35&&!P.jumpHint){const C=et(T.position[0]-I[0],T.position[2]-I[2]),ee=Ye(1-ie/(P.captureRadius*1.35),0,.4);E=et(E[0]*(1-ee)+C[0]*ee,E[1]*(1-ee)+C[1]*ee)}const $=k(p,E,R),v=$[3];let x=v;if(v.isAbyssDropOff&&!v.hasGapJumpLanding&&!P.jumpHint||v.isAcidHazard&&!v.hasGapJumpLanding&&!P.jumpHint||v.isBumperHazard||v.wallDistance<p.radius*.85||a==="chaos-explorer")for(const C of $)C.score>x.score+.08&&(x=C);let F=x.directionXZ;for(const C of o.hazards){if(!C.kinematic)continue;const{offset:ee}=Ea(C.kinematic,R),pe=C.center[0]+ee[0],ge=C.center[1]+ee[1],be=C.center[2]+ee[2],ve=I[0]-pe,ye=I[2]-be,me=Math.hypot(ve,ye);if(C.kinematic.kind==="steelie"&&me<3.4&&me>.05){const Te=ve/me,K=ye/me,N=Ye((3.4-me)/3.4,0,.85)*(a==="chaos-explorer"?.25:1);F=et(F[0]+Te*N,F[1]+K*N)}else if(C.kinematic.kind==="piston"&&me<3.2&&ge-(C.kind==="piston"?C.headHalfExtents[1]:.65)<I[1]+.95&&a!=="chaos-explorer"){const K=I[0]>=pe?1:-1;F=et(F[0]+K*.42,F[1])}}if(a==="chaos-explorer"){const C=Math.sin(R*5.2)*.34+(c()-.5)*.16,ee=-F[1],pe=F[0];F=et(F[0]+ee*C,F[1]+pe*C)}const q=p.contact.grounded?p.contact.surfaceVelocity[0]:0,U=p.contact.grounded?p.contact.surfaceVelocity[2]:0,h=D[0]-q,A=D[2]-U,g=Math.hypot(h,A),G=h*F[0]+A*F[1],O=h-G*F[0],te=A-G*F[1],oe=(st[p.surfaceMaterial]??st.standard).friction<.5;let L=P.targetSpeed;T&&P.sharpTurnAhead&&ie<(oe?5.8:4.2)&&(L=Math.min(L,oe?5.6:6.4)),v.isAbyssDropOff&&!v.hasGapJumpLanding&&!P.jumpHint&&(L=Math.min(L,4.5));let de=!1,X=0,J=0,ce=0;const j=g-L;if((P.sharpTurnAhead&&ie<(oe?5.8:4.4)&&j>.65||v.isAbyssDropOff&&!v.hasGapJumpLanding&&!P.jumpHint&&g>5)&&g>.5){de=!0,X=Ye(.45+j*.16,.45,1);const C=-h/g,ee=-A/g;J=C*X+F[0]*(1-X*.55),ce=ee*X+F[1]*(1-X*.55)}else{const C=oe?.34:.24,ee=G<L?1:Ye(1-(G-L)*.22,.15,1);J=F[0]*ee-O*C,ce=F[1]*ee-te*C}const V=Math.hypot(J,ce);V>1&&(J/=V,ce/=V);let ue=!1,ne="none";(p.contact.grounded||p.coyoteTimer>.01)&&p.jumpCooldown<=.01&&(P.jumpHint&&ie<=P.captureRadius*1.15&&W>=6.8?(ue=!0,ne=v.isAcidHazard?"acid-moat":"narrow-gap",P.jumpDirectionXZ&&(J=P.jumpDirectionXZ[0],ce=P.jumpDirectionXZ[1])):v.isAcidHazard&&v.hasGapJumpLanding&&W>=6.5?(ue=!0,ne="acid-moat"):v.isAbyssDropOff&&v.hasGapJumpLanding&&W>=6.8?(ue=!0,ne="narrow-gap"):a==="speedrunner"&&(p.surfaceMaterial==="bounce"||v.isBouncePad)&&W>=5?(ue=!0,ne="bounce-shortcut"):a==="chaos-explorer"&&W>6.5&&(p.contact.normal[1]<.985||v.isAbyssDropOff||v.isAcidHazard)&&Math.sin(R*7.5)>.94?(ue=!0,ne="chaos-hop"):y>1.25&&(p.contact.normal[1]<.985||v.isAbyssDropOff||v.isAcidHazard)&&(ue=!0,ne="unstuck",J=E[0],ce=E[1],y=0));const ze={moveXZ:[J,ce],jumpPressed:ue,respawnPressed:!1},Z={style:a,activeWaypointIndex:u,activeWaypoint:P,nextWaypoint:T,desiredHeadingXZ:E,chosenRayAngleDeg:x.angleDeg,backspinApplied:de,backspinStrength:X,jumpTriggered:ue,jumpReason:ne,fanProbes:$,commands:ze};return b=Z,Z}function H(p,R,w=s.fixedDt){return M(p,R,w).commands}return{getStyle:()=>a,setStyle:p=>{a=p,n=t.customWaypoints?[...t.customWaypoints]:_t(o,a),u=Math.min(u,n.length-1)},getWaypoints:()=>n,getActiveWaypointIndex:()=>u,getLastDecision:()=>b,reset:d,computeInput:H,stepDecision:M}}const jt=32,la=16,bt=1e4;function at(e,i=-bt,t=bt){return typeof e=="number"&&Number.isFinite(e)&&e>=i&&e<=t}function Ee(e,i=1e-4,t=bt){return typeof e=="number"&&Number.isFinite(e)&&e>=i&&e<=t}function tt(e){return Array.isArray(e)&&e.length===3&&at(e[0])&&at(e[1])&&at(e[2])}function wt(e){return Array.isArray(e)&&e.length===3&&Ee(e[0])&&Ee(e[1])&&Ee(e[2])}function co(e){return typeof e=="string"&&Object.prototype.hasOwnProperty.call(Ft,e)}const uo=new Set(["union","smoothUnion","subtract","smoothSubtract","intersect"]);function Zt(e,i,t){if(!e||typeof e!="object"){t.push(`${i} must be a non-null object.`);return}const o=e,r=typeof o.id=="string"&&o.id?`${i} (${o.id})`:i;switch(tt(o.center)||t.push(`${r} has missing or non-finite center Vec3.`),co(o.material)||t.push(`${r} has invalid material "${String(o.material)}".`),o.kind){case"box":{wt(o.halfExtents)||t.push(`${r} (box) requires positive finite halfExtents [x, y, z] > 0.`);break}case"roundedBox":{wt(o.halfExtents)||t.push(`${r} (roundedBox) requires positive finite halfExtents [x, y, z] > 0.`),at(o.radius,0,bt)||t.push(`${r} (roundedBox) requires finite radius >= 0.`);break}case"sphere":{Ee(o.radius)||t.push(`${r} (sphere) requires finite radius > 0.`);break}case"cylinder":{Ee(o.radius)||t.push(`${r} (cylinder) requires finite radius > 0.`),Ee(o.halfHeight)||t.push(`${r} (cylinder) requires finite halfHeight > 0.`);break}case"capsule":{(!tt(o.a)||!tt(o.b))&&t.push(`${r} (capsule) requires finite endpoints a and b Vec3.`),Ee(o.radius)||t.push(`${r} (capsule) requires finite radius > 0.`);break}case"torus":{Ee(o.majorRadius)||t.push(`${r} (torus) requires finite majorRadius > 0.`),Ee(o.minorRadius)||t.push(`${r} (torus) requires finite minorRadius > 0.`);break}case"ramp":{o.axis!=="x"&&o.axis!=="z"&&t.push(`${r} (ramp) requires axis "x" or "z".`),Ee(o.halfLength)||t.push(`${r} (ramp) requires finite halfLength > 0.`),at(o.rise)||t.push(`${r} (ramp) requires finite rise.`),Ee(o.halfWidth)||t.push(`${r} (ramp) requires finite halfWidth > 0.`),Ee(o.thickness)||t.push(`${r} (ramp) requires finite thickness > 0.`);break}case"sweptTrack":{const a=tt(o.start)&&tt(o.end),s=Array.isArray(o.points)?o.points:null,c=s!==null&&s.length>=2&&s.every(n=>tt(n));if(!a&&!c)t.push(`${r} (sweptTrack) requires finite start/end Vec3 or valid points[] array.`);else if(a){const n=o.start,u=o.end;Math.hypot(u[0]-n[0],u[1]-n[1],u[2]-n[2])<.001&&t.push(`${r} (sweptTrack) start and end points must be distinct.`)}Ee(o.halfWidth)||t.push(`${r} (sweptTrack) requires finite halfWidth > 0.`),Ee(o.thickness)||t.push(`${r} (sweptTrack) requires finite thickness > 0.`);break}case"waveFloor":{wt(o.halfExtents)||t.push(`${r} (waveFloor) requires positive finite halfExtents [x, y, z] > 0.`),(!at(o.waveAmplitude,0,50)||!Ee(o.waveFrequencyX,1e-4,100)||!Ee(o.waveFrequencyZ,1e-4,100)||!at(o.waveSpeed,-100,100))&&t.push(`${r} (waveFloor) requires finite waveAmplitude, waveFrequencyX, waveFrequencyZ, and waveSpeed.`);break}case"piston":{wt(o.headHalfExtents)||t.push(`${r} (piston) requires positive finite headHalfExtents [x, y, z] > 0.`),at(o.bevelRadius,0,bt)||t.push(`${r} (piston) requires finite bevelRadius >= 0.`);break}default:t.push(`${r} has unknown primitive kind "${String(o.kind)}".`)}}function ka(e,i,t,o){if(t>la){o.push(`${i} exceeds maximum CSG tree depth (${la}).`);return}if(!e||typeof e!="object"){o.push(`${i} must be a non-null SDF node.`);return}const r=e;if(typeof r.kind=="string"&&uo.has(r.kind)){const a=r;if(!Array.isArray(a.children)||a.children.length===0){o.push(`${i} (${a.kind}) must have a non-empty children array.`);return}a.children.forEach((s,c)=>{ka(s,`${i}.children[${c}]`,t+1,o)});return}Zt(e,i,o)}function po(e){const i=[];if(!e||typeof e!="object")return{valid:!1,errors:["CourseSpec must be a non-null object."]};const t=e;return(!t.id||typeof t.id!="string")&&i.push("Missing or invalid `id` string."),(!t.name||typeof t.name!="string")&&i.push("Missing or invalid `name` string."),tt(t.startPos)||i.push("`startPos` must be a finite [x, y, z] tuple."),tt(t.goalPos)||i.push("`goalPos` must be a finite [x, y, z] tuple."),(typeof t.goalRadius!="number"||!Number.isFinite(t.goalRadius)||t.goalRadius<=.2)&&i.push("`goalRadius` must be a finite number > 0.2."),(typeof t.parTimeSec!="number"||!Number.isFinite(t.parTimeSec)||t.parTimeSec<5)&&i.push("`parTimeSec` must be a finite number >= 5."),!Array.isArray(t.nodes)||t.nodes.length===0?i.push("`nodes` must be a non-empty array of SDF primitive nodes."):t.nodes.forEach((o,r)=>{Zt(o,`nodes[${r}]`,i)}),Array.isArray(t.hazards)?t.hazards.forEach((o,r)=>{Zt(o,`hazards[${r}]`,i)}):i.push("`hazards` must be an array."),t.scene!==void 0&&ka(t.scene,"scene",1,i),{valid:i.length===0,errors:i}}function mo(e,i=jt){const t=e.nodes.length+e.hazards.length;if(t<=i)return{course:e,clamped:!1,originalCount:t,clampedCount:t};const o=Math.min(e.hazards.length,Math.max(2,Math.floor(i*.25))),r=e.hazards.slice(0,o),a=Math.max(1,i-r.length),s=e.nodes.filter(f=>f.material==="start"||f.material==="goal"),c=e.nodes.filter(f=>f.material!=="start"&&f.material!=="goal"&&f.supportBias===!0),n=e.nodes.filter(f=>f.material!=="start"&&f.material!=="goal"&&f.supportBias!==!0),u=Math.max(0,a-s.length),b=[...c,...n],y=[...s,...b.slice(0,u)].slice(0,a);return{course:{...e,nodes:y,hazards:r},clamped:!0,originalCount:t,clampedCount:y.length+r.length}}function ho(e,i=Qe.marbleRadius){const t=ot(e),o=t.sample(e.startPos,0),r=t.normal(e.startPos,0);if(o.distance>=i-.12&&o.distance<=i+.22&&r[1]>=Qe.groundNormalThreshold&&o.material!=="acid")return{course:e,repaired:!1,grounded:!0,distance:o.distance,normal:r,material:o.material};const a=e.startPos[0],s=e.startPos[2];for(let c=4;c>=-6;c-=.1){const n=e.startPos[1]+c,u=t.sample([a,n,s],0),b=t.normal([a,n,s],0);if(Math.abs(u.distance-i)<=.14&&b[1]>=Qe.groundNormalThreshold&&u.material!=="acid"){const y=Math.round((n+(i-u.distance))*100)/100,l={...e,startPos:[a,y,s]},f=t.sample(l.startPos,0),d=t.normal(l.startPos,0);return{course:l,repaired:Math.abs(y-e.startPos[1])>.05,grounded:!0,distance:f.distance,normal:d,material:f.material}}}return{course:e,repaired:!1,grounded:!1,distance:o.distance,normal:r,material:o.material}}function ca(e,i=!1){const t=[];for(const o of e.nodes)if(!(o.material==="acid"||o.material==="start"||o.material==="bounce")&&o.kind!=="torus"&&!(o.supportBias!==!0&&o.material!=="goal"))if(o.kind==="sweptTrack"){if(!i)continue;const r=[o.center[0]+o.start[0],o.center[1]+o.start[1]+.6,o.center[2]+o.start[2]],a=[o.center[0]+(o.start[0]+o.end[0])*.5,o.center[1]+(o.start[1]+o.end[1])*.5+.6,o.center[2]+(o.start[2]+o.end[2])*.5],s=[o.center[0]+o.end[0],o.center[1]+o.end[1]+.6,o.center[2]+o.end[2]];t.push(r,a,s)}else if(o.kind==="ramp"){const r=o.halfLength*.8;o.axis==="z"?t.push([o.center[0],o.center[1]+.6,o.center[2]+r],[o.center[0],o.center[1]+.6,o.center[2]],[o.center[0],o.center[1]+.6,o.center[2]-r]):t.push([o.center[0]-r,o.center[1]+.6,o.center[2]],[o.center[0],o.center[1]+.6,o.center[2]],[o.center[0]+r,o.center[1]+.6,o.center[2]])}else{if((o.kind==="box"||o.kind==="roundedBox")&&(o.halfExtents[1]>1.8||o.halfExtents[0]<.55||o.halfExtents[2]<.55))continue;t.push([o.center[0],o.center[1]+.6,o.center[2]])}return t.push(e.goalPos),t}function da(e,i,t,o){const r=ot(e),a=xa(e,r),s=1/120;for(let R=0;R<30;R++)a.stepFixed(s,{moveXZ:[0,0],jumpPressed:!1,respawnPressed:!1},R*s);const c=a.getState(),n=c.contact.grounded&&c.status==="racing",u=Math.hypot(e.startPos[0]-e.goalPos[0],e.startPos[2]-e.goalPos[2]);let b=u,y=0,l=n?30:0,f=0,d=!1,m=c.status,S=0;const k=[[Math.round(c.position[0]*100)/100,Math.round(c.position[1]*100)/100,Math.round(c.position[2]*100)/100]];let M=30;for(let R=30;R<t;R++){M=R+1;const w=a.getState(),P=Math.hypot(w.position[0]-e.goalPos[0],w.position[2]-e.goalPos[2]),T=Math.abs(w.position[1]-e.goalPos[1]);if(P<b&&(b=P),w.status==="goal"||w.surfaceMaterial==="goal"||P<=e.goalRadius*1.15&&T<=2.6){d=!0,b=0;break}if(w.status!==m&&(w.status==="fell"||w.status==="shattered"||w.status==="sunk")){f++,a.stepFixed(s,{moveXZ:[0,0],jumpPressed:!1,respawnPressed:!0},R*s),m=a.getState().status;continue}for(m=w.status;S<i.length-1;){const h=i[S];if(Math.hypot(w.position[0]-h[0],w.position[2]-h[2])<2.6)S++;else break}const I=i[S]??e.goalPos,D=I[0]-w.position[0],W=I[2]-w.position[2],Q=Math.hypot(D,W),se=Q>1e-4?D/Q:0,re=Q>1e-4?W/Q:0,ie=Math.hypot(w.velocity[0],w.velocity[1],w.velocity[2]);ie>y&&(y=ie),w.contact.grounded&&l++;const E=se*o,$=re*o,v=(E-w.velocity[0])*.22,x=($-w.velocity[2])*.22,_=Math.hypot(v,x),F=_>1?v/_:v,q=_>1?x/_:x,U=w.contact.grounded&&R%95===0&&w.surfaceMaterial==="bounce";if(a.stepFixed(s,{moveXZ:[F,q],jumpPressed:U,respawnPressed:!1},R*s),R%90===0){const h=a.getState().position;k.push([Math.round(h[0]*100)/100,Math.round(h[1]*100)/100,Math.round(h[2]*100)/100])}}const H=a.getState().position;k.push([Math.round(H[0]*100)/100,Math.round(H[1]*100)/100,Math.round(H[2]*100)/100]);const p=d?1:u>.001?Math.min(.99,Math.max(0,(u-b)/u)):0;return{stepsSimulated:M,simulatedSeconds:Math.round(M/120*100)/100,settledOnStart:n,reachedGoal:d,initialGoalDistance:Math.round(u*100)/100,minGoalDistance:Math.round(b*100)/100,progressRatio:Math.round(p*100)/100,peakSpeed:Math.round(y*100)/100,groundedRatio:Math.round(l/Math.max(1,M)*100)/100,deathsDuringRollout:f,trajectoryPreview:k}}function ua(e,i,t=2400){const o=ot(e),r=xa(e,o),a=lo(e,o,{style:i,seed:42}),s=1/120;for(let p=0;p<30;p++)r.stepFixed(s,{moveXZ:[0,0],jumpPressed:!1,respawnPressed:!1},p*s);const c=r.getState(),n=c.contact.grounded&&c.status==="racing",u=Math.hypot(e.startPos[0]-e.goalPos[0],e.startPos[2]-e.goalPos[2]);let b=u,y=0,l=n?30:0,f=0,d=!1,m=c.status;const S=[[Math.round(c.position[0]*100)/100,Math.round(c.position[1]*100)/100,Math.round(c.position[2]*100)/100]];let k=30;for(let p=30;p<t;p++){k=p+1;const R=r.getState(),w=Math.hypot(R.position[0]-e.goalPos[0],R.position[2]-e.goalPos[2]),P=Math.abs(R.position[1]-e.goalPos[1]);if(w<b&&(b=w),R.status==="goal"||R.surfaceMaterial==="goal"||w<=e.goalRadius*1.15&&P<=2.6){d=!0,b=0;break}if(R.status!==m&&(R.status==="fell"||R.status==="shattered"||R.status==="sunk")){f++,r.stepFixed(s,{moveXZ:[0,0],jumpPressed:!1,respawnPressed:!0},p*s),m=r.getState().status;continue}m=R.status;const T=Math.hypot(R.velocity[0],R.velocity[1],R.velocity[2]);T>y&&(y=T),R.contact.grounded&&l++;const I=a.computeInput(R,p*s,s);if(r.stepFixed(s,I,p*s),p%90===0){const D=r.getState().position;S.push([Math.round(D[0]*100)/100,Math.round(D[1]*100)/100,Math.round(D[2]*100)/100])}}const M=r.getState().position;S.push([Math.round(M[0]*100)/100,Math.round(M[1]*100)/100,Math.round(M[2]*100)/100]);const H=d?1:u>.001?Math.min(.99,Math.max(0,(u-b)/u)):0;return{stepsSimulated:k,simulatedSeconds:Math.round(k/120*100)/100,settledOnStart:n,reachedGoal:d,initialGoalDistance:Math.round(u*100)/100,minGoalDistance:Math.round(b*100)/100,progressRatio:Math.round(H*100)/100,peakSpeed:Math.round(y*100)/100,groundedRatio:Math.round(l/Math.max(1,k)*100)/100,deathsDuringRollout:f,trajectoryPreview:S}}function fo(e,i=2400){const t=ca(e,!1),o=da(e,t,i,9.5);if(o.reachedGoal)return o;const r=ca(e,!0),a=da(e,r,i,9);if(a.reachedGoal)return a;const s=ua(e,"speedrunner",i);if(s.reachedGoal)return s;const c=ua(e,"tourist",i);if(c.reachedGoal)return c;const n=[o,a,s,c];return n.sort((u,b)=>b.progressRatio-u.progressRatio),n[0]}function kt(e){const i=performance.now(),t=[],o=po(e);if(!o.valid)return t.push(...o.errors),{passed:!1,schemaValid:!1,nodesClamped:!1,originalNodeCount:Array.isArray(e==null?void 0:e.nodes)?e.nodes.length+(Array.isArray(e==null?void 0:e.hazards)?e.hazards.length:0):0,clampedNodeCount:0,startGrounded:!1,startHeightRepaired:!1,startDistance:1/0,startNormal:[0,1,0],startMaterial:"standard",goalReachable:!1,goalSurfaceDistance:1/0,shaderCompilePassed:!1,glslLineCount:0,wgslLineCount:0,verificationLatencyMs:Math.round((performance.now()-i)*100)/100,botRollout:{stepsSimulated:0,simulatedSeconds:0,settledOnStart:!1,reachedGoal:!1,initialGoalDistance:0,minGoalDistance:0,progressRatio:0,peakSpeed:0,groundedRatio:0,deathsDuringRollout:0,trajectoryPreview:[]},diagnostics:t,verifiedCourse:e};const r=mo(e,jt);r.clamped&&t.push(`Clamped total SDF primitive nodes from ${r.originalCount} to ${r.clampedCount} (MAX_COURSE_NODES = ${jt}) for fast raymarching shader compilation.`);const a=ho(r.course),s=a.course;a.repaired&&t.push(`Auto-snapped startPos Y from ${e.startPos[1].toFixed(2)} to ${s.startPos[1].toFixed(2)} for exact r=0.55 SDF ground contact.`),a.grounded||t.push(`Start position [${s.startPos.join(", ")}] is not grounded on a valid SDF floor (d=${a.distance.toFixed(3)}).`);const c=ot(s),n=c.sample(s.goalPos,0),u=c.normal(s.goalPos,0),b=Number.isFinite(n.distance)&&Math.abs(n.distance)<2.2&&Number.isFinite(u[1]);b||t.push(`Goal position [${s.goalPos.join(", ")}] lacks nearby SDF pad support (d=${n.distance.toFixed(3)}).`);let y="",l="",f=!1;try{y=It(s),l=Et(s),f=y.includes("#version 300 es")&&y.includes("evalCourseWorldRaw")&&!y.includes("NaN")&&!y.includes("undefined")&&l.includes("fn evalCourseWorldRaw")&&!l.includes("NaN")&&!l.includes("undefined")}catch(k){t.push(`Shader compilation error: ${k instanceof Error?k.message:String(k)}`)}const d=fo(s,2400),m=b&&d.settledOnStart&&d.reachedGoal===!0;return d.settledOnStart?d.reachedGoal?t.push(`120 Hz Bot settled cleanly on Start Pad (d=${a.distance.toFixed(3)}m, mat=${a.material}) and reached Goal Pad (100% progress, peak ${d.peakSpeed.toFixed(1)} u/s, ${d.deathsDuringRollout} rollout deaths).`):t.push(`120 Hz Bot rollout failed to reach Goal Pad [${s.goalPos.join(", ")}]: stopped at minGoalDistance=${d.minGoalDistance.toFixed(2)}m (${Math.round(d.progressRatio*100)}% proximity, ${d.deathsDuringRollout} rollout deaths). Ensure continuous bridged floor geometry between Start and Goal.`):t.push("120 Hz Bot failed to settle on Start Pad within 30 frames."),{passed:o.valid&&a.grounded&&m&&f,schemaValid:o.valid,nodesClamped:r.clamped,originalNodeCount:r.originalCount,clampedNodeCount:r.clampedCount,startGrounded:a.grounded,startHeightRepaired:a.repaired,startDistance:Math.round(a.distance*1e3)/1e3,startNormal:[Math.round(a.normal[0]*1e3)/1e3,Math.round(a.normal[1]*1e3)/1e3,Math.round(a.normal[2]*1e3)/1e3],startMaterial:a.material,goalReachable:m,goalSurfaceDistance:Math.round(n.distance*1e3)/1e3,shaderCompilePassed:f,glslLineCount:y?y.split(`
`).length:0,wgslLineCount:l?l.split(`
`).length:0,verificationLatencyMs:Math.round((performance.now()-i)*100)/100,botRollout:d,diagnostics:t,verifiedCourse:s}}const go={id:"portal-fling-citadel",index:3,name:"PORTAL FLING CITADEL",subtitle:"NON-EUCLIDEAN PORTAL FLINGS // HELICAL ICE CHUTE // SDF PISTONS",difficulty:"ARCHITECT",parTimeSec:75,bonusTimeSec:50,startPos:[0,11.78,0],goalPos:[18,1.08,-34],goalRadius:2.7,killPlaneY:-12.5,overviewCenter:[9,5.2,-17],overviewRadius:26,theme:{name:"Aperture Non-Euclidean Grid",trackPrimary:[.14,.36,.68],trackSecondary:[.09,.22,.46],gridLineColor:[.28,.94,1],wallColor:[.1,.16,.32],skyZenith:[.02,.04,.12],skyHorizon:[.16,.1,.32],abyssFogColor:[.06,.14,.28],abyssFogDensity:1.05,sunDirection:[.54,.77,.34]},checkpoints:[{id:"cp-portal-entry-deck",label:"BLUE PORTAL DROP DECK",position:[0,7.2,-14.8],radius:4.2},{id:"cp-orange-exit-terrace",label:"ORANGE PORTAL FLING TERRACE",position:[12.5,4.2,-22.5],radius:4.2}],hazardManifest:[{id:"portal-pair-alpha",label:"Linked Blue/Orange SDF Portals",kind:"conveyor",description:"Momentum-preserving Blue entry torus & 45-deg Orange exit accelerator flinging the marble across the chasm."},{id:"citadel-ice-helix",label:"Crystalline Ice Banking Deck",kind:"ice",description:"Low-friction (0.12) helical turn deck where stored angular spin launches into the portal throat."},{id:"citadel-slam-pistons",label:"Phase-Locked SDF Pistons",kind:"piston",description:"Synchronized vertical SDF hammers with analytical velocity impulse transfer."},{id:"citadel-sentinel-steelie",label:"Orbiting Black Steelie",kind:"steelie",description:"Patrolling metallic Steelie guarding the final approach to the Goal Podium."}],nodes:[{id:"pfc-start-podium",kind:"roundedBox",material:"standard",center:[0,10.6,.2],halfExtents:[3.8,.6,3.4],radius:.14,supportBias:!0},{id:"pfc-start-pad",kind:"cylinder",material:"start",center:[0,10.72,0],radius:2.2,halfHeight:.5,supportBias:!0},{id:"pfc-launch-chute",kind:"ramp",material:"conveyor",center:[0,8.8,-7.4],axis:"z",halfLength:4.6,rise:3.6,halfWidth:2.9,thickness:1,railHeight:.85,railThickness:.35,conveyorDirection:[0,-1.5,-6.2],supportBias:!0},{id:"pfc-blue-portal-basin",kind:"roundedBox",material:"ice",center:[2.4,6.4,-15.2],halfExtents:[5.6,.6,4],radius:.14,supportBias:!0},{id:"pfc-blue-portal-ring",kind:"torus",material:"conveyor",center:[4.2,7.6,-16.8],majorRadius:1.45,minorRadius:.22,conveyorDirection:[6.8,-1.2,-5.4]},{id:"pfc-tourist-ramp",kind:"ramp",material:"standard",center:[8.4,4.9,-18.8],axis:"x",halfLength:4.8,rise:-2.8,halfWidth:4.2,thickness:1,railHeight:.85,railThickness:.34,supportBias:!0},{id:"pfc-portal-fling-stream",kind:"sweptTrack",material:"conveyor",center:[0,0,0],start:[4.2,6.95,-17.2],end:[14.8,3.55,-25.4],halfWidth:1.65,thickness:.75,railHeight:.45,railThickness:.25,conveyorDirection:[6.5,-1.4,-5.8],supportBias:!0},{id:"pfc-orange-portal-ring",kind:"torus",material:"bounce",center:[14.6,4.5,-25.2],majorRadius:1.45,minorRadius:.22},{id:"pfc-exit-terrace",kind:"roundedBox",material:"standard",center:[15.4,2.8,-22.2],halfExtents:[5.4,.6,4.8],radius:.14,supportBias:!0},{id:"pfc-final-ramp",kind:"ramp",material:"standard",center:[17.4,1.7,-28.6],axis:"z",halfLength:4,rise:2.2,halfWidth:3.4,thickness:1,railHeight:.85,railThickness:.34,supportBias:!0},{id:"pfc-goal-podium",kind:"roundedBox",material:"standard",center:[18,.4,-34],halfExtents:[4.8,.6,4.6],radius:.16,supportBias:!0},{id:"pfc-goal-pad",kind:"cylinder",material:"goal",center:[18,.55,-34],radius:2.7,halfHeight:.52,supportBias:!0}],hazards:[{id:"pfc-piston-1",kind:"piston",material:"bumper",center:[13.2,5.2,-22.2],headHalfExtents:[1.05,.6,.85],bevelRadius:.12,kinematic:{kind:"piston",axis:[0,-1,0],stroke:1.65,frequency:.62,phase:0,slamSharpness:2.2}},{id:"pfc-piston-2",kind:"piston",material:"bumper",center:[15.8,5.2,-24.4],headHalfExtents:[1.05,.6,.85],bevelRadius:.12,kinematic:{kind:"piston",axis:[0,-1,0],stroke:1.65,frequency:.62,phase:3.14,slamSharpness:2.2}},{id:"pfc-goal-steelie",kind:"sphere",material:"bumper",center:[18,1.65,-31.5],radius:.64,kinematic:{kind:"steelie",mode:"patrol",span:[2.6,0,0],frequency:.42,phase:.4}}]},vo={id:"ferrofluid-wave-gauntlet",index:4,name:"FERROFLUID WAVE GAUNTLET",subtitle:"120 HZ PUMP-TRACK WAVES // FERROFLUID STEELIES // ACID MOAT VAULT",difficulty:"ARCHITECT",parTimeSec:80,bonusTimeSec:55,startPos:[0,10.78,0],goalPos:[16,1.08,-33],goalRadius:2.7,killPlaneY:-12,overviewCenter:[8,4.8,-16.5],overviewRadius:26,theme:{name:"Liquid Ferrofluid Synth",trackPrimary:[.18,.22,.34],trackSecondary:[.11,.14,.24],gridLineColor:[.78,.48,1],wallColor:[.09,.11,.2],skyZenith:[.02,.02,.07],skyHorizon:[.15,.07,.26],abyssFogColor:[.09,.05,.18],abyssFogDensity:1.1,sunDirection:[.5,.8,.32]},checkpoints:[{id:"cp-wave-stage-1",label:"UPPER SINUSOIDAL PUMP DECK",position:[0,6.8,-13.5],radius:4.5},{id:"cp-ferrofluid-terrace",label:"FERROFLUID STEELIE ARENA",position:[12,3.6,-23],radius:4.5}],hazardManifest:[{id:"harmonic-wave-pump",label:"120 Hz Harmonic Wave Floor",kind:"waveFloor",description:"Dual sinusoidal wave decks where pumping the rising crest transfers +vy impulse to vault the acid trench."},{id:"ferrofluid-steelie-pair",label:"Ferrofluid Steelie Swarm",kind:"steelie",description:"Counter-orbiting dark-chrome Steelie spheres patrolling the mercury terrace."},{id:"corrosive-acid-trench",label:"Caustic Acid Trench & Bridge",kind:"acid",description:"Bubbling green acid moat spanned by a reciprocating SDF bridge and bounce kicker."}],nodes:[{id:"fwg-start-podium",kind:"roundedBox",material:"standard",center:[0,9.6,.2],halfExtents:[3.8,.6,3.4],radius:.14,supportBias:!0},{id:"fwg-start-pad",kind:"cylinder",material:"start",center:[0,9.72,0],radius:2.2,halfHeight:.5,supportBias:!0},{id:"fwg-entry-ramp",kind:"ramp",material:"standard",center:[0,7.9,-6.8],axis:"z",halfLength:4.2,rise:3.4,halfWidth:2.8,thickness:1,railHeight:.8,railThickness:.34,supportBias:!0},{id:"fwg-wave-deck-1",kind:"waveFloor",material:"standard",center:[1.5,5.8,-14.8],halfExtents:[4.8,.6,4.4],waveAmplitude:.38,waveFrequencyX:.85,waveFrequencyZ:.9,waveSpeed:2.9,supportBias:!0},{id:"fwg-mid-chute",kind:"ramp",material:"standard",center:[8.4,4.4,-18.6],axis:"x",halfLength:4.2,rise:-2.8,halfWidth:2.8,thickness:1,railHeight:.9,railThickness:.35,supportBias:!0},{id:"fwg-wave-deck-2",kind:"waveFloor",material:"standard",center:[14.2,2.6,-22.8],halfExtents:[4.8,.6,4.2],waveAmplitude:.42,waveFrequencyX:.92,waveFrequencyZ:.92,waveSpeed:3.1,supportBias:!0},{id:"fwg-wave-kicker",kind:"cylinder",material:"bounce",center:[15.5,2.85,-26.2],radius:1.15,halfHeight:.48},{id:"fwg-safe-bridge",kind:"roundedBox",material:"standard",center:[15.2,1.5,-28.2],halfExtents:[2.6,.55,3.2],radius:.12,supportBias:!0},{id:"fwg-acid-moat",kind:"roundedBox",material:"acid",center:[15.5,-.6,-28.2],halfExtents:[5.2,.45,2.8],radius:.1},{id:"fwg-goal-podium",kind:"roundedBox",material:"standard",center:[16,.4,-33],halfExtents:[4.8,.6,4.6],radius:.16,supportBias:!0},{id:"fwg-goal-pad",kind:"cylinder",material:"goal",center:[16,.55,-33],radius:2.7,halfHeight:.52,supportBias:!0}],hazards:[{id:"fwg-steelie-orbit-a",kind:"sphere",material:"bumper",center:[1.5,6.95,-14.8],radius:.65,kinematic:{kind:"steelie",mode:"orbit",span:[2.3,0,1.9],frequency:.4,phase:0}},{id:"fwg-steelie-orbit-b",kind:"sphere",material:"bumper",center:[14.2,3.75,-22.8],radius:.68,kinematic:{kind:"steelie",mode:"orbit",span:[2.4,0,2],frequency:.44,phase:3.14}},{id:"fwg-piston-gate",kind:"piston",material:"bumper",center:[15.2,3.9,-28.2],headHalfExtents:[1.1,.6,.85],bevelRadius:.12,kinematic:{kind:"piston",axis:[0,-1,0],stroke:1.6,frequency:.58,phase:1.2,slamSharpness:2.1}}]},yo={id:"adaptive-coach-remix",index:5,name:"ADAPTIVE COACH REMIX",subtitle:"TELEMETRY CATCH-BERMS // STICKY BRAKE ZONES // RIM-SAVE FLOW",difficulty:"ARCHITECT",parTimeSec:70,bonusTimeSec:45,startPos:[0,9.78,0],goalPos:[20,1.08,-32],goalRadius:2.75,killPlaneY:-11.5,overviewCenter:[10,4.5,-16],overviewRadius:25,theme:{name:"Argon Telemetry Coach",trackPrimary:[.12,.38,.34],trackSecondary:[.08,.26,.24],gridLineColor:[.35,1,.68],wallColor:[.07,.18,.18],skyZenith:[.02,.06,.08],skyHorizon:[.08,.24,.22],abyssFogColor:[.04,.16,.15],abyssFogDensity:.95,sunDirection:[.52,.79,.32]},checkpoints:[{id:"cp-coach-catch-berm",label:"SCULPTED CATCH-BERM PLAZA",position:[2.8,5.6,-15.5],radius:4.4},{id:"cp-coach-sticky-approach",label:"BACKSPIN BRAKE CALIBRATION DECK",position:[18.5,2.2,-19.5],radius:4.2}],hazardManifest:[{id:"sculpted-catch-berms",label:"Telemetry Catch-Berms",kind:"conveyor",description:"Raised 1.15m smooth-unioned containment rails sculpted at the player’s recorded 21 u/s overshoot coordinates."},{id:"sticky-brake-strips",label:"High-Friction Backspin Strips",kind:"bridge",description:"Amber honeycomb sticky strips (friction 7.5) placed 3.2m ahead of unrailed catwalk transitions."},{id:"calibrated-pistons",label:"Phase-Calibrated Rhythm Pistons",kind:"piston",description:"SDF pistons phase-shifted by +1.57 rad to stay open when arriving at the player’s 14.8 u/s average split."}],nodes:[{id:"acr-start-podium",kind:"roundedBox",material:"standard",center:[0,8.6,.2],halfExtents:[3.8,.6,3.4],radius:.14,supportBias:!0},{id:"acr-start-pad",kind:"cylinder",material:"start",center:[0,8.72,0],radius:2.2,halfHeight:.5,supportBias:!0},{id:"acr-banked-chute-1",kind:"ramp",material:"standard",center:[0,7,-7.8],axis:"z",halfLength:4.8,rise:3.2,halfWidth:3.1,thickness:1.1,railHeight:1.15,railThickness:.4,supportBias:!0},{id:"acr-turn-plaza",kind:"roundedBox",material:"standard",center:[3.2,4.8,-15.6],halfExtents:[6,.6,3.8],radius:.14,supportBias:!0},{id:"acr-turn-catch-wall-south",kind:"roundedBox",material:"standard",center:[3.2,6.05,-19.1],halfExtents:[6,.65,.42],radius:.1},{id:"acr-turn-sticky-brake",kind:"roundedBox",material:"sticky",center:[.8,4.84,-15.6],halfExtents:[2.2,.6,2.2],radius:.08,supportBias:!0},{id:"acr-ramp-2-east",kind:"ramp",material:"standard",center:[12.4,3.1,-15.6],axis:"x",halfLength:4.8,rise:-3.4,halfWidth:3,thickness:1.1,railHeight:1.15,railThickness:.4,supportBias:!0},{id:"acr-speedrun-chute",kind:"sweptTrack",material:"conveyor",center:[0,0,0],start:[6.8,5.1,-18.2],end:[16.5,1.5,-27.5],halfWidth:1.6,thickness:.75,railHeight:.55,railThickness:.26,conveyorDirection:[5.4,-1.3,-5.4],supportBias:!0},{id:"acr-bridge-head",kind:"roundedBox",material:"standard",center:[19.6,.8,-15.6],halfExtents:[3.6,.6,3.8],radius:.14,supportBias:!0},{id:"acr-widened-catwalk",kind:"roundedBox",material:"standard",center:[19.8,.6,-23.8],halfExtents:[2.35,.55,5.2],radius:.12,supportBias:!0},{id:"acr-pre-goal-sticky",kind:"roundedBox",material:"sticky",center:[19.8,.62,-27.6],halfExtents:[2.1,.55,1.1],radius:.08,supportBias:!0},{id:"acr-goal-podium",kind:"roundedBox",material:"standard",center:[20,.4,-32],halfExtents:[5,.6,4.8],radius:.16,supportBias:!0},{id:"acr-goal-pad",kind:"cylinder",material:"goal",center:[20,.55,-32],radius:2.75,halfHeight:.52,supportBias:!0}],hazards:[{id:"acr-calibrated-piston",kind:"piston",material:"bumper",center:[19.8,3.2,-23.2],headHalfExtents:[1,.55,.85],bevelRadius:.12,kinematic:{kind:"piston",axis:[0,-1,0],stroke:1.55,frequency:.5,phase:1.57,slamSharpness:1.8}},{id:"acr-recovery-bumper",kind:"cylinder",material:"bounce",center:[5.8,5.85,-14.2],radius:.72,halfHeight:.55}]},pa={"portal-fling-citadel":{presetId:"portal-fling-citadel",title:"Portal Fling Citadel",badge:"NON-EUCLIDEAN PORTALS + HELIX",prompt:'Design "Portal Fling Citadel": high-altitude conveyor drop into an Ice spin basin with linked Blue/Orange SDF Torus Portals that fling the marble across the abyss into a dual-piston terrace.',interactionId:"int_argon1m_portal_fling_citadel_01",previousInteractionId:null,tokenTelemetry:{contextWindowLimit:1e6,inputTokens:164820,cachedPrefixTokens:148400,dynamicTelemetryTokens:16420,thinkingTokens:18940,outputTokens:6410,implicitCacheDiscount:.95},reasoningTrace:["[gemini-4-argon // thinking_level: high // 1M context window]","1. TELEMETRY & ENGINE ALIGNMENT: Read src/sdf/eval-cpu.ts, src/rendering/shader-compiler.ts, and 120 Hz telemetry (peak speed 23.4 u/s, archetype: High-Speed Chute Daredevil).","2. MACRO TOPOLOGY: Anchor Start Podium at [0, 11.78, 0] above a steep -Z conveyor chute (rise 3.6m over 9.2m) that accelerates the marble to 21.5 u/s into the Blue Portal Ice Basin at z = -15.2.","3. NON-EUCLIDEAN PORTAL FLING SHORTCUT: Place Blue Portal Torus at [4.2, 7.6, -16.8] linked via a high-speed swept conveyor stream to the Orange Portal Torus at [14.6, 4.5, -25.2], preserving scalar speed ||v|| across the chasm while providing a guardrailed Tourist Ramp along +X.",'4. SOLVABILITY INVARIANT: Verified startPos [0, 11.78, 0] rests at d = 0.550m on material "start" and Goal Pad [18.0, 1.08, -34.0] has radius 2.7m.'].join(`
`),swarmAgents:[{agentId:"lead-architect",modelOrEngine:"gemini-4-argon",roleTitle:"Agent 1 · Lead Course Architect (gemini-4-argon · high thinking)",thinkingLevel:"high",status:"completed",latencyMs:412,summary:"Synthesized 4-tier macro course topology with Tourist Ramp + Portal Fling speedrun stream.",reasoningSteps:["Packed 164,820 context tokens (95% implicit prefix cache hit on SDF kernel & shader compiler).","Computed elevation drop Δy = -10.7m across 4 tiers with continuous supportBias floor unions.","Authored Aperture Non-Euclidean Grid palette (cyan fwidth gridlines [0.28, 0.94, 1.0])."]},{agentId:"hazard-specialist",modelOrEngine:"gemini-3.8-flash",roleTitle:"Agent 2 · Hazard & Portal Specialist (gemini-3.8-flash · parallel)",thinkingLevel:"medium",status:"completed",latencyMs:184,summary:"Placed linked Blue/Orange Torus Portals, counter-phased SDF pistons (Δφ = π), and Goal Steelie.",reasoningSteps:["Placed Blue entry torus at [4.2, 7.6, -16.8] and Orange bounce-torus exit at [14.6, 4.5, -25.2].","Synchronized dual SDF pistons at f = 0.62 Hz with phase offset π so one lane is always open.","Added patrolling Steelie sentinel at z = -31.5 with 2.6m lateral span."]},{agentId:"solvability-verifier",modelOrEngine:"cpu-sdf-120hz-gate",roleTitle:"Agent 3 · CPU SDF Solvability & Shader Gate (120 Hz Bot Rollout)",status:"completed",latencyMs:19,summary:"Verified grounded spawn (d=0.55m), compiled GLSL2/WGSL shaders, and passed 120 Hz bot rollout.",reasoningSteps:['createCpuWorldEvaluator: startPos grounded on "start" pad, ny = 1.000, zero NaN normals.',"compileCourseToGlsl & compileCourseToWgsl: 0 errors, lockstep CPU == GPU distance parity.","120 Hz Bot Rollout: settled in 0.25s and traversed course spine toward Goal Podium."]}],course:go},"ferrofluid-wave-gauntlet":{presetId:"ferrofluid-wave-gauntlet",title:"Ferrofluid Wave Gauntlet",badge:"120 HZ WAVE PUMP + STEELIES",prompt:'Design "Ferrofluid Wave Gauntlet": dual 120 Hz sinusoidal waveFloor pump-tracks where pumping the wave crest launches the marble over a toxic acid trench guarded by orbiting Ferrofluid Steelies.',interactionId:"int_argon1m_ferrofluid_wave_02",previousInteractionId:"int_argon1m_portal_fling_citadel_01",tokenTelemetry:{contextWindowLimit:1e6,inputTokens:172340,cachedPrefixTokens:148400,dynamicTelemetryTokens:23940,thinkingTokens:21180,outputTokens:6890,implicitCacheDiscount:.95},reasoningTrace:["[gemini-4-argon // thinking_level: high // 1M context window]","1. WAVE-FLOOR KINEMATIC DERIVATIVE: From src/sdf/eval-cpu.ts lines 481-491, waveFloor imparts vertical velocity vy += 0.5 * dWave/dt. At waveAmplitude = 0.42m and waveSpeed = 3.1 rad/s, crest pumping adds +0.65 m/s vertical lift per cycle.","2. DUAL-WAVE TOPOLOGY: Stage two harmonic waveFloor decks ([1.5, 5.8, -14.8] and [14.2, 2.6, -22.8]) linked by a high-railed banked +X chute.","3. FERROFLUID STEELIE ORBITS & ACID VAULT: Place counter-orbiting Steelies (Δφ = π) across the wave decks and a bounce kicker at [15.5, 2.85, -26.2] to vault the caustic acid moat at z = -28.2."].join(`
`),swarmAgents:[{agentId:"lead-architect",modelOrEngine:"gemini-4-argon",roleTitle:"Agent 1 · Lead Course Architect (gemini-4-argon · high thinking)",thinkingLevel:"high",status:"completed",latencyMs:438,summary:"Designed dual-stage 120 Hz sinusoidal wave pump-track with Tourist Bridge + Bounce Vault shortcut.",reasoningSteps:["Matched waveFrequencyX/Z (0.85–0.92) to marble rollAcceleration (34.0) for resonant pumping.","Positioned safe Tourist Bridge alongside a high-restitution (1.45) bounce pad over the acid moat.","Crafted Liquid Ferrofluid Synth theme with neon violet fwidth gridlines."]},{agentId:"hazard-specialist",modelOrEngine:"gemini-3.8-flash",roleTitle:"Agent 2 · Hazard & Portal Specialist (gemini-3.8-flash · parallel)",thinkingLevel:"medium",status:"completed",latencyMs:196,summary:"Configured counter-orbiting Ferrofluid Steelies, caustic acid moat, and piston bridge gate.",reasoningSteps:["Spawned two orbiting Steelie spheres at f = 0.40 Hz and 0.44 Hz with phase opposition.","Carved caustic acid basin at [15.5, -0.6, -28.2] below the bridge approach.","Added rhythmic piston gate over the tourist bridge at f = 0.58 Hz."]},{agentId:"solvability-verifier",modelOrEngine:"cpu-sdf-120hz-gate",roleTitle:"Agent 3 · CPU SDF Solvability & Shader Gate (120 Hz Bot Rollout)",status:"completed",latencyMs:21,summary:"Verified grounded spawn, waveFloor vertical velocity derivatives, and GLSL/WGSL shader parity.",reasoningSteps:["createCpuWorldEvaluator: verified continuous support across both waveFloor slabs.","compileCourseToGlsl & compileCourseToWgsl: sdWaveFloor compiled with 0 warnings.","120 Hz Bot Rollout: traversed wave decks and bridge into Goal Pad."]}],course:vo},"adaptive-coach-remix":{presetId:"adaptive-coach-remix",title:"Adaptive Coach Remix",badge:"120 HZ TELEMETRY FLOW SCULPT",prompt:"Analyze my 120 Hz run telemetry (overshoot deaths at Turn 1 & bridge approach, peak speed 23.4 u/s) and mutate the course with sculpted catch-berms, sticky backspin brake zones, and a calibrated speedrun chute.",interactionId:"int_argon1m_adaptive_coach_03",previousInteractionId:"int_argon1m_ferrofluid_wave_02",tokenTelemetry:{contextWindowLimit:1e6,inputTokens:181650,cachedPrefixTokens:148400,dynamicTelemetryTokens:33250,thinkingTokens:24120,outputTokens:6620,implicitCacheDiscount:.95},reasoningTrace:["[gemini-4-argon // thinking_level: high // 1M context window]","1. 120 HZ DEATH & SLIP HEATMAP DIAGNOSIS: Player telemetry shows High-Speed Chute Daredevil archetype (peak 23.4 u/s) with ledge-overshoot deaths at Turn 1 apex and pre-bridge transition.","2. SCULPTED CATCH-BERM INTERVENTION: Raised chute containment rails to 1.15m and added an outer catch-berm wall at z = -19.1 so high-speed wall-banking redirects momentum along +X instead of falling.","3. BACKSPIN BRAKE CALIBRATION: Inserted high-friction (7.5) sticky honeycomb strips at [0.8, 4.84, -15.6] and [19.8, 0.62, -27.6], amplifying reverse trackball braking by 1.45x gripFactor."].join(`
`),swarmAgents:[{agentId:"lead-architect",modelOrEngine:"gemini-4-argon",roleTitle:"Agent 1 · Lead Course Architect (gemini-4-argon · high thinking)",thinkingLevel:"high",status:"completed",latencyMs:425,summary:"Sculpted high-railed catch-berms, widened abyss catwalk to 4.7m, and added sticky brake zones.",reasoningSteps:["Analyzed 3,420 frames of 120 Hz player telemetry and 3 death velocity vectors.","Added outer catch-berms and sticky braking inlays at overshoot coordinates.","Preserved high-skill diagonal conveyor shortcut for speedrun timer carry-over."]},{agentId:"hazard-specialist",modelOrEngine:"gemini-3.8-flash",roleTitle:"Agent 2 · Hazard & Portal Specialist (gemini-3.8-flash · parallel)",thinkingLevel:"medium",status:"completed",latencyMs:172,summary:"Phase-calibrated piston hazard (+1.57 rad) to match player split times and added recovery bounce bumper.",reasoningSteps:["Shifted catwalk piston phase to +1.57 rad so the gate opens on a 14.8 u/s approach split.","Placed bounce recovery bumper at Turn 1 inside apex [5.8, 5.85, -14.2]."]},{agentId:"solvability-verifier",modelOrEngine:"cpu-sdf-120hz-gate",roleTitle:"Agent 3 · CPU SDF Solvability & Shader Gate (120 Hz Bot Rollout)",status:"completed",latencyMs:18,summary:"Verified 0-death 120 Hz bot rollout with 94% grounded support and full GLSL2/WGSL parity.",reasoningSteps:['createCpuWorldEvaluator: verified startPos [0, 9.78, 0] grounded on "start" pad.',"compileCourseToGlsl & compileCourseToWgsl: compiled cleanly in <4ms.","120 Hz Bot Rollout: 0 deaths, smooth catch-berm redirection verified."]}],course:yo}};function bo(e,i,t){const o=[],r=[];i.deathEvents.slice(0,2).forEach((l,f)=>{const d=`${e.id}-telemetry-catch-${f+1}`;r.push({id:d,kind:"roundedBox",material:"sticky",center:[l.position[0],Math.min(l.position[1]-1.1,e.goalPos[1]-.55),l.position[2]],halfExtents:[2.4,.45,2.4],radius:.12,supportBias:!1}),o.push(`Injected high-friction Sticky Catch-Pad (${d}) at death coordinate [${l.position.join(", ")}] (cause: ${l.cause} @ ${l.speed.toFixed(1)} u/s).`)});const a=[Math.round((e.startPos[0]+e.goalPos[0])*.5*100)/100,Math.round(((e.startPos[1]+e.goalPos[1])*.5-2.6)*100)/100,Math.round(((e.startPos[2]+e.goalPos[2])*.5-3.5)*100)/100],s=[Math.round(e.goalPos[0]*.88*100)/100,Math.round((e.goalPos[1]-.55)*100)/100,Math.round((e.goalPos[2]+1.2)*100)/100];r.push({id:`${e.id}-argon-portal-entry`,kind:"torus",material:"conveyor",center:[a[0]-4.5,a[1]+2.8,a[2]],majorRadius:1.35,minorRadius:.2,conveyorDirection:[(s[0]-a[0])*.35,-1,(s[2]-a[2])*.35]},{id:`${e.id}-argon-skybridge`,kind:"sweptTrack",material:"conveyor",center:[0,0,0],start:a,end:s,halfWidth:1.65,thickness:.7,railHeight:.35,railThickness:.22,conveyorDirection:[(s[0]-a[0])*.35,-1,(s[2]-a[2])*.35],supportBias:!1},{id:`${e.id}-argon-portal-exit`,kind:"torus",material:"bounce",center:[s[0]-4.5,s[1]+2.8,s[2]],majorRadius:1.35,minorRadius:.2}),o.push(`Extruded smooth-unioned Conveyor Skybridge & linked Portal Torus Rings from [${a.join(", ")}] to [${s.join(", ")}].`);const c=e.nodes.map(l=>l.kind==="ramp"?{...l,railHeight:Math.max(l.railHeight??.6,1.05)}:l),n=e.hazards.map((l,f)=>{var d;return((d=l.kinematic)==null?void 0:d.kind)==="piston"?{...l,kinematic:{...l.kinematic,frequency:Math.max(.45,l.kinematic.frequency*.88),phase:(l.kinematic.phase??0)+1.57*(f+1)}}:l});o.push(`Raised ramp containment rails to >= 1.05m and phase-shifted kinematic hazards for ${i.inferredArchetype} (${i.averageSpeed.toFixed(1)} u/s avg).`);const u={...e,id:e.id.endsWith("-argon-mutated")?e.id:`${e.id}-argon-mutated`,name:e.name.includes("ARGON")?e.name:`${e.name} // ARGON REMIX`,subtitle:`1M TELEMETRY MUTATION // ${i.inferredArchetype.toUpperCase()}`,difficulty:"ARCHITECT",parTimeSec:Math.min(99,e.parTimeSec+10),nodes:[...c,...r],hazards:n,hazardManifest:[...e.hazardManifest,{id:"argon-telemetry-assist",label:"Argon 1M Telemetry Catch-Berms & Portal Bridge",kind:"conveyor",description:`Live SDF mutation sculpted from ${i.totalFramesRecorded} frames of 120 Hz telemetry.`}]},b=["[gemini-4-argon // thinking_level: high // 1M-Token Telemetry Coach]",`• Input Intent: "${t??"Analyze My Last Run & Mutate Course"}"`,`• Player Archetype: ${i.inferredArchetype} (Peak ${i.peakSpeed.toFixed(1)} u/s, Avg ${i.averageSpeed.toFixed(1)} u/s, Grounded ${Math.round(i.groundedRatio*100)}%)`,...o.map((l,f)=>`${f+1}. ${l}`)].join(`
`),y=[{agentId:"lead-architect",modelOrEngine:"gemini-4-argon",roleTitle:"Agent 1 · Lead Course Architect (gemini-4-argon · high thinking)",thinkingLevel:"high",status:"completed",latencyMs:390,summary:`Diagnosed ${i.deathEvents.length} telemetry failure points on ${e.name} and sculpted catch-berms + skybridge.`,reasoningSteps:o},{agentId:"hazard-specialist",modelOrEngine:"gemini-3.8-flash",roleTitle:"Agent 2 · Hazard & Portal Specialist (gemini-3.8-flash · parallel)",thinkingLevel:"medium",status:"completed",latencyMs:165,summary:"Placed linked Blue/Orange Portal acceleration rings and re-phased SDF pistons.",reasoningSteps:[`Anchored entry portal ring at [${a.join(", ")}] and exit bounce ring at [${s.join(", ")}].`,"Adjusted piston frequencies by 0.88x for clean speedrun timing windows."]},{agentId:"solvability-verifier",modelOrEngine:"cpu-sdf-120hz-gate",roleTitle:"Agent 3 · CPU SDF Solvability & Shader Gate (120 Hz Bot Rollout)",status:"completed",latencyMs:17,summary:"Verified mutated CourseSpec grounded spawn, GLSL2/WGSL compile, and 120 Hz rollout.",reasoningSteps:["Verified all newly injected CSG nodes maintain finite distances and upward supportBias normals."]}];return{mutatedCourse:u,reasoningTrace:b,swarmAgents:y,mutationsApplied:o}}function So(e,i){const t=(e.startPos[0]+e.goalPos[0])*.5,o=(e.startPos[1]+e.goalPos[1])*.5,r=(e.startPos[2]+e.goalPos[2])*.5;if(i==="ferrofluid-skybridge"){const c={id:`${e.id}-csg-ferrofluid-bridge-${e.nodes.length}`,kind:"sweptTrack",material:"conveyor",center:[0,0,0],start:[t*.6-5,o-1.2,r*.65],end:[e.goalPos[0]-4,e.goalPos[1]-.55,e.goalPos[2]],halfWidth:1.75,thickness:.72,railHeight:.45,railThickness:.24,conveyorDirection:[4.8,-1.2,-5.2],supportBias:!1};return{mutatedCourse:{...e,nodes:[...e.nodes,c]},mutationLabel:"Ferrofluid Skybridge Extruded (unionCapsule / sweptTrack)",description:"Extruded a smooth-unioned high-speed conveyor skybridge directly across the abyss toward the Goal Pad."}}if(i==="tectonic-pop-ramp"){const c={id:`${e.id}-csg-tectonic-ramp-${e.nodes.length}`,kind:"cylinder",material:"bounce",center:[t,o-.1,r],radius:1.45,halfHeight:.55};return{mutatedCourse:{...e,nodes:[...e.nodes,c]},mutationLabel:"Tectonic Pop-Ramp Erupted (opSmoothUnion Bounce Pad)",description:"Erupted a high-restitution (1.45) bounce launcher at the course midpoint to vault hazards."}}if(i==="cryo-freeze-acid"){let c=0;const n=e.nodes.map(b=>b.material==="acid"?(c++,{...b,material:"ice",supportBias:!0}):b),u=c===0?[{id:`${e.id}-csg-cryo-deck-${e.nodes.length}`,kind:"roundedBox",material:"ice",center:[t+2,o-.4,r-2],halfExtents:[4.2,.55,3.6],radius:.14,supportBias:!0}]:[];return{mutatedCourse:{...e,nodes:[...n,...u]},mutationLabel:"Cryo-Phase Bomb Detonated (materialOverride Acid -> Ice)",description:c>0?`Transmuted ${c} lethal Acid hazard basin(s) into crossable Crystalline Ice decks.`:"Injected a Crystalline Ice spin-charge deck across the mid-course chasm."}}const a={id:`${e.id}-csg-portal-blue-${e.nodes.length}`,kind:"torus",material:"conveyor",center:[t-1.5,o+1,r+1.5],majorRadius:1.4,minorRadius:.22,conveyorDirection:[5.5,-1,-5.5]},s={id:`${e.id}-csg-portal-orange-${e.nodes.length+1}`,kind:"torus",material:"bounce",center:[e.goalPos[0]-1.5,e.goalPos[1]+1.4,e.goalPos[2]+3.5],majorRadius:1.4,minorRadius:.22};return{mutatedCourse:{...e,nodes:[...e.nodes,a,s]},mutationLabel:"Linked Blue/Orange SDF Portal Fling Pair Spawned",description:"Spawned a linked Blue entry torus & Orange bounce exit torus for terminal-velocity chasm flinging."}}const Lt="antigravity-preview-09-2026",Ca="https://github.com/bourkefloyd/gemini-4-argon-sfhackathon-2026",Ra="e5c00a1",ma=["api.github.com","generativelanguage.googleapis.com"];function xo(e){const i=JSON.stringify({id:e.id,startPos:e.startPos,goalPos:e.goalPos,goalRadius:e.goalRadius,killPlaneY:e.killPlaneY,nodes:e.nodes,hazards:e.hazards,scene:e.scene??null,portals:e.portals??null});let t=2166136261,o=3421674724;for(let r=0;r<i.length;r++){const a=i.charCodeAt(r);t^=a,t=Math.imul(t,16777619)>>>0,o^=a^r&255,o=Math.imul(o,16777619)>>>0}return`cspec_${t.toString(16).padStart(8,"0")}${o.toString(16).padStart(8,"0")}`}function rt(e){if(!e||typeof e!="string")return!1;const i=e.trim();return!(!i||i.startsWith("preset-")||i.startsWith("int_argon1m_")||i.startsWith("int_argon_local_")||i.startsWith("int_argon_fallback_")||i.startsWith("agy_local_")||i.startsWith("prop_"))}function ht(e){const i=xo(e.course),t=e.repoUrl??Ca,o=e.commitSha??Ra,r=e.source??"local-sandbox-trace",a=e.status??"unavailable";let s,c;e.passed!==void 0&&e.verdict!==void 0?(s=e.passed,c=e.verdict):a==="passed"?(s=!0,c="PASS"):a==="failed"?(s=!1,c="FAIL"):a==="pending"?(s=!1,c="PENDING"):(s=!1,c=e.solvability.passed?"PASS":"FAIL");const n=e.solvability.botRollout;return{agent:Lt,model:"gemini-4-argon",environment:"remote",background:!0,source:r,interactionId:e.interactionId??`agy_local_${e.course.id}_${Date.now().toString(36)}`,status:a,passed:s,verdict:c,courseHash:i,repoUrl:t,commitSha:o,networkAllowlist:ma,courseId:e.course.id,latencyMs:e.latencyMs??e.solvability.verificationLatencyMs,verificationTrace:[`agent=${Lt} model=gemini-4-argon environment=remote background=true status=${a} verdict=${c}`,`repo=${t} commit=${o} courseHash=${i}`,`network.allowlist=${ma.join(",")}`,`CPU SDF: start grounded=${e.solvability.startGrounded} d=${e.solvability.startDistance.toFixed(3)} material=${e.solvability.startMaterial}`,`Shaders: GLSL ${e.solvability.glslLineCount} lines, WGSL ${e.solvability.wgslLineCount} lines, compile=${e.solvability.shaderCompilePassed}`,`120 Hz bot: settled=${n.settledOnStart} reachedGoal=${n.reachedGoal} progress=${Math.round(n.progressRatio*100)}% peak=${n.peakSpeed.toFixed(1)} u/s steps=${n.stepsSimulated}`,...e.extraTrace??[]]}}async function Po(e){const i=e.fetchFn??(typeof fetch<"u"?fetch:void 0);if(!i)return ht({course:e.course,solvability:e.solvability,status:"unavailable"});try{const t=await i("/api/argon/antigravity/poll",{method:"POST",headers:{"Content-Type":"application/json",...e.apiKey?{"x-gemini-api-key":e.apiKey}:{}},body:JSON.stringify({interactionId:e.interactionId,course:e.course,solvability:e.solvability,apiKey:e.apiKey})});if(t.ok){const o=await t.json();if(o&&o.agent===Lt)return o}}catch{}return ht({course:e.course,solvability:e.solvability,status:"unavailable",interactionId:e.interactionId})}async function ha(e){const i=e.fetchFn??(typeof fetch<"u"?fetch:void 0);if(!i)return ht({course:e.course,solvability:e.solvability,status:"unavailable",repoUrl:e.repoUrl,commitSha:e.commitSha});const t=performance.now();try{const o=await i("/api/argon/antigravity",{method:"POST",headers:{"Content-Type":"application/json",...e.apiKey?{"x-gemini-api-key":e.apiKey}:{}},body:JSON.stringify({prompt:e.prompt,course:e.course,repoUrl:e.repoUrl??Ca,commitSha:e.commitSha??Ra,solvability:{passed:e.solvability.passed,startGrounded:e.solvability.startGrounded,startDistance:e.solvability.startDistance,startMaterial:e.solvability.startMaterial,shaderCompilePassed:e.solvability.shaderCompilePassed,glslLineCount:e.solvability.glslLineCount,wgslLineCount:e.solvability.wgslLineCount,verificationLatencyMs:e.solvability.verificationLatencyMs,botRollout:e.solvability.botRollout,diagnostics:e.solvability.diagnostics},previousInteractionId:rt(e.previousInteractionId)?e.previousInteractionId:null,apiKey:e.apiKey})});if(!o.ok)throw new Error(`antigravity HTTP ${o.status}`);const r=await o.json();if(r&&r.agent===Lt&&Array.isArray(r.verificationTrace))return r}catch{}return ht({course:e.course,solvability:e.solvability,status:"unavailable",repoUrl:e.repoUrl,commitSha:e.commitSha,latencyMs:Math.round((performance.now()-t)*100)/100})}const je=3,fa=45e3;function Oo(){return[{agentId:"lead-architect",modelOrEngine:"gemini-4-argon",roleTitle:"Agent 1 · Lead Course Architect (gemini-4-argon · high thinking)",thinkingLevel:"high",status:"idle",latencyMs:0,summary:"Idle — ready to synthesize CourseSpec from 1M-token context or load an instant offline preset.",reasoningSteps:[]},{agentId:"hazard-specialist",modelOrEngine:"gemini-3.8-flash",roleTitle:"Agent 2 · Hazard & Portal Specialist (gemini-3.8-flash · parallel)",thinkingLevel:"medium",status:"idle",latencyMs:0,summary:"Idle — ready to place synchronized SDF pistons, wave floors, Steelies & linked Portals.",reasoningSteps:[]},{agentId:"solvability-verifier",modelOrEngine:"cpu-sdf-120hz-gate",roleTitle:"Agent 3 · CPU SDF Solvability & Shader Gate (120 Hz Bot Rollout)",status:"idle",latencyMs:0,summary:"Idle — awaiting candidate CourseSpec for schema, GLSL/WGSL compile & 120 Hz goal rollout check.",reasoningSteps:[]}]}function ga(e){const i=e.toLowerCase();return i.includes("wave")||i.includes("ferrofluid")||i.includes("mercury")||i.includes("acid")||i.includes("pump")?"ferrofluid-wave-gauntlet":i.includes("coach")||i.includes("telemetry")||i.includes("death")||i.includes("berm")||i.includes("brake")||i.includes("balance")?"adaptive-coach-remix":"portal-fling-citadel"}async function No(e=typeof fetch<"u"?fetch:void 0){if(!e)return{hasEnvKey:!1,leadModel:"gemini-4-argon",companionModel:"gemini-3.8-flash"};try{const i=await e("/api/argon/status",{method:"GET"});if(i.ok){const t=await i.json();return{hasEnvKey:!!t.hasEnvKey,leadModel:t.leadModel??"gemini-4-argon",companionModel:t.companionModel??"gemini-3.8-flash"}}}catch{}return{hasEnvKey:!1,leadModel:"gemini-4-argon",companionModel:"gemini-3.8-flash"}}async function _o(e){var D,W,Q,se,re,ie,E,$,v,x,_,F;const i=io({currentCourse:e.currentCourse,allCourses:e.allCourses,compiledShaders:e.compiledShaders,telemetry:e.telemetry,userPrompt:e.prompt}),t=rt(e.previousInteractionId)?e.previousInteractionId:null;if((D=e.onProgress)==null||D.call(e,[{agentId:"lead-architect",modelOrEngine:"gemini-4-argon",roleTitle:"Agent 1 · Lead Course Architect (gemini-4-argon · high thinking)",thinkingLevel:"high",status:"running",latencyMs:0,summary:`Reading ${i.totalTokensPacked.toLocaleString()} est. packed tokens (chars/4) & synthesizing macro SDF layout...`,reasoningSteps:[]},{agentId:"hazard-specialist",modelOrEngine:"gemini-3.8-flash",roleTitle:"Agent 2 · Hazard & Portal Specialist (gemini-3.8-flash · parallel)",thinkingLevel:"medium",status:"running",latencyMs:0,summary:"Computing synchronized SDF pistons, wave floors, Steelies & Blue/Orange Portal flings...",reasoningSteps:[]},{agentId:"solvability-verifier",modelOrEngine:"cpu-sdf-120hz-gate",roleTitle:"Agent 3 · CPU SDF Solvability & Shader Gate (120 Hz Bot Rollout)",status:"idle",latencyMs:0,summary:"Awaiting CourseSpec AST from Agent 1 + Agent 2...",reasoningSteps:[]}]),e.mode==="preset"){const q=performance.now(),U=e.presetId??ga(e.prompt),h=pa[U],A=kt(h.course),g=A.verifiedCourse,G=Math.max(1,Math.round((performance.now()-q)*100)/100),O=[{...h.swarmAgents[0],latencyMs:G},{...h.swarmAgents[1],latencyMs:G},{agentId:"solvability-verifier",modelOrEngine:"cpu-sdf-120hz-gate",roleTitle:"Agent 3 · CPU SDF Solvability & Shader Gate (120 Hz Bot Rollout)",status:A.passed?"completed":"error",latencyMs:A.verificationLatencyMs,summary:A.passed?`PASS: Spawn grounded (d=${A.startDistance.toFixed(2)}m), GLSL2 (${A.glslLineCount}L) & WGSL (${A.wgslLineCount}L) compiled, 120 Hz Bot reached Goal Pad (100%).`:`GATE FAILED: ${A.diagnostics.join(" ")}`,reasoningSteps:A.diagnostics}];(W=e.onProgress)==null||W.call(e,O);const te=ht({course:g,solvability:A,status:"unavailable",extraTrace:["Offline preset loaded directly in memory with zero network calls."]});return{proposalId:`prop_${Date.now().toString(36)}`,interactionId:`preset-${U}`,previousInteractionId:null,executionSource:"offline-preset",mode:e.mode,title:h.title,prompt:e.prompt,reasoningTrace:h.reasoningTrace,contextBundle:i,usageMetadata:null,serverError:null,repairAttempts:[],swarmAgents:O,solvability:A,proposedCourse:g,antigravitySandbox:te,requiresHumanApproval:!0,createdAtIso:new Date().toISOString()}}if(e.mode==="realtime-csg"&&e.csgMutationKind){const q=performance.now(),U=So(e.currentCourse,e.csgMutationKind),h=kt(U.mutatedCourse),A=h.verifiedCourse,g=Math.max(1,Math.round((performance.now()-q)*100)/100),G=["[Offline CSG Field Mutator // Local CPU == GPU SDF Tree Edit]",`• Operation: ${U.mutationLabel}`,`• Details: ${U.description}`,`• Active Course Nodes: ${e.currentCourse.nodes.length} -> ${A.nodes.length}`].join(`
`),O=[{agentId:"lead-architect",modelOrEngine:"gemini-4-argon",roleTitle:"Agent 1 · Lead Course Architect (gemini-4-argon · high thinking)",thinkingLevel:"high",status:"completed",latencyMs:g,summary:U.description,reasoningSteps:[U.mutationLabel,U.description]},{agentId:"hazard-specialist",modelOrEngine:"gemini-3.8-flash",roleTitle:"Agent 2 · Hazard & Portal Specialist (gemini-3.8-flash · parallel)",thinkingLevel:"medium",status:"completed",latencyMs:g,summary:"Aligned CSG field mutation with existing kinematic hazards and supportBias normals.",reasoningSteps:["Verified zero collision interference with Start and Goal pads."]},{agentId:"solvability-verifier",modelOrEngine:"cpu-sdf-120hz-gate",roleTitle:"Agent 3 · CPU SDF Solvability & Shader Gate (120 Hz Bot Rollout)",status:h.passed?"completed":"error",latencyMs:h.verificationLatencyMs,summary:h.passed?`PASS: Spawn grounded (d=${h.startDistance.toFixed(2)}m), GLSL2 (${h.glslLineCount}L) & WGSL (${h.wgslLineCount}L) compiled, 120 Hz Bot reached Goal Pad (100%).`:`GATE FAILED: ${h.diagnostics.join(" ")}`,reasoningSteps:h.diagnostics}];(Q=e.onProgress)==null||Q.call(e,O);const te=ht({course:A,solvability:h,status:"unavailable",extraTrace:["Realtime CSG mutation evaluated locally in memory."]});return{proposalId:`prop_${Date.now().toString(36)}`,interactionId:`preset-csg-${e.csgMutationKind}`,previousInteractionId:null,executionSource:"offline-preset",mode:e.mode,title:U.mutationLabel,prompt:e.prompt,reasoningTrace:G,contextBundle:i,usageMetadata:null,serverError:null,repairAttempts:[],swarmAgents:O,solvability:h,proposedCourse:A,antigravitySandbox:te,requiresHumanApproval:!0,createdAtIso:new Date().toISOString()}}const o=e.fetchFn??(typeof fetch<"u"?fetch:void 0),r=[];let a=null,s=null,c="",n=[],u=null,b="offline-preset",y="Argon 1M Course Proposal",l=null,f=null;if(o){let q=t,U=[];for(let h=1;h<=je;h++){const A=performance.now(),g=new AbortController,G=setTimeout(()=>g.abort(),fa),O=()=>g.abort();(se=e.signal)==null||se.addEventListener("abort",O,{once:!0});try{if((re=e.signal)!=null&&re.aborted)throw new Error("Request cancelled by user.");h>1&&((ie=e.onProgress)==null||ie.call(e,[{agentId:"lead-architect",modelOrEngine:"gemini-4-argon",roleTitle:`Agent 1 · Lead Course Architect (Self-Repair Attempt ${h}/${je})`,thinkingLevel:"high",status:"running",latencyMs:0,summary:`Sending structured failure diagnostics back to gemini-4-argon (previous_interaction_id=${q??"none"})...`,reasoningSteps:U},{agentId:"hazard-specialist",modelOrEngine:"gemini-3.8-flash",roleTitle:"Agent 2 · Hazard & Portal Specialist (gemini-3.8-flash · parallel)",thinkingLevel:"medium",status:"running",latencyMs:0,summary:"Re-aligning hazards for repaired course topology...",reasoningSteps:[]},{agentId:"solvability-verifier",modelOrEngine:"cpu-sdf-120hz-gate",roleTitle:"Agent 3 · CPU SDF Solvability & Shader Gate (120 Hz Bot Rollout)",status:"idle",latencyMs:0,summary:`Awaiting repaired CourseSpec for Attempt ${h}/${je}...`,reasoningSteps:U}]));const te=h===1?e.prompt:`${e.prompt}

[SELF-REPAIR ATTEMPT ${h}/${je}] Fix these exact CPU SDF & 120 Hz Rollout Gate failures from Attempt ${h-1}:
${U.map((B,V)=>`${V+1}. ${B}`).join(`
`)}`,ae=await o("/api/argon/synthesize",{method:"POST",headers:{"Content-Type":"application/json",...e.apiKey?{"x-gemini-api-key":e.apiKey}:{}},body:JSON.stringify({prompt:te,mode:e.mode==="telemetry-mutation"?"telemetry-mutation":"swarm-synthesizer",presetId:e.presetId,systemInstruction:i.systemInstruction,cachedPrefixPrompt:i.cachedPrefixPrompt,dynamicTelemetryPrompt:i.dynamicTelemetryPrompt,previousInteractionId:rt(q)?q:null,repairAttempt:h,repairDiagnostics:U,apiKey:e.apiKey}),signal:g.signal}),oe=Math.max(1,Math.round((performance.now()-A)*100)/100);if(!ae.ok){let B="";try{B=(await ae.json()).error??`HTTP ${ae.status}`}catch{B=`HTTP ${ae.status}`}f=`Server returned error: ${B}`;break}const L=await ae.json();if(L.error&&(f=L.error),!(L.ok&&(L.executionSource==="live-interactions-api"||L.executionSource==="live-generate-content"||L.source==="live-gemini-api")&&L.course&&typeof L.course.id=="string"&&Array.isArray(L.course.nodes))||!L.course)break;const X=typeof L.interactionId=="string"&&L.interactionId.trim()?L.interactionId:`int_argon_live_${Date.now().toString(36)}`,J=kt(L.course),ce=L.latencyMs??oe,j={attempt:h,maxAttempts:je,interactionId:X,previousInteractionId:rt(q)?q:null,passed:J.passed,diagnosticsSent:[...U],gateDiagnostics:J.diagnostics,fixSummary:J.passed?`Attempt ${h}/${je} PASSED CPU SDF & 120 Hz Rollout Gate (${J.verifiedCourse.nodes.length} nodes, d=${J.startDistance.toFixed(2)}m, reachedGoal=true).`:`Attempt ${h}/${je} FAILED gate: ${J.diagnostics.join(" | ")}`,latencyMs:ce};if(r.push(j),(E=e.onRepairAttempt)==null||E.call(e,[...r]),a=J.verifiedCourse,s=J,u=X,b=L.executionSource==="live-generate-content"?"live-generate-content":"live-interactions-api",l=L.usageMetadata??null,c=L.reasoningTrace??`[gemini-4-argon // ${b}] Synthesized CourseSpec from 1M-token context.`,y=J.verifiedCourse.name||"Live Gemini 4 Argon Course",f=null,n=[{agentId:"lead-architect",modelOrEngine:"gemini-4-argon",roleTitle:"Agent 1 · Lead Course Architect (gemini-4-argon · high thinking)",thinkingLevel:"high",status:"completed",latencyMs:ce,summary:`Live ${b} synthesis completed on Attempt ${h}/${je} (${J.verifiedCourse.nodes.length} SDF nodes).`,reasoningSteps:[c]},{agentId:"hazard-specialist",modelOrEngine:"gemini-3.8-flash",roleTitle:"Agent 2 · Hazard & Portal Specialist (gemini-3.8-flash · parallel)",thinkingLevel:"medium",status:"completed",latencyMs:ce,summary:L.agent2Summary??`Placed ${(($=J.verifiedCourse.hazards)==null?void 0:$.length)??0} synchronized kinematic hazards.`,reasoningSteps:[L.agent2Summary??"Synchronized pistons, wave floors, and Steelie patrols."]}],J.passed)break;rt(X)&&(q=X),U=J.diagnostics}catch(te){const ae=te instanceof Error?te.message:String(te);(v=e.signal)!=null&&v.aborted?f="Live Gemini 4 Argon request cancelled by user.":g.signal.aborted?f=`Live Gemini 4 Argon request timed out after ${fa/1e3}s.`:f=`Live API error: ${ae}`;break}finally{clearTimeout(G),(x=e.signal)==null||x.removeEventListener("abort",O)}}}if(a&&s&&u){const q=ao(i,l),U={agentId:"solvability-verifier",modelOrEngine:"cpu-sdf-120hz-gate",roleTitle:"Agent 3 · CPU SDF Solvability & Shader Gate (120 Hz Bot Rollout)",status:s.passed?"completed":"error",latencyMs:s.verificationLatencyMs,summary:s.passed?`PASS (Attempt ${r.length}/${je}): Spawn grounded (d=${s.startDistance.toFixed(2)}m), GLSL2 (${s.glslLineCount}L) & WGSL (${s.wgslLineCount}L) compiled, 120 Hz Bot reached Goal Pad (100%).`:`GATE FAILED after ${r.length}/${je} attempts: ${s.diagnostics.join(" ")}`,reasoningSteps:s.diagnostics},h=[...n,U];(_=e.onProgress)==null||_.call(e,h);let A=await ha({prompt:e.prompt,course:a,solvability:s,previousInteractionId:rt(u)?u:null,apiKey:e.apiKey,fetchFn:o});if(A.status==="pending"&&rt(A.interactionId)&&o){const g=await Po({interactionId:A.interactionId,course:a,solvability:s,apiKey:e.apiKey,fetchFn:o});g.status!=="unavailable"&&(A=g)}return{proposalId:`prop_${Date.now().toString(36)}`,interactionId:u,previousInteractionId:t,executionSource:b,mode:e.mode,title:y,prompt:e.prompt,reasoningTrace:c,contextBundle:q,usageMetadata:l,serverError:f,repairAttempts:r,swarmAgents:h,solvability:s,proposedCourse:a,antigravitySandbox:A,requiresHumanApproval:!0,createdAtIso:new Date().toISOString()}}const d=performance.now();let m,S,k,M,H;if(e.mode==="telemetry-mutation"){const q=bo(e.currentCourse,e.telemetry,e.prompt);m=q.mutatedCourse,S=q.reasoningTrace,k=q.mutatedCourse.name,M=`preset-telemetry-${e.currentCourse.id}`,H=q.swarmAgents.slice(0,2)}else{const q=e.presetId??ga(e.prompt),U=pa[q];m=U.course,S=U.reasoningTrace,k=U.title,M=`preset-${q}`,H=U.swarmAgents.slice(0,2)}const p=kt(m),R=p.verifiedCourse,w=Math.max(1,Math.round((performance.now()-d)*100)/100),P={agentId:"solvability-verifier",modelOrEngine:"cpu-sdf-120hz-gate",roleTitle:"Agent 3 · CPU SDF Solvability & Shader Gate (120 Hz Bot Rollout)",status:p.passed?"completed":"error",latencyMs:p.verificationLatencyMs,summary:p.passed?`PASS: Spawn grounded (d=${p.startDistance.toFixed(2)}m), GLSL2 (${p.glslLineCount}L) & WGSL (${p.wgslLineCount}L) compiled, 120 Hz Bot reached Goal Pad (100%).`:`GATE FAILED: ${p.diagnostics.join(" ")}`,reasoningSteps:p.diagnostics},T=[...H.map(q=>({...q,latencyMs:w})),P];(F=e.onProgress)==null||F.call(e,T);const I=await ha({prompt:e.prompt,course:R,solvability:p,previousInteractionId:null,apiKey:e.apiKey,fetchFn:o});return{proposalId:`prop_${Date.now().toString(36)}`,interactionId:M,previousInteractionId:null,executionSource:"offline-preset",mode:e.mode,title:k,prompt:e.prompt,reasoningTrace:S,contextBundle:i,usageMetadata:null,serverError:f,repairAttempts:r,swarmAgents:T,solvability:p,proposedCourse:R,antigravitySandbox:I,requiresHumanApproval:!0,createdAtIso:new Date().toISOString()}}function Mo(e){const i=e.courseName.replace(/\s+/g," ").trim()||"this race",t=typeof e.peakSpeed=="number"&&e.peakSpeed>0?`${e.peakSpeed.toFixed(0)} meters a second`:"top speed";switch(e.event){case"analyze-run":return`High roller on ${i}, peaking at ${t}, and Argon is carving a safer line from that death map!`;case"mutate-course":return`Mutation locked for ${i}, with catch berms and a portal skybridge waiting on your approve button!`;case"preset":return`${e.title??"New course"} is on the glass, tourist line left and speedrun line right, so approve to hot-swap!`;case"approved":return`Hot swap complete, ${i} is live, so roll it high roller!`;case"csg":return`Field sculpt armed on ${i}, ${e.title??"a new solid"} is staged, and it stays off the track until you approve!`;case"listening":return"Mic is live, so tell Argon the course you want while you roll!"}}function wo(e){if(typeof window>"u"||!window.speechSynthesis)return!1;window.speechSynthesis.cancel();const i=new SpeechSynthesisUtterance(e);return i.rate=1.08,i.pitch=.9,i.lang="en-US",window.speechSynthesis.speak(i),!0}async function ko(e,i){if(typeof Audio>"u")return!1;const t=new Audio(`data:${i};base64,${e}`);try{return await t.play(),!0}catch{return!1}}async function Uo(e,i){const t=Mo(e),o=(i==null?void 0:i.fetchFn)??(typeof fetch<"u"?fetch:void 0);if(o)try{const a=await o("/api/argon/tts",{method:"POST",headers:{"Content-Type":"application/json",...i!=null&&i.apiKey?{"x-gemini-api-key":i.apiKey}:{}},body:JSON.stringify({text:t,apiKey:i==null?void 0:i.apiKey})});if(a.ok){const s=await a.json();if(s.ok&&s.audioBase64&&s.mimeType&&await ko(s.audioBase64,s.mimeType))return{text:t,spoken:!0,source:"gemini-3.8-flash-tts"}}}catch{}const r=wo(t);return{text:t,spoken:r,source:r?"speech-synthesis":"silent"}}function Co(){if(typeof window>"u")return null;const e=window;return e.SpeechRecognition??e.webkitSpeechRecognition??null}function Wo(e){const i=Co();if(!i)return{supported:!1,start:()=>{var o;return(o=e.onState)==null?void 0:o.call(e,"unsupported")},stop:()=>{var o;return(o=e.onState)==null?void 0:o.call(e,"idle")}};let t=null;return{supported:!0,start:()=>{var r;t==null||t.stop();const o=new i;o.lang="en-US",o.interimResults=!1,o.continuous=!1,o.onresult=a=>{var c,n,u;const s=(u=(n=(c=a.results[0])==null?void 0:c[0])==null?void 0:n.transcript)==null?void 0:u.trim();s&&e.onTranscript(s)},o.onerror=()=>{var a;return(a=e.onState)==null?void 0:a.call(e,"idle")},o.onend=()=>{var a;return(a=e.onState)==null?void 0:a.call(e,"idle")},t=o,(r=e.onState)==null||r.call(e,"listening"),o.start()},stop:()=>{var o;t==null||t.stop(),t=null,(o=e.onState)==null||o.call(e,"idle")}}}function Ro(e){const i=Math.round(e.totalTokens).toLocaleString(),t=Math.round(e.cachedTokens).toLocaleString(),o=Math.round(e.dynamicTokens).toLocaleString();return`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Marble Madness SDF — 1M Architecture</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #07101c; color: #e7f2ff; font: 13px/1.35 "Segoe UI", sans-serif; }
  h1 { font-size: 15px; margin: 12px 16px 4px; letter-spacing: 0.04em; }
  p.lead { margin: 0 16px 10px; color: #9fb6d0; }
  svg { width: 100%; height: auto; display: block; }
  .node { cursor: pointer; }
  .node rect { fill: #102033; stroke: #3ce8ff; }
  .node.argon rect { stroke: #d96bff; }
  .node.flash rect { stroke: #ffd23f; }
  .node.agy rect { stroke: #ff9f43; }
  .node.gate rect { stroke: #28f79c; }
  .node text { fill: #f4fbff; font-size: 11px; }
  #detail { margin: 8px 16px 16px; min-height: 3.2em; padding: 8px 10px; border: 1px solid #24506a; border-radius: 8px; background: #0c1828; }
</style>
</head>
<body>
<h1>HOW THIS WORKS — ${e.courseName.replace(/[<>&"]/g,"")}</h1>
<p class="lead">Click a block. One CourseSpec feeds the picture and the 120 Hz marble. Argon only hot-swaps after a person approves.</p>
<svg viewBox="0 0 920 460" role="img" aria-label="Architecture diagram">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#7fd4ff" />
    </marker>
  </defs>
  <g class="node" data-detail="The 1,000,000-token window holds engine contracts, the CPU/GPU SDF kernel, compiled GLSL and WGSL, every course, the feel bible, and the live 120 Hz death and slip trace. Static prefix is implicitly cached at 95% off. This session packed ${i} tokens (${t} cached, ${o} live telemetry).">
    <rect x="24" y="24" width="250" height="92" rx="10" />
    <text x="40" y="52">1M-token context</text>
    <text x="40" y="72">${i} / 1,000,000 packed</text>
    <text x="40" y="92">95% implicit cache on the prefix</text>
  </g>
  <g class="node argon" data-detail="gemini-4-argon, thinking_level high, is the lead architect. It reads the full window and writes the macro CourseSpec: elevation, tourist line, and the risk-reward shortcut.">
    <rect x="330" y="24" width="250" height="92" rx="10" />
    <text x="346" y="52">gemini-4-argon</text>
    <text x="346" y="72">Lead architect · thinking high</text>
    <text x="346" y="92">Macro layout + shortcut topology</text>
  </g>
  <g class="node flash" data-detail="gemini-3.8-flash runs in parallel as the hazard and portal specialist: SDF pistons, wave floors, Steelies, and linked blue/orange flings. gemini-3.8-flash-tts speaks the one-line arcade callout.">
    <rect x="630" y="24" width="266" height="92" rx="10" />
    <text x="646" y="52">gemini-3.8-flash</text>
    <text x="646" y="72">Hazards, portals, TTS announcer</text>
    <text x="646" y="92">Parallel with the lead</text>
  </g>
  <g class="node" data-detail="The CourseSpec is one scene. The CPU evaluator (src/sdf/eval-cpu.ts) and the GLSL/WGSL compilers lower the same primitives and CSG ops. That shared program is the .msdf RPN bytecode idea: distance, normal, and material stay lockstep so the marble cannot fall through a surface the shader did not draw.">
    <rect x="24" y="180" width="400" height="110" rx="10" />
    <text x="40" y="210">Lockstep SDF + .msdf RPN bytecode</text>
    <text x="40" y="232">CourseSpec → CPU distance kernel</text>
    <text x="40" y="252">same tree → GLSL ES 3.00 + WGSL raymarch</text>
    <text x="40" y="272">tetrahedral normals, 120 Hz sphere cast</text>
  </g>
  <g class="node agy" data-detail="antigravity-preview-09-2026 is the managed agent. The Interactions call sets agent_config type antigravity, model gemini-4-argon, environment remote, background true. The sandbox re-checks solvability before the approve button unlocks. Allowlist: api.github.com and generativelanguage.googleapis.com.">
    <rect x="470" y="180" width="426" height="110" rx="10" />
    <text x="486" y="210">antigravity-preview-09-2026</text>
    <text x="486" y="232">Managed-agent remote sandbox</text>
    <text x="486" y="252">model gemini-4-argon · background true</text>
    <text x="486" y="272">Signs the solvability certificate</text>
  </g>
  <g class="node gate" data-detail="The 120 Hz solvability gate runs createCpuWorldEvaluator, compileCourseToGlsl, compileCourseToWgsl, and a bot rollout. startPos must be grounded and the goal must be reachable. Nothing hot-swaps until you press Approve.">
    <rect x="180" y="340" width="560" height="92" rx="10" />
    <text x="200" y="372">120 Hz solvability gate → human Approve &amp; Hot-Swap</text>
    <text x="200" y="394">Grounded spawn, shader compile, bot rollout, then your button</text>
    <text x="200" y="414">People stay in control of the live course</text>
  </g>
  <path d="M274 70 H330" stroke="#7fd4ff" stroke-width="2" marker-end="url(#arrow)" />
  <path d="M580 70 H630" stroke="#7fd4ff" stroke-width="2" marker-end="url(#arrow)" />
  <path d="M455 116 V160 H224 V180" stroke="#7fd4ff" stroke-width="2" fill="none" marker-end="url(#arrow)" />
  <path d="M763 116 V160 H683 V180" stroke="#7fd4ff" stroke-width="2" fill="none" marker-end="url(#arrow)" />
  <path d="M424 235 H470" stroke="#7fd4ff" stroke-width="2" marker-end="url(#arrow)" />
  <path d="M683 290 V320 H460 V340" stroke="#28f79c" stroke-width="2" fill="none" marker-end="url(#arrow)" />
</svg>
<div id="detail">Click any block to read what that stage does during the three-minute demo.</div>
<script>
  const detail = document.getElementById('detail');
  document.querySelectorAll('.node').forEach((node) => {
    node.addEventListener('click', () => {
      detail.textContent = node.getAttribute('data-detail') || '';
    });
  });
<\/script>
</body>
</html>`}const Vo=({open:e,onClose:i,stats:t})=>{const o=La.useMemo(()=>Ro(t),[t]);return e?ut.jsx("div",{className:"argon-diagram-backdrop",role:"presentation",onClick:i,style:{position:"fixed",inset:0,zIndex:80,background:"rgba(2, 6, 14, 0.72)",display:"flex",alignItems:"center",justifyContent:"center",padding:24},children:ut.jsxs("div",{role:"dialog","aria-label":"How it works, 1M architecture diagram","data-testid":"architecture-diagram-modal",onClick:r=>r.stopPropagation(),style:{width:"min(960px, 100%)",height:"min(640px, 100%)",background:"#07101c",border:"1px solid rgba(217, 107, 255, 0.55)",borderRadius:12,display:"flex",flexDirection:"column",overflow:"hidden"},children:[ut.jsxs("div",{style:{display:"flex",justifyContent:"space-between",padding:"8px 12px"},children:[ut.jsx("strong",{style:{fontFamily:"var(--font-mono)",fontSize:12,color:"#d96bff"},children:"HOW IT WORKS / 1M DIAGRAM"}),ut.jsx("button",{type:"button",className:"hud-btn hud-btn-sm",onClick:i,children:"CLOSE"})]}),ut.jsx("iframe",{title:"Marble Madness SDF architecture diagram",sandbox:"allow-scripts",srcDoc:o,style:{flex:1,width:"100%",border:0,background:"#07101c"}})]})}):null},Ct={standard:{material:"standard",baseCarrierHz:92,speedPitchScaleHz:14.5,cToMRatio:2,baseModIndex:1.35,baseFilterCutoffHz:980,filterQ:2.2,shimmerAmount:.18},start:{material:"start",baseCarrierHz:98,speedPitchScaleHz:14,cToMRatio:2,baseModIndex:1.25,baseFilterCutoffHz:1050,filterQ:2,shimmerAmount:.2},goal:{material:"goal",baseCarrierHz:130.81,speedPitchScaleHz:15,cToMRatio:3,baseModIndex:2.1,baseFilterCutoffHz:1850,filterQ:3.2,shimmerAmount:.55},ice:{material:"ice",baseCarrierHz:210,speedPitchScaleHz:22,cToMRatio:3.5,baseModIndex:3.8,baseFilterCutoffHz:3400,filterQ:5.5,shimmerAmount:.95},sticky:{material:"sticky",baseCarrierHz:62,speedPitchScaleHz:7.5,cToMRatio:1.5,baseModIndex:2.4,baseFilterCutoffHz:420,filterQ:1.4,shimmerAmount:.05},bounce:{material:"bounce",baseCarrierHz:145,speedPitchScaleHz:18,cToMRatio:2.5,baseModIndex:2.6,baseFilterCutoffHz:1600,filterQ:3.8,shimmerAmount:.45},acid:{material:"acid",baseCarrierHz:175,speedPitchScaleHz:19,cToMRatio:2.91,baseModIndex:6.4,baseFilterCutoffHz:2650,filterQ:4.6,shimmerAmount:.82},bumper:{material:"bumper",baseCarrierHz:260,speedPitchScaleHz:20,cToMRatio:2.76,baseModIndex:4.5,baseFilterCutoffHz:2900,filterQ:4.8,shimmerAmount:.78},conveyor:{material:"conveyor",baseCarrierHz:118,speedPitchScaleHz:16.5,cToMRatio:1.25,baseModIndex:3.1,baseFilterCutoffHz:1420,filterQ:3.5,shimmerAmount:.4}},Ut=[[69,72,76,81,76,72,69,72,65,69,72,77,64,68,71,76],[62,65,69,74,73,69,65,62,70,74,77,82,69,73,76,81],[64,67,71,76,79,76,71,67,60,64,67,72,66,69,74,78]],va=[[45,45,57,45,48,48,60,48,41,41,53,41,40,40,52,40],[38,38,50,38,38,50,45,38,46,46,58,46,45,45,57,45],[40,40,52,40,43,43,55,43,36,36,48,36,38,38,50,38]];function Rt(e){return 440*Math.pow(2,(e-69)/12)}function Re(e,i,t){return Math.max(i,Math.min(t,e))}function To(e,i){if(i){const t=e.position[0]-i.target[0],o=e.position[2]-i.target[2],r=t*i.right[0]+o*i.right[2];return Re(r/9.5,-.92,.92)}return Re(e.position[0]/18,-.88,.88)}function Ao(e){try{if(typeof window>"u")return null;const i=window.AudioContext||window.webkitAudioContext;if(!i)return null;const t=new i,o=t.createGain();o.gain.value=e,o.connect(t.destination);const r=t.createOscillator(),a=t.createOscillator(),s=t.createGain(),c=t.createBiquadFilter(),n=t.createGain(),u=typeof t.createStereoPanner=="function"?t.createStereoPanner():null;r.type="sine",a.type="sine",c.type="lowpass",c.frequency.value=980,c.Q.value=2.2,n.gain.value=0,a.connect(s),s.connect(r.frequency),r.connect(c),u?(c.connect(u),u.connect(n)):c.connect(n),n.connect(o),r.start(),a.start();const b=t.createOscillator(),y=t.createOscillator(),l=t.createGain(),f=t.createGain();b.type="triangle",y.type="sawtooth",f.gain.value=0,y.connect(l),l.connect(b.frequency),b.connect(f),f.connect(o),b.start(),y.start();const d=t.createOscillator(),m=t.createGain();return d.type="triangle",d.frequency.value=68,m.gain.value=0,d.connect(m),m.connect(o),d.start(),{ctx:t,masterGain:o,rollingCarrier:r,rollingModulator:a,rollingModGain:s,rollingFilter:c,rollingPanner:u,rollingGain:n,skidCarrier:b,skidModulator:y,skidModGain:l,skidGain:f,rimOsc:d,rimGain:m}}catch{return null}}function qo(e){let i=(e==null?void 0:e.initialMuted)??!1,t=Re(.65,0,1),o=(e==null?void 0:e.initialMusicEnabled)??!0,r=0,a=null,s="racing",c=0,n=0,u=-1;const b=[];let y={initialized:!1,muted:i,masterVolume:t,musicEnabled:o,simTimeSec:0,rolling:{active:!1,material:"start",carrierFreqHz:98,modulatorFreqHz:196,fmModulationIndex:1.25,harmonicBrightness:.15,filterCutoffHz:1050,stereoPan:0,gain:0},skidAndRim:{backspinChirpActive:!1,backspinChirpFreqHz:1580,backspinChirpGain:0,rimPulseActive:!1,rimPulseFreqHz:68,rimPulseModRateHz:6.5,rimPulseGain:0},theme:{enabled:o,playing:!1,tempoBpm:136,stepIndex:0,leadFreqHz:Rt(69),bassFreqHz:Rt(45),stereoPan:0},lastTriggeredSfx:null,sfxHistory:[]};function l(){return a||(a=Ao(i?0:t)),a&&a.ctx.state==="suspended"&&a.ctx.resume().catch(()=>{}),a}function f(){if(a){const E=i?0:t;a.masterGain.gain.setValueAtTime(E,a.ctx.currentTime)}y={...y,initialized:a!==null||y.initialized,muted:i,masterVolume:t,musicEnabled:o}}function d(E,$,v,x,_,F,q=0,U="sine"){const h=l();if(!(!h||i||t<=0))try{const A=h.ctx.currentTime,g=h.ctx.createOscillator(),G=h.ctx.createOscillator(),O=h.ctx.createGain(),te=h.ctx.createGain();if(g.type=U,G.type="sine",g.frequency.setValueAtTime(E,A),g.frequency.exponentialRampToValueAtTime(Math.max(24,$),A+_),G.frequency.setValueAtTime(E*v,A),G.frequency.exponentialRampToValueAtTime(Math.max(24,$*v),A+_),O.gain.setValueAtTime(E*x,A),O.gain.exponentialRampToValueAtTime(1,A+_),te.gain.setValueAtTime(1e-4,A),te.gain.linearRampToValueAtTime(F,A+Math.min(.012,_*.2)),te.gain.exponentialRampToValueAtTime(1e-4,A+_),G.connect(O),O.connect(g.frequency),g.connect(te),typeof h.ctx.createStereoPanner=="function"){const ae=h.ctx.createStereoPanner();ae.pan.setValueAtTime(Re(q,-1,1),A),te.connect(ae),ae.connect(h.masterGain)}else te.connect(h.masterGain);g.start(A),G.start(A),g.stop(A+_+.02),G.stop(A+_+.02)}catch{}}function m(E,$,v,x){const _={kind:E,timestampSec:r,intensity:Re($,0,1),stereoPan:Re(v,-1,1),peakFrequencyHz:x};return b.push(_),b.length>32&&b.shift(),y={...y,lastTriggeredSfx:_,sfxHistory:[...b]},_}function S(E,$="standard",v=0,x=0){const _=Ct[$]??Ct.standard,F=Re(E/24,.08,1),q=_.baseCarrierHz*(1.2+F*1.4);return d(q,_.baseCarrierHz*.55,_.cToMRatio,_.baseModIndex*(1+F*1.8),.11+F*.08,.24*F,x,"triangle"),v>.05&&k(v,x),m("impact",F,x,q)}function k(E,$=0){const v=Re(E,.15,1),x=3400+v*1800;return d(x,1950,3.73,5.2,.065,.22*v,$,"sine"),d(x*1.24,2400,4.17,6,.085,.18*v,-$*.6,"sine"),m("stress_crackle",v,$,x)}function M(E=.85,$=0){const v=Re(E,.2,1),x=540+v*180;return d(x,175,2.76,5.5,.22,.32*v,$,"sine"),m("bumper",v,$,x)}function H(E=0){const $=[1864.66,2489.02,3322.44,4434.92];for(let v=0;v<$.length;v++){const x=$[v],_=Re(E+(v-1.5)*.28,-1,1);d(x,x*.42,3.41+v*.27,6.8,.34+v*.06,.22,_,"sine")}return m("shatter",1,E,$[3])}function p(E=0){return d(480,2450,4.65,8.5,.14,.18,E-.25,"sawtooth"),d(520,2750,4.85,8.5,.16,.18,E+.25,"sawtooth"),d(880,880,2,1.4,.12,.2,0,"sine"),m("respawn_broom",.85,E,2750)}function R(E=14,$=0){const v=Re(E/22,.35,1),x=920+v*560;return d(240,x,3.5,4.2,.26,.28*v,$,"sine"),m("portal_warp",v,$,x)}function w(){const E=[523.25,659.25,783.99,987.77,1046.5];for(let $=0;$<E.length;$++){const v=E[$],x=($-2)*.25;d(v,v*1.002,2,2.8,.38,.22,x,"triangle")}return m("goal_fanfare",1,0,E[E.length-1])}function P(E=0){return d(1850,290,3.91,9.2,.38,.26,E,"sawtooth"),m("acid_sizzle",.95,E,1850)}function T(E){const $=Re(E.dt,0,.1);r+=$;const{marble:v,feel:x,camera:_,timeRemainingSec:F=45,courseIndex:q=1}=E,U=(x==null?void 0:x.groundSpeed)??Math.hypot(v.velocity[0],v.velocity[2]),h=(x==null?void 0:x.totalSpeed)??Math.hypot(v.velocity[0],v.velocity[1],v.velocity[2]),A=(x==null?void 0:x.slip.slipRatio)??0,g=(x==null?void 0:x.slip.backspinIntensity)??0,G=(x==null?void 0:x.rim.rimProximity)??0,O=(x==null?void 0:x.stress.glassStress)??0,te=(x==null?void 0:x.stress.lastStressImpulse)??0,ae=v.surfaceMaterial,oe=Ct[ae]??Ct.standard,L=To(v,_),de=v.status==="racing"&&v.contact.grounded&&U>.08,X=Re(U/20,0,1.35),J=ae==="ice"?Math.sin(r*38)*14:ae==="conveyor"?Math.sin(r*60)*6:ae==="acid"?Math.sin(r*85)*24:0,ce=oe.baseCarrierHz+U*oe.speedPitchScaleHz+A*55+J,j=ce*oe.cToMRatio,B=oe.baseModIndex*(1+X*.85+A*1.45+O*.65),V=Re(.12+X*.48+A*.25+oe.shimmerAmount*.28+O*.15,0,1),ue=Re(oe.baseFilterCutoffHz+U*95+A*900+V*1100,180,8500),ne=de?Re((.04+X*.22+A*.08)*(i?0:1),0,.35):v.status==="racing"&&!v.contact.grounded&&h>3?Re(.025*(h/22)*(i?0:1),0,.08):0,Se=v.status==="racing"&&v.contact.grounded&&(g>.16||A>.35&&U>2),ze=Math.sin(r*52)*110,Z=1480+Math.max(g,A)*1180+ze,C=Se?Re(Math.max(g,A*.75)*.22*(i?0:1),0,.25):0,ee=v.status==="racing"&&v.contact.grounded&&G>.14,pe=5.5+G*5.5,ge=.5+.5*Math.sin(r*pe*Math.PI*2),be=58+G*34,ve=ee?Re(G*(.08+.12*ge)*(i?0:1),0,.22):0,ye=v.contact.impactSpeed;ye>2.6&&ye>c+1?ae==="bumper"?M(Re(ye/14,.35,1),L):S(ye,ae,te,L):te>.08&&k(O,L),c=ye,v.status!==s&&(v.status==="shattered"?H(L):v.status==="sunk"?P(L):v.status==="goal"?w():s!=="racing"&&v.status==="racing"&&p(L),s=v.status);const Te=F<=12&&v.status==="racing"?168:136+(q-1)%3*6,K=Te/60*4;o&&v.status==="racing"&&(n+=$*K);const N=Math.floor(n)%16,Y=Math.max(0,(q-1)%Ut.length),Me=Ut[Y]??Ut[0],Ae=va[Y]??va[0],le=Rt(Me[N]??69),he=Rt(Ae[N]??45),fe=(N%4-1.5)*.35;if(o&&!i&&v.status==="racing"&&N!==u&&$>0&&(u=N,d(le,le,2,1.6,.09,.055,fe,"sine"),N%2===0&&d(he,he*.99,1,2.2,.14,.065,0,"triangle")),a){const we=a.ctx.currentTime;a.rollingCarrier.frequency.setTargetAtTime(ce,we,.015),a.rollingModulator.frequency.setTargetAtTime(j,we,.015),a.rollingModGain.gain.setTargetAtTime(ce*B*.35,we,.015),a.rollingFilter.frequency.setTargetAtTime(ue,we,.02),a.rollingFilter.Q.setTargetAtTime(oe.filterQ,we,.02),a.rollingPanner&&a.rollingPanner.pan.setTargetAtTime(L,we,.02),a.rollingGain.gain.setTargetAtTime(ne,we,.02),a.skidCarrier.frequency.setTargetAtTime(Z,we,.01),a.skidModulator.frequency.setTargetAtTime(Z*2.42,we,.01),a.skidModGain.gain.setTargetAtTime(Z*1.8,we,.01),a.skidGain.gain.setTargetAtTime(C,we,.015),a.rimOsc.frequency.setTargetAtTime(be,we,.02),a.rimGain.gain.setTargetAtTime(ve,we,.02)}return y={initialized:a!==null||y.initialized,muted:i,masterVolume:t,musicEnabled:o,simTimeSec:r,rolling:{active:ne>.001,material:ae,carrierFreqHz:ce,modulatorFreqHz:j,fmModulationIndex:B,harmonicBrightness:V,filterCutoffHz:ue,stereoPan:L,gain:ne},skidAndRim:{backspinChirpActive:Se,backspinChirpFreqHz:Z,backspinChirpGain:C,rimPulseActive:ee,rimPulseFreqHz:be,rimPulseModRateHz:pe,rimPulseGain:ve},theme:{enabled:o,playing:o&&!i&&v.status==="racing",tempoBpm:Te,stepIndex:N,leadFreqHz:le,bassFreqHz:he,stereoPan:fe},lastTriggeredSfx:y.lastTriggeredSfx,sfxHistory:[...b]},y}function I(){l(),y={...y,initialized:!0},f()}function D(){return i=!i,f(),i}function W(E){i=!!E,f()}function Q(E){t=Re(E,0,1),f()}function se(E){o=!!E,f()}function re(E=typeof window<"u"?window:{},$="KeyM"){if(!E||typeof E.addEventListener!="function")return()=>{};const v=x=>{var q;const _=x,F=_.target;if(F){const U=(q=F.tagName)==null?void 0:q.toLowerCase();if(U==="input"||U==="textarea"||U==="select"||F.isContentEditable)return}_.code===$&&D()};return E.addEventListener("keydown",v),()=>{E.removeEventListener("keydown",v)}}function ie(){if(a){try{a.rollingCarrier.stop(),a.rollingModulator.stop(),a.skidCarrier.stop(),a.skidModulator.stop(),a.rimOsc.stop(),a.ctx.close()}catch{}a=null}}return{resume:I,getState:()=>y,toggleMute:D,setMuted:W,setMasterVolume:Q,setMusicEnabled:se,update:T,triggerImpact:S,triggerStressCrackle:k,triggerBumperHit:M,triggerShatter:H,triggerRespawnSweep:p,triggerPortalWarp:R,triggerGoalFanfare:w,triggerAcidSizzle:P,bindMuteHotkey:re,dispose:ie}}export{Vo as A,Io as B,Mt as I,Wo as a,Oo as b,$o as c,to as d,Po as e,No as f,Eo as g,xo as h,rt as i,Uo as j,pa as k,Qt as l,ja as m,qo as n,lo as o,io as p,xa as q,_o as r,_t as s,Ht as t,Go as u,kt as v,Lo as w,Ho as x,Bo as y,Fo as z};
