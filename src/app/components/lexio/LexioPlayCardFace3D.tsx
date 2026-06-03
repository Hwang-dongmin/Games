import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  LEXIO_SUIT_FACE,
  type LexioPlaySuit,
} from './LexioPlayCard';

const HIERO_FONT =
  'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansEgyptianHieroglyphs/NotoSansEgyptianHieroglyphs-Regular.ttf';

const NUMBER_FONT =
  'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Bold.ttf';

/** 숫자 outline — 기본 대비 1.5배 */
const NUMBER_OUTLINE_SCALE = 1.5;

const WATERMARK_FONT =
  'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansSymbols2/NotoSansSymbols2-Regular.ttf';

type SuitFace = (typeof LEXIO_SUIT_FACE)[LexioPlaySuit];

type LexioPlayCardFace3DProps = {
  number: number;
  suit: LexioPlaySuit;
  width: number;
  height: number;
  isHovered?: boolean;
  renderOrder: number;
};

function GlowText({
  children,
  position,
  fontSize,
  color,
  renderOrder,
  outlineWidth = 0,
  fillOpacity = 1,
  outlineColor = '#000000',
  outlineOpacity,
  strokeWidth = 0,
  strokeColor,
  strokeOpacity,
  anchorX = 'left',
  anchorY = 'middle',
  font,
  depthTest = true,
}: {
  children: string;
  position: [number, number, number];
  fontSize: number;
  color: string;
  renderOrder: number;
  outlineWidth?: number;
  fillOpacity?: number;
  outlineColor?: string;
  outlineOpacity?: number;
  strokeWidth?: number;
  strokeColor?: string;
  strokeOpacity?: number;
  anchorX?: 'left' | 'center' | 'right';
  anchorY?: 'top' | 'middle' | 'bottom';
  font?: string;
  depthTest?: boolean;
}) {
  return (
    <Text
      position={position}
      fontSize={fontSize}
      color={color}
      anchorX={anchorX}
      anchorY={anchorY}
      renderOrder={renderOrder}
      font={font}
      fillOpacity={fillOpacity}
      outlineWidth={outlineWidth}
      outlineColor={outlineColor}
      outlineOpacity={outlineOpacity}
      strokeWidth={strokeWidth}
      strokeColor={strokeColor}
      strokeOpacity={strokeOpacity}
      material-depthTest={depthTest}
      material-depthWrite={false}
      material-transparent
    >
      {children}
    </Text>
  );
}

/** 숫자 2 — 불투명 앞면 + 가로·세로·대각 4선 */
function FancyTwoCardFace({
  width,
  height,
  face,
  renderOrder,
}: {
  width: number;
  height: number;
  face: SuitFace;
  renderOrder: number;
}) {
  const outerW = width * 0.97;
  const outerH = height * 0.97;
  const innerW = width * 0.86;
  const innerH = height * 0.9;
  const barT = width * 0.008;
  const lineTh = width * 0.0555;
  const clipW = innerW * 0.96;
  const clipH = innerH * 0.96;
  const lineH = clipW;
  const lineV = clipH;
  const diagAngle = Math.atan2(clipH, clipW);
  const halfDiagAngle = diagAngle / 2;

  const diagLenAt = (angle: number) => {
    const c = Math.abs(Math.cos(angle));
    const s = Math.abs(Math.sin(angle));
    if (c < 1e-5) return clipH;
    if (s < 1e-5) return clipW;
    return Math.min(clipW / c, clipH / s);
  };

  const diagLine = (angle: number, z: number, opacity = 0.72) => (
    <mesh
      key={angle}
      position={[0, 0, z]}
      rotation={[0, 0, angle]}
      renderOrder={renderOrder + 1}
    >
      <planeGeometry args={[diagLenAt(angle), lineTh]} />
      <meshBasicMaterial color={face.color} transparent opacity={opacity} />
    </mesh>
  );

  return (
    <group>
      <mesh position={[0, 0, -0.004]} renderOrder={renderOrder}>
        <planeGeometry args={[outerW, outerH]} />
        <meshBasicMaterial color="#070709" />
      </mesh>
      <mesh position={[0, 0, -0.0035]} renderOrder={renderOrder}>
        <planeGeometry args={[innerW, innerH]} />
        <meshBasicMaterial color={face.color} transparent opacity={0.11} />
      </mesh>
      <mesh position={[0, 0, -0.003]} renderOrder={renderOrder}>
        <planeGeometry args={[outerW, outerH]} />
        <meshBasicMaterial color={face.color} />
      </mesh>
      <mesh position={[0, 0, -0.0026]} renderOrder={renderOrder}>
        <planeGeometry args={[outerW - barT * 2.4, outerH - barT * 2.8]} />
        <meshBasicMaterial color="#070709" />
      </mesh>
      <mesh position={[0, 0, -0.002]} renderOrder={renderOrder}>
        <planeGeometry args={[innerW, innerH]} />
        <meshBasicMaterial color="#060608" />
      </mesh>
      {/* 가로선 */}
      <mesh position={[0, 0, -0.0008]} renderOrder={renderOrder + 1}>
        <planeGeometry args={[lineH, lineTh]} />
        <meshBasicMaterial color={face.color} transparent opacity={0.72} />
      </mesh>
      {/* 세로선 */}
      <mesh position={[0, 0, -0.0007]} renderOrder={renderOrder + 1}>
        <planeGeometry args={[lineTh, lineV]} />
        <meshBasicMaterial color={face.color} transparent opacity={0.72} />
      </mesh>
      {/* 대각선 — 가로↔대각 사이 보조선 + 주 대각 */}
      {diagLine(halfDiagAngle, -0.00065, 0.58)}
      {diagLine(-halfDiagAngle, -0.0006, 0.58)}
      {diagLine(diagAngle, -0.00055, 0.72)}
      {diagLine(-diagAngle, -0.0005, 0.72)}
      <FancyTwoRectFrame
        halfW={outerW / 2}
        halfH={outerH / 2}
        bar={width * 0.02}
        color={face.color}
        z={0.004}
        renderOrder={renderOrder + 6}
      />
      <FancyTwoRectFrame
        halfW={clipW * 0.44}
        halfH={clipH * 0.44}
        bar={width * 0.016}
        color={face.accent}
        z={0.0045}
        renderOrder={renderOrder + 6}
      />
    </group>
  );
}

