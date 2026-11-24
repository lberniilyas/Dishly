import type { PublicPhoto } from "../types";

/**
 * Dish photo using the variants generated at upload (480 / 1200 px WebP).
 * The browser picks the right size from `sizes`; a 24 px blurred version is
 * painted instantly as background so there's never an empty box.
 *
 * A plain <img> (not next/image): images are already optimized at upload,
 * so Next's on-the-fly optimizer would only add cost and latency.
 */
export function DishPhoto({
  photo,
  alt,
  sizes,
  priority = false,
  className = "",
}: {
  photo: PublicPhoto;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- see comment above
    <img
      src={photo.smUrl}
      srcSet={`${photo.smUrl} 480w, ${photo.lgUrl} 1200w`}
      sizes={sizes}
      alt={alt}
      width={photo.width}
      height={photo.height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      className={`object-cover ${className}`}
      style={{ backgroundImage: `url(${photo.blurDataUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
    />
  );
}
