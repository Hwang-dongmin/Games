import { Text } from '@react-three/drei';
import * as THREE from 'three';
import {
  LEXIO_SUIT_FACE,
  type LexioPlaySuit,
} from './LexioPlayCard';

const HIERO_FONT =
  'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansEgyptianHieroglyphs/NotoSansEgyptianHieroglyphs-Regular.ttf';

const NUMBER_FONT =
  'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Bold.ttf';

/** ☀☽★☁ 등 문양 기호 */
const WATERMARK_FONT =
  'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansSymbols2/NotoSansSymbols2-Regular.ttf';

type LexioPlayCardFace3DProps = {
  number: number;
  suit: LexioPlaySuit;
  width: number;
  height: number;
  isHovered?: boolean;
  numberTwoHalo?: boolean;
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
      material-depthTest
      material-depthWrite={false}
      material-transparent
    >
      {children}
    </Text>
  );
}

/**
 * 손패 3D 앞면 — 배경 없음(돌 위에 그림만), depth 정렬 유지
 */
export function LexioPlayCardFace3D({
  number,
  suit,
  width,
  height,
  isHovered = false,
  numberTwoHalo = false,
  renderOrder,
}: LexioPlayCardFace3DProps) {
  const face = LEXIO_SUIT_FACE[suit];
  const hw = width / 2;
  const hh = height / 2;
  const hoverScale = isHovered ? 1.03 : 1;

  const numStr = String(number);
  const numSize = height * 0.24;
  const numPos: [number, number, number] = [
    -hw + width * 0.1,
    hh - height * 0.11,
    0.004,
  ];
  const markSize = height * 0.13;
  const glyphSize = height * 0.11;
  const labelSize = height * 0.065;

  return (
    <group scale={[hoverScale, hoverScale, 1]}>
      {numberTwoHalo && (
        <>
          <mesh position={[0, 0, -0.003]} renderOrder={renderOrder - 2}>
            <planeGeometry args={[width * 1.18, height * 1.18]} />
            <meshBasicMaterial
              color="#fcd34d"
              transparent
              opacity={0.28}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          <mesh position={[0, 0, -0.002]} renderOrder={renderOrder - 1}>
            <planeGeometry args={[width * 1.08, height * 1.08]} />
            <meshBasicMaterial
              color="#fbbf24"
              transparent
              opacity={0.45}
              depthWrite={false}
            />
          </mesh>
        </>
      )}

      {/* 바탕 워터마크 — 해·달·별·구름, 외곽선만 (outlineWidth는 내부까지 채워짐) */}
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
      {/* 숫자 */}
      <GlowText
        position={[numPos[0] - 0.002, numPos[1] - 0.002, numPos[2] - 0.001]}
        fontSize={numSize * 1.06}
        color={face.glow}
        fillOpacity={0.45}
        renderOrder={renderOrder + 3}
        anchorX="left"
        anchorY="top"
        font={NUMBER_FONT}
      >
        {numStr}
      </GlowText>
      <GlowText
        position={numPos}
        fontSize={numSize}
        color={face.color}
        outlineWidth={height * 0.018}
        renderOrder={renderOrder + 4}
        anchorX="left"
        anchorY="top"
        font={NUMBER_FONT}
      >
        {numStr}
      </GlowText>

      {/* 하단: 문양 + 상형문자 */}
      <GlowText
        position={[-hw + width * 0.1, -hh + height * 0.16, 0.005]}
        fontSize={markSize}
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
        fontSize={markSize}
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
        fontSize={glyphSize}
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
        fontSize={labelSize}
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
    </group>
  );
}
