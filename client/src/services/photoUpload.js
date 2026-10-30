export async function compressPhoto(file) {
  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1920 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Impossibile elaborare la foto.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error('Impossibile comprimere la foto.'));
      }, 'image/webp', 0.82);
    });
    return { blob, fileName: file.name, idempotencyKey: crypto.randomUUID() };
  } finally {
    image.close();
  }
}