/** 사각 테두리 4변 — 십자선보다 위에 그려져 보이게 */
function FancyTwoRectFrame({
  halfW,
  halfH,
  bar,
  color,
  z,
  renderOrder,
}: {
  halfW: number;
  halfH: number;
  bar: number;
  color: string;
  z: number;
  renderOrder: number;
}) {
  const edgeW = halfW * 2;
  const edgeH = halfH * 2;
  return (
    <group>
      <mesh position={[0, halfH - bar / 2, z]} renderOrder={renderOrder}>
        <planeGeometry args={[edgeW, bar]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[0, -halfH + bar / 2, z]} renderOrder={renderOrder}>
        <planeGeometry args={[edgeW, bar]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[-halfW + bar / 2, 0, z]} renderOrder={renderOrder}>
        <planeGeometry args={[bar, edgeH]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[halfW - bar / 2, 0, z]} renderOrder={renderOrder}>
        <planeGeometry args={[bar, edgeH]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  );
}

function createLocalFaceClipPlanes(hw: number, hh: number) {
  return [
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), hw),
    new THREE.Plane(new THREE.Vector3(1, 0, 0), hw),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), hh),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), hh),
  ];
}

function useWorldFaceClipPlanes(
  groupRef: React.RefObject<THREE.Group | null>,
  hw: number,
  hh: number,
) {
  const localPlanes = useMemo(
    () => createLocalFaceClipPlanes(hw, hh),
    [hw, hh],
  );
  const worldPlanes = useMemo(
    () => localPlanes.map((plane) => plane.clone()),
    [localPlanes],
  );

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const matrix = group.matrixWorld;
    for (let i = 0; i < localPlanes.length; i++) {
      worldPlanes[i].copy(localPlanes[i]).applyMatrix4(matrix);
    }
  });

  return worldPlanes;
}

/** 숫자 원 배지 — 검은 원 + 문양색 테두리 */
function NumDiscBadge({
  position,
  radius,
  borderWidth,
  color,
  renderOrder,
  clipPlanes,
}: {
  position: [number, number, number];
  radius: number;
  borderWidth: number;
  color: string;
  renderOrder: number;
  clipPlanes: THREE.Plane[];
}) {
  const mat = {
    toneMapped: false as const,
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false,
    clippingPlanes: clipPlanes,
    clipIntersection: false as const,
  };
  return (
    <group position={position}>
      <mesh renderOrder={renderOrder}>
        <ringGeometry args={[radius, radius + borderWidth, 48]} />
        <meshBasicMaterial color={color} {...mat} />
      </mesh>
      <mesh renderOrder={renderOrder}>
        <circleGeometry args={[radius, 48]} />
        <meshBasicMaterial color="#000000" {...mat} />
      </mesh>
    </group>
  );
}

