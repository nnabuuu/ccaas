import type { ImageData } from '../../../types/reading'

export default function ImageBlock({ data }: { data: ImageData }) {
  if (data.src) {
    return (
      <div className="bk bk-image">
        <img src={data.src} alt={data.alt || ''} />
        {data.caption && <div className="bk-img-cap">{data.caption}</div>}
      </div>
    )
  }
  return (
    <div className="bk bk-image bk-image-ph">
      <div className="bk-img-ph-inner">{data.alt || 'Image placeholder'}</div>
    </div>
  )
}
