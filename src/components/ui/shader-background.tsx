'use client'

import { useRef, useEffect } from 'react'

const SHADER_SOURCE = `#version 300 es
precision highp float;
out vec4 O;
uniform vec2 resolution;
uniform float time;
uniform float u_theme;
#define FC gl_FragCoord.xy
#define T time
#define R resolution
#define MN min(R.x,R.y)
float rnd(vec2 p) {
  p=fract(p*vec2(12.9898,78.233));
  p+=dot(p,p+34.56);
  return fract(p.x*p.y);
}
float noise(in vec2 p) {
  vec2 i=floor(p), f=fract(p), u=f*f*(3.-2.*f);
  float a=rnd(i), b=rnd(i+vec2(1,0)), c=rnd(i+vec2(0,1)), d=rnd(i+1.);
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
float fbm(vec2 p) {
  float t=.0, a=1.; mat2 m=mat2(1.,-.5,.2,1.2);
  for (int i=0; i<5; i++) { t+=a*noise(p); p*=2.*m; a*=.5; }
  return t;
}
float clouds(vec2 p) {
  float d=1., t=.0;
  for (float i=.0; i<3.; i++) {
    float a=d*fbm(i*10.+p.x*.2+.2*(1.+i)*p.y+d+i*i+p);
    t=mix(t,d,a); d=a; p*=2./(i+1.);
  }
  return t;
}
void main(void) {
  vec2 uv=(FC-.5*R)/MN, st=uv*vec2(2,1);
  vec3 col=vec3(0);
  float bg=clouds(vec2(st.x+T*.5,-st.y));
  uv*=1.-.3*(sin(T*.2)*.5+.5);
  vec3 phaseWarm=vec3(1,2,3);
  vec3 phaseCool=vec3(3,2,5);
  vec3 phase=mix(phaseWarm,phaseCool,u_theme);
  for (float i=1.; i<12.; i++) {
    uv+=.1*cos(i*vec2(.1+.01*i,.8)+i*i+T*.5+.1*uv.x);
    vec2 p=uv;
    float d=length(p);
    col+=.00125/d*(cos(sin(i)*phase)+1.);
    float b=noise(i+p+bg*1.731);
    col+=.002*b/length(max(p,vec2(b*p.x*.02,p.y)));
    vec3 warmPal=vec3(bg*.25,bg*.137,bg*.05);
    vec3 coolPal=vec3(bg*.03,bg*.07,bg*.38);
    col=mix(col,mix(warmPal,coolPal,u_theme),d);
  }
  O=vec4(col,1);
}`

const VERTEX_SOURCE = `#version 300 es
precision highp float;
in vec4 position;
void main(){ gl_Position=position; }`

export function ShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const uThemeRef = useRef<WebGLUniformLocation | null>(null)
  const glRef = useRef<WebGL2RenderingContext | null>(null)
  const progRef = useRef<WebGLProgram | null>(null)
  const themeRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl2')
    if (!gl) return
    glRef.current = gl

    const dpr = Math.max(1, 0.5 * window.devicePixelRatio)
    const resize = () => {
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      gl.viewport(0, 0, canvas.width, canvas.height)
    }

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      return s
    }

    const vs = compile(gl.VERTEX_SHADER, VERTEX_SOURCE)
    const fs = compile(gl.FRAGMENT_SHADER, SHADER_SOURCE)
    const prog = gl.createProgram()!
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    progRef.current = prog

    const buf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,1,-1,-1,1,1,1,-1]), gl.STATIC_DRAW)

    const pos = gl.getAttribLocation(prog, 'position')
    gl.enableVertexAttribArray(pos)
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0)

    const uRes = gl.getUniformLocation(prog, 'resolution')
    const uTime = gl.getUniformLocation(prog, 'time')
    uThemeRef.current = gl.getUniformLocation(prog, 'u_theme')

    // Sync with current theme on mount
    if (localStorage.getItem('gestuniv-theme') === 'blue') themeRef.current = 1.0

    resize()
    window.addEventListener('resize', resize, { passive: true })

    // Listen for theme changes
    const onTheme = (e: Event) => {
      const blue = (e as CustomEvent<{ blue: boolean }>).detail.blue
      themeRef.current = blue ? 1.0 : 0.0
    }
    window.addEventListener('gestuniv:theme', onTheme)

    const loop = (now: number) => {
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.useProgram(prog)
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform1f(uTime, now * 1e-3)
      gl.uniform1f(uThemeRef.current, themeRef.current)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('gestuniv:theme', onTheme)
      cancelAnimationFrame(rafRef.current)
      gl.deleteProgram(prog)
      gl.deleteBuffer(buf)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ background: 'black' }}
    />
  )
}
