import { useImage } from '../hooks/useImage';

type Props = {
  userId: string;
  path: string | null;
  /** Small preview for lists instead of the full-width image. */
  thumbnail?: boolean;
};

/** An entry's image, from this device or downloaded; works offline once seen. */
export const NoteImage = ({ userId, path, thumbnail = false }: Props) => {
  const image = useImage(userId, path);
  if (!path) return null;
  const className = thumbnail ? 'note-image note-image-thumb' : 'note-image';
  if (image === undefined) return <div className={`${className} note-image-placeholder`} />;
  if ('error' in image) {
    return <p className="muted small">Изображение недоступно без сети.</p>;
  }
  const img = <img src={image.url} alt="" className={className} loading="lazy" />;
  return thumbnail ? (
    img
  ) : (
    <a href={image.url} target="_blank" rel="noopener noreferrer">
      {img}
    </a>
  );
};
