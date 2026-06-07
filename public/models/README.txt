Lexio opponent character assets

Shared animations (Peasant Girl Mixamo rig):
  glb/Sitting.glb, glb/Sitting Clap.glb, … — all reaction clips

Character meshes (same rig → reuse glb/ animations):
  glb/Sitting.glb       — Peasant Girl (default)
  glb/Remy.glb          — from Sitting Laughing.fbx (Remy)
  glb/MaleSitting.glb   — Josh (male sitting.fbx); idle also from this file

Regenerate mesh GLBs:
  node --input-type=module -e "import c from 'fbx2gltf'; await c('public/models/Sitting Laughing.fbx','public/models/glb/Remy.glb',['--binary'])"
  node --input-type=module -e "import c from 'fbx2gltf'; await c('public/models/male sitting.fbx','public/models/glb/MaleSitting.glb',['--binary'])"

Regenerate Peasant clip GLBs from FBX:
  npm run convert:models