/** 손패 3D 앞면 — 일반 패는 돌 위에 그림만, 2번은 불투명 화려 앞면 */
export function LexioPlayCardFace3D({
  number,
  suit,
  width,
  height,
  isHovered = false,
  renderOrder,
}: LexioPlayCardFace3DProps) {
  const face = LEXIO_SUIT_FACE[suit];
  const isFancyTwo = number === 2;
  const hw = width / 2;
  const hh = height / 2;
  const hoverScale = isHovered ? 1.03 : 1;

  const numStr = String(number);
  const numSize = height * 0.24;
  const fancyNumPos: [number, number, number] = [0, 0, 0.014];
  const fancyNumSize = height * 0.3;
  const fancyNumDiscR = fancyNumSize * 0.55;
  const numDiscR = Math.max(
    numSize * (0.72 + (numStr.length - 1) * 0.15),
    fancyNumDiscR * 1.12,
  );
  const numDiscCenter: [number, number, number] = [
    -hw + width * 0.088 + numSize * 0.3 * numStr.length,
    hh - height * 0.075 - numSize * 0.44,
    0.014,
  ];
  const numTextPos: [number, number, number] = [
    numDiscCenter[0],
    numDiscCenter[1] + numSize * 0.04,
    0.016,
  ];
  const faceGroupRef = useRef<THREE.Group>(null);
  const clipPlanes = useWorldFaceClipPlanes(faceGroupRef, hw, hh);

  return (
    <group ref={faceGroupRef} scale={[hoverScale, hoverScale, 1]}>
      {isFancyTwo && (
        <FancyTwoCardFace
          width={width}
          height={height}
          face={face}
          renderOrder={renderOrder}
        />
      )}

      {/* 바탕 워터마크 — 2번 패는 제외 */}
      {!isFancyTwo && (
        <>
          <GlowText
            position={[0, -height * 0.02, 0.001]}
            fontSize={height * 0.68}
            color={face.glow}
            fillOpacity={0}
            strokeWidth={height * 0.018}
            strokeColor={face.glow}
            strokeOpacity={0.42}
            renderOrder={renderOrder + 1}
            anchorX="center"
            anchorY="middle"
            font={WATERMARK_FONT}
          >
            {face.watermark}
          </GlowText>
          <GlowText
            position={[0, -height * 0.02, 0.0015]}
            fontSize={height * 0.68}
            color={face.color}
            fillOpacity={0}
            strokeWidth={height * 0.011}
            strokeColor={face.color}
            strokeOpacity={0.55}
            renderOrder={renderOrder + 2}
            anchorX="center"
            anchorY="middle"
            font={WATERMARK_FONT}
          >
            {face.watermark}
          </GlowText>
        </>
      )}

      <NumDiscBadge
        position={isFancyTwo ? [0, 0, 0.014] : numDiscCenter}
        radius={isFancyTwo ? fancyNumDiscR : numDiscR}
        borderWidth={height * (isFancyTwo ? 0.042 : 0.036)}
        color={face.color}
        renderOrder={renderOrder + 40}
        clipPlanes={clipPlanes}
      />

      {/* 숫자 — 2번은 가운데, 그 외 좌상단 */}
      <GlowText
        position={
          isFancyTwo
            ? [fancyNumPos[0] - 0.002, fancyNumPos[1] - 0.002, fancyNumPos[2] - 0.001]
            : [numTextPos[0] - 0.002, numTextPos[1] - 0.002, numTextPos[2] - 0.001]
        }
        fontSize={isFancyTwo ? fancyNumSize * 1.06 : numSize * 1.06}
        color={face.glow}
        fillOpacity={isFancyTwo ? 0.55 : 0.45}
        renderOrder={renderOrder + 41}
        anchorX="center"
        anchorY="middle"
        font={NUMBER_FONT}
        depthTest={false}
      >
        {numStr}
      </GlowText>
      <GlowText
        position={isFancyTwo ? fancyNumPos : numTextPos}
        fontSize={isFancyTwo ? fancyNumSize : numSize}
        color={face.color}
        outlineWidth={
          height *
          (isFancyTwo ? 0.026 : 0.018) *
          NUMBER_OUTLINE_SCALE
        }
        outlineColor="#000000"
        renderOrder={renderOrder + 42}
        anchorX="center"
        anchorY="middle"
        font={NUMBER_FONT}
        depthTest={false}
      >
        {numStr}
      </GlowText>

      {!isFancyTwo && (
        <>
          {/* 하단: 문양 + 상형문자 */}
          <GlowText
            position={[-hw + width * 0.1, -hh + height * 0.16, 0.005]}
            fontSize={height * 0.13}
            color={face.color}
            fillOpacity={0.35}
            renderOrder={renderOrder + 3}
            anchorX="left"
            anchorY="middle"
          >
            {face.mark}
          </GlowText>
          <GlowText
            position={[-hw + width * 0.1, -hh + height * 0.16, 0.006]}
            fontSize={height * 0.13}
            color={face.color}
            outlineWidth={height * 0.006}
            renderOrder={renderOrder + 4}
            anchorX="left"
            anchorY="middle"
          >
            {face.mark}
          </GlowText>

          <GlowText
            position={[hw - width * 0.1, -hh + height * 0.17, 0.005]}
            fontSize={height * 0.11}
            color={face.glow}
            fillOpacity={0}
            outlineWidth={height * 0.009}
            outlineColor={face.glow}
            font={HIERO_FONT}
            renderOrder={renderOrder + 4}
            anchorX="right"
            anchorY="middle"
          >
            {face.glyph}
          </GlowText>
          <GlowText
            position={[hw - width * 0.1, -hh + height * 0.26, 0.005]}
            fontSize={height * 0.065}
            color="#737373"
            fillOpacity={0}
            outlineWidth={height * 0.005}
            outlineColor="#737373"
            font={HIERO_FONT}
            renderOrder={renderOrder + 4}
            anchorX="right"
            anchorY="middle"
          >
            {face.label}
          </GlowText>
        </>
      )}
    </group>
  );
}
