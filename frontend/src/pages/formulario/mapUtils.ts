export const buildExternalMapUrl = (latitud: number, longitud: number): string => {
  return `https://www.openstreetmap.org/?mlat=${latitud}&mlon=${longitud}#map=18/${latitud}/${longitud}`;
};

export const buildMapUrl = (latitud: number, longitud: number): string => {
  const delta = 0.003;
  const bbox = [
    longitud - delta,
    latitud - delta,
    longitud + delta,
    latitud + delta,
  ].join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitud},${longitud}`;
};
