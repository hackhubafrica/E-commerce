export default function getImageSrc(image) {
  if (typeof image === "string") {
    return image;
  }

  if (image && typeof image.src === "string") {
    return image.src;
  }

  throw new TypeError("Expected an image URL or Astro image metadata.");
}
