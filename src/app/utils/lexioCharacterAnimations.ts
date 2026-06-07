import * as THREE from 'three';

/** Mixamo GLB merge 시 트랙이 mixamorigHips_5 등 고아 본을 가리키는 문제 보정 */
export function rebindMixamoMergedClip(
  clip: THREE.AnimationClip,
): THREE.AnimationClip {
  const tracks = clip.tracks.map((track) => {
    const dot = track.name.indexOf('.');
    if (dot === -1) return track;
    const boneName = track.name.slice(0, dot).replace(/_\d+$/, '');
    const reb = track.clone();
    reb.name = `${boneName}${track.name.slice(dot)}`;
    return reb;
  });
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

export function rebindMixamoMergedClips(
  clips: THREE.AnimationClip[],
): THREE.AnimationClip[] {
  return clips.map(rebindMixamoMergedClip);
}
