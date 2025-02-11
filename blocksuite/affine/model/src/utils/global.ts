import type {
  GfxBlockElementModel,
  GfxGroupLikeElementModel,
  GfxLocalElementModel,
  GfxPrimitiveElementModel,
} from '@blocksuite/block-std/gfx';

declare global {
  namespace BlockSuite {
    interface EdgelessBlockModelMap {}
    type EdgelessBlockModelKeyType = keyof EdgelessBlockModelMap;
    type EdgelessBlockModelType =
      | EdgelessBlockModelMap[EdgelessBlockModelKeyType]
      | GfxBlockElementModel;

    interface EdgelessTextModelMap {}
    type EdgelessTextModelKeyType = keyof EdgelessTextModelMap;
    type EdgelessTextModelType = EdgelessTextModelMap[EdgelessTextModelKeyType];

    interface SurfaceElementModelMap {}
    type SurfaceElementModelKeys = keyof SurfaceElementModelMap;
    type SurfaceElementModel =
      | SurfaceElementModelMap[SurfaceElementModelKeys]
      | GfxPrimitiveElementModel;

    interface SurfaceGroupLikeModelMap {}
    type SurfaceGroupLikeModelKeys = keyof SurfaceGroupLikeModelMap;
    type SurfaceGroupLikeModel =
      | SurfaceGroupLikeModelMap[SurfaceGroupLikeModelKeys]
      | GfxGroupLikeElementModel;

    interface SurfaceLocalModelMap {}
    type SurfaceLocalModelKeys = keyof SurfaceLocalModelMap;
    type SurfaceLocalModel =
      | SurfaceLocalModelMap[SurfaceLocalModelKeys]
      | GfxLocalElementModel;

    // not include local model
    type SurfaceModel = SurfaceElementModel | SurfaceGroupLikeModel;
    type SurfaceModelKeyType =
      | SurfaceElementModelKeys
      | SurfaceGroupLikeModelKeys;

    type EdgelessModelKeys = EdgelessBlockModelKeyType | SurfaceModelKeyType;
  }
}
